import { createHash } from 'node:crypto'
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { build as esbuild } from 'esbuild'
import { strToU8, unzipSync, zipSync } from 'fflate'

const root = dirname(fileURLToPath(import.meta.url))
const manifestPath = join(root, 'manifest.json')
const manifestText = await readFile(manifestPath, 'utf8')
const manifest = JSON.parse(manifestText)
const packageMetadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const entryPath = join(root, manifest.entry)
const outputPath = join(root, `delg-prettier-${manifest.version}.delg-plugin`)
const temporaryPath = `${outputPath}.tmp`

function wrapOversizedRegexLines(code) {
  let wrappedCount = 0
  const output = code.split('\n').map((line) => {
    if (line.length <= 900) return line
    const match = line.match(/^(\s*var\s+[\w$]+\s*=\s*(?:\(\)\s*=>\s*)?)\/([\s\S]*)\/([dgimsuvy]*);$/)
    if (!match) throw new Error(`bundle contains a non-regex line longer than 900 characters (${line.length})`)
    const [, prefix, source, flags] = match
    const characters = Array.from(source)
    const chunks = []
    for (let index = 0; index < characters.length; index += 180) {
      chunks.push(characters.slice(index, index + 180).join(''))
    }
    wrappedCount += 1
    return `${prefix}new RegExp(\n${chunks.map((chunk) => `  ${JSON.stringify(chunk)}`).join(' +\n')} ,\n  ${JSON.stringify(flags)}\n);`
  }).join('\n')
  return { code: output, wrappedCount }
}

if (manifest.version !== packageMetadata.version) {
  throw new Error('package.json and manifest.json versions must match')
}
if (manifest.entry !== 'plugin.js') throw new Error('manifest entry must be plugin.js')
if (manifest.source) {
  const repository = manifest.source.repository
  const commit = manifest.source.commit
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('manifest source.repository must be an HTTPS GitHub repository URL')
  }
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(commit)) {
    throw new Error('manifest source.commit must be a full commit hash')
  }
}

const buildResult = await esbuild({
  absWorkingDir: root,
  entryPoints: ['src/plugin.js'],
  outfile: manifest.entry,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2020',
  charset: 'utf8',
  lineLimit: 120,
  minify: false,
  legalComments: 'none',
  treeShaking: true,
  write: false,
  metafile: true,
  logLevel: 'silent'
})
if (buildResult.outputFiles.length !== 1) throw new Error('expected one self-contained runtime bundle')
const outputImports = Object.values(buildResult.metafile.outputs).flatMap((output) => output.imports)
if (outputImports.some((item) => item.external)) throw new Error('runtime bundle contains an external import')
const wrappedBundle = wrapOversizedRegexLines(Buffer.from(buildResult.outputFiles[0].contents).toString('utf8'))
const bundleBytes = Buffer.from(wrappedBundle.code)
const bundleText = wrappedBundle.code
const maxLineLength = Math.max(...bundleText.split('\n').map((line) => line.length))
if (maxLineLength > 1000) throw new Error(`runtime bundle has an unexpectedly long line (${maxLineLength} characters)`)
await writeFile(entryPath, bundleBytes)

const includedFiles = ['README.md', 'LICENSES.txt', 'THIRD-PARTY-NOTICES.md', manifest.entry]
const archiveSources = new Map([
  ['manifest.json', Buffer.from(manifestText)],
  ...await Promise.all(includedFiles.map(async (name) => [name, await readFile(join(root, name))]))
])
const archiveBytes = zipSync(
  Object.fromEntries([...archiveSources].map(([name, bytes]) => [name, bytes])),
  { level: 9, mtime: new Date(1980, 0, 1, 0, 0, 0, 0) }
)
const archiveFiles = unzipSync(archiveBytes)
const expectedNames = ['LICENSES.txt', 'README.md', 'THIRD-PARTY-NOTICES.md', 'manifest.json', manifest.entry].sort()
if (Object.keys(archiveFiles).sort().join('\n') !== expectedNames.join('\n')) {
  throw new Error(`archive contents differ from allowlist: ${Object.keys(archiveFiles).sort().join(', ')}`)
}
if (JSON.parse(new TextDecoder().decode(archiveFiles['manifest.json'])).entry !== manifest.entry) {
  throw new Error('embedded manifest entry does not match the runtime entry')
}
for (const [name, bytes] of archiveSources) {
  if (!Buffer.from(archiveFiles[name]).equals(Buffer.from(bytes))) {
    throw new Error(`archive ${name} does not match its source bytes`)
  }
}
await writeFile(temporaryPath, archiveBytes)

const tests = spawnSync(process.execPath, ['--test', join(root, 'plugin.test.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DELG_PRETTIER_ARCHIVE: temporaryPath }
})
if (tests.status !== 0) {
  await rm(temporaryPath, { force: true })
  throw new Error('Prettier tests failed; package was not built')
}

await rm(outputPath, { force: true })
await rename(temporaryPath, outputPath)
const digest = createHash('sha256').update(archiveBytes).digest('hex').toUpperCase()
console.log(`Created ${outputPath}`)
console.log(`Verified archive allowlist: ${expectedNames.join(', ')}`)
console.log(`Runtime bundle: ${bundleBytes.byteLength} bytes; wrapped ${wrappedBundle.wrappedCount} long regex lines; longest line ${maxLineLength} characters`)
console.log(`SHA-256 ${digest}`)
