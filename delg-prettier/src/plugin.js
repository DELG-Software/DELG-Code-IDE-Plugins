import * as prettier from 'prettier/standalone'
import * as babelPlugin from 'prettier/plugins/babel'
import * as estreePlugin from 'prettier/plugins/estree'
import * as typescriptPlugin from 'prettier/plugins/typescript'
import * as htmlPlugin from 'prettier/plugins/html'
import * as postcssPlugin from 'prettier/plugins/postcss'
import * as yamlPlugin from 'prettier/plugins/yaml'
import * as markdownPlugin from 'prettier/plugins/markdown'
import * as graphqlPlugin from 'prettier/plugins/graphql'

const plugins = [
  babelPlugin,
  estreePlugin,
  typescriptPlugin,
  htmlPlugin,
  postcssPlugin,
  yamlPlugin,
  markdownPlugin,
  graphqlPlugin
]

export const parserByExtension = Object.freeze({
  js: 'babel',
  jsx: 'babel',
  mjs: 'babel',
  cjs: 'babel',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  jsonc: 'jsonc',
  json5: 'json5',
  html: 'html',
  htm: 'html',
  vue: 'vue',
  css: 'css',
  scss: 'scss',
  less: 'less',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'mdx',
  graphql: 'graphql',
  gql: 'graphql'
})

const CONFIG_NAMES = ['package.json', '.prettierrc', '.prettierrc.json']
const MAX_CONFIG_CHARS = 1024 * 1024
const MAX_DOCUMENT_CHARS = 1024 * 1024
const MAX_CONFIG_DEPTH = 32
const PRETTIER_OPTIONS = new Set([
  'printWidth',
  'tabWidth',
  'useTabs',
  'semi',
  'singleQuote',
  'quoteProps',
  'jsxSingleQuote',
  'trailingComma',
  'bracketSpacing',
  'bracketSameLine',
  'arrowParens',
  'proseWrap',
  'htmlWhitespaceSensitivity',
  'vueIndentScriptAndStyle',
  'embeddedLanguageFormatting',
  'endOfLine',
  'singleAttributePerLine',
  'objectWrap',
  'experimentalTernaries',
  'experimentalOperatorPosition',
  'requirePragma',
  'insertPragma'
])

function normalizeRelativePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\0')) return null
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '')
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return null
  const parts = normalized.split('/')
  if (parts.some((part) => part === '..')) return null
  return parts.filter((part) => part && part !== '.').join('/')
}

function parentPath(path) {
  const index = path.lastIndexOf('/')
  return index < 0 ? '' : path.slice(0, index)
}

function extensionOf(path) {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const index = name.lastIndexOf('.')
  return index < 0 ? '' : name.slice(index + 1).toLowerCase()
}

async function readOptional(workspace, path) {
  try {
    const value = await workspace.readFile(path)
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

function configOptions(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must contain a JSON object`)
  }
  if (value.plugins !== undefined && value.plugins !== null && (Array.isArray(value.plugins) ? value.plugins.length > 0 : true)) {
    throw new Error('external Prettier plugins are not bundled')
  }
  if (value.overrides !== undefined && (!Array.isArray(value.overrides) || value.overrides.length > 0)) {
    throw new Error('Prettier configuration overrides are not supported')
  }
  if (value.parser !== undefined) throw new Error('top-level parser configuration is not supported')

  const options = {}
  for (const [key, option] of Object.entries(value)) {
    if (PRETTIER_OPTIONS.has(key)) options[key] = option
    else if (!['plugins', 'overrides'].includes(key)) throw new Error(`unsupported Prettier option: ${key}`)
  }
  return options
}

async function parseConfigFile(text, path) {
  if (text.length > MAX_CONFIG_CHARS) throw new Error(`${path} is larger than 1 MiB`)
  let value
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error(`${path} must be strict JSON`)
  }
  return configOptions(value, path)
}

/** Resolve a supported JSON config from the file's directory toward workspace root. */
export async function resolveProjectOptions(workspace, filePath) {
  let directory = parentPath(filePath)
  for (let depth = 0; depth <= MAX_CONFIG_DEPTH; depth += 1) {
    const paths = CONFIG_NAMES.map((name) => directory ? `${directory}/${name}` : name)
    const contents = await Promise.all(paths.map((path) => readOptional(workspace, path)))

    const packageText = contents[0]
    if (packageText !== null) {
      if (packageText.length > MAX_CONFIG_CHARS) throw new Error('package.json is larger than 1 MiB')
      let packageJson
      try {
        packageJson = JSON.parse(packageText)
      } catch {
        throw new Error('package.json is not valid JSON')
      }
      if (Object.hasOwn(packageJson, 'prettier')) {
        return parseConfigValue(packageJson.prettier, `${paths[0]}#prettier`)
      }
    }

    if (contents[1] !== null) return parseConfigFile(contents[1], paths[1])
    if (contents[2] !== null) return parseConfigFile(contents[2], paths[2])
    if (!directory) break
    directory = parentPath(directory)
  }
  return {}
}

function parseConfigValue(value, path) {
  if (typeof value === 'string') throw new Error(`${path} must be an object, not a config-file path`)
  return configOptions(value, path)
}

function globExpression(pattern) {
  let source = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        index += 1
        if (pattern[index + 1] === '/') {
          index += 1
          source += '(?:.*/)?'
        } else {
          source += '.*'
        }
      } else {
        source += '[^/]*'
      }
    } else if (character === '?') {
      source += '[^/]'
    } else if (character === '[') {
      const end = pattern.indexOf(']', index + 1)
      if (end < 0) source += '\\['
      else {
        let range = pattern.slice(index + 1, end)
        if (range.startsWith('!')) range = `^${range.slice(1)}`
        source += `[${range}]`
        index = end
      }
    } else {
      source += /[.()+^${}|\\]/.test(character) ? `\\${character}` : character
    }
  }
  return source
}

function parseIgnorePatterns(text) {
  const patterns = []
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim()
    if (!line) continue
    const escapedLeadingMarker = line.startsWith('\\#') || line.startsWith('\\!')
    if (escapedLeadingMarker) line = line.slice(1)
    else if (line.startsWith('#')) continue
    const negated = !escapedLeadingMarker && line.startsWith('!')
    if (negated) line = line.slice(1)
    line = line.replace(/\\([ #!])/g, '$1')
    if (!line) continue
    const anchored = line.startsWith('/')
    if (anchored) line = line.slice(1)
    const directoryOnly = line.endsWith('/')
    if (directoryOnly) line = line.slice(0, -1)
    if (!line) continue
    const hasSlash = anchored || line.includes('/')
    let expression = globExpression(line)
    if (directoryOnly) expression += '(?:/.*)?'
    const prefix = hasSlash ? '^' : '(?:^|/)'
    patterns.push({
      negated,
      regex: new RegExp(`${prefix}${expression}$`)
    })
  }
  return patterns
}

function matchesIgnore(path, patterns) {
  const segments = path.split('/').filter(Boolean)
  if (segments.includes('node_modules')) return true

  const directories = segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/'))
  const prefixes = [...directories, path]
  for (let index = 0; index < prefixes.length; index += 1) {
    const prefix = prefixes[index]
    let ignored = false
    for (const pattern of patterns) {
      if (pattern.regex.test(prefix)) ignored = !pattern.negated
    }
    if (ignored) return true
  }
  return false
}

export async function isIgnoredPath(workspace, filePath) {
  const [gitignore, prettierignore] = await Promise.all([
    readOptional(workspace, '.gitignore'),
    readOptional(workspace, '.prettierignore')
  ])
  const patterns = [
    ...(gitignore === null ? [] : parseIgnorePatterns(gitignore)),
    ...(prettierignore === null ? [] : parseIgnorePatterns(prettierignore))
  ]
  return matchesIgnore(filePath, patterns)
}

function fullDocumentRange(text) {
  const lines = text.split(/\r\n|\r|\n/)
  return {
    startLine: 1,
    startColumn: 1,
    endLine: lines.length,
    endColumn: lines.at(-1).length + 1
  }
}

function reportOnce(delg, seen, key, message) {
  if (seen.has(key)) return
  seen.add(key)
  try {
    Promise.resolve(delg.ui.setStatus(message)).catch(() => undefined)
  } catch {
    // Status reporting is best-effort; a formatter failure must not pause the provider.
  }
}

export function createFormattingProvider(delg) {
  const reported = new Set()
  return async function provide(context) {
    const filePath = normalizeRelativePath(context?.path)
    if (!filePath || typeof context?.text !== 'string') return []
    const parser = parserByExtension[extensionOf(filePath)]
    if (!parser) return []
    if (context.text.length >= MAX_DOCUMENT_CHARS) {
      reportOnce(delg, reported, 'input-limit', 'Prettier skipped a document at the 1 MiB editor limit.')
      return []
    }

    try {
      if (await isIgnoredPath(delg.workspace, filePath)) return []
      const projectOptions = await resolveProjectOptions(delg.workspace, filePath)
      const formatted = await prettier.format(context.text, {
        ...projectOptions,
        filepath: filePath,
        parser,
        plugins
      })
      if (formatted.length > MAX_DOCUMENT_CHARS) {
        reportOnce(delg, reported, 'output-limit', 'Prettier skipped output larger than the IDE formatting limit.')
        return []
      }
      if (formatted === context.text) return []
      return [{ range: fullDocumentRange(context.text), text: formatted }]
    } catch {
      reportOnce(delg, reported, `format:${filePath}`, `Prettier could not format ${filePath}; check its syntax and JSON configuration.`)
      return []
    }
  }
}

export default function activate(delg) {
  const languages = [
    'javascript', 'javascriptreact', 'typescript', 'typescriptreact',
    'json', 'jsonc', 'html', 'vue', 'css', 'scss', 'less', 'yaml',
    'markdown', 'graphql', 'plaintext'
  ]
  return delg.ui.registerDocumentFormattingEditProvider(languages, createFormattingProvider(delg))
}
