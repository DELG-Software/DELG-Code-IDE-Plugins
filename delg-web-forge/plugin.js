const SUPPORTED_LANGUAGES = ['html', 'css', 'scss', 'less', 'javascript', 'typescript']
const COMPLETIONS_ENABLED_KEY = 'delg.web-forge.completions.enabled'
const HTML_ENABLED_KEY = 'delg.web-forge.html.enabled'
const CSS_ENABLED_KEY = 'delg.web-forge.css.enabled'
const JAVASCRIPT_ENABLED_KEY = 'delg.web-forge.javascript.enabled'
const FRAMEWORKS_ENABLED_KEY = 'delg.web-forge.frameworks.enabled'
const AUTO_HTML_TAGS_KEY = 'delg.web-forge.html.autoTags'
const QUOTE_STYLE_KEY = 'delg.web-forge.html.quoteStyle'
const INDENT_STYLE_KEY = 'delg.web-forge.indentStyle'
const SNIPPET_GUIDE_VIEW_ID = 'delg.web-forge.snippet-guide'
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const HTML_ELEMENTS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br',
  'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del', 'details',
  'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1',
  'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input',
  'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'menu', 'meta', 'meter', 'nav',
  'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt',
  'ruby', 's', 'samp', 'script', 'search', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong',
  'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead',
  'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr'
])
const HTML_SEED_ELEMENTS = [
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  ...HTML_ELEMENTS
].filter((tag, index, tags) => tags.indexOf(tag) === index)

const HTML_SNIPPETS = {
  '!': `<!DOCTYPE html>
<html lang="en">
<head>
\t<meta charset="UTF-8">
\t<meta name="viewport" content="width=device-width, initial-scale=1.0">
\t<title>\${1:Document}</title>
</head>
<body>
\t$0
</body>
</html>`,
  'html:5': `<!DOCTYPE html>
<html lang="en">
<head>
\t<meta charset="UTF-8">
\t<meta name="viewport" content="width=device-width, initial-scale=1.0">
\t<title>\${1:Document}</title>
</head>
<body>
\t$0
</body>
</html>`,
  'link:css': '<link rel="stylesheet" href="${1:style.css}">',
  'script:src': '<script src="${1:script.js}"></script>',
  'meta:vp': '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  a: '<a href="${1:#}">${2:Link}</a>',
  img: '<img src="${1:image.jpg}" alt="${2:Description}">',
  input: '<input type="${1:text}" name="${2:name}" id="${3:name}">',
  btn: '<button type="${1:button}">${2:Button}</button>',
  'form:get': '<form action="${1:/}" method="get">\n\t$0\n</form>',
  'form:post': '<form action="${1:/}" method="post">\n\t$0\n</form>',
  picture: '<picture>\n\t<source srcset="${1:image.webp}" type="image/webp">\n\t<img src="${2:image.jpg}" alt="${3:Description}">\n</picture>',
  details: '<details>\n\t<summary>${1:Summary}</summary>\n\t$0\n</details>'
}

const CSS_SNIPPETS = {
  df: 'display: flex;',
  dg: 'display: grid;',
  dn: 'display: none;',
  center: 'display: flex;\njustify-content: center;\nalign-items: center;',
  gridauto: 'display: grid;\ngrid-template-columns: repeat(auto-fit, minmax(${1:16rem}, 1fr));\ngap: ${2:1rem};',
  posa: 'position: absolute;\n${1:inset: 0;}',
  posr: 'position: relative;',
  posf: 'position: fixed;\ninset: ${1:0};',
  m: 'margin: ${1:0};',
  mx: 'margin-inline: ${1:auto};',
  p: 'padding: ${1:1rem};',
  w100: 'width: 100%;',
  h100: 'height: 100%;',
  minfull: 'min-height: 100vh;',
  c: 'color: ${1:#fff};',
  bgc: 'background-color: ${1:#000};',
  fz: 'font-size: ${1:1rem};',
  fw: 'font-weight: ${1:600};',
  br: 'border-radius: ${1:0.5rem};',
  shadow: 'box-shadow: 0 ${1:0.5rem} ${2:1.5rem} rgba(0, 0, 0, ${3:0.15});',
  transition: 'transition: ${1:all} ${2:150ms} ${3:ease};',
  truncate: 'overflow: hidden;\ntext-overflow: ellipsis;\nwhite-space: nowrap;',
  media: '@media (min-width: ${1:768px}) {\n\t$0\n}',
  keyframes: '@keyframes ${1:name} {\n\tfrom {\n\t\t$2\n\t}\n\tto {\n\t\t$0\n\t}\n}',
  vars: ':root {\n\t--${1:color-primary}: ${2:#4f8cff};\n\t$0\n}'
}

const JAVASCRIPT_SNIPPETS = {
  clg: "console.log('${1:label}', ${2:value});",
  cle: "console.error('${1:error}', ${2:error});",
  fn: 'function ${1:name}(${2:args}) {\n\t$0\n}',
  afn: 'const ${1:name} = async (${2:args}) => {\n\t$0\n};',
  imp: "import { ${1:name} } from '${2:module}';",
  imd: "import ${1:name} from '${2:module}';",
  exp: 'export default ${1:name};',
  trycatch: 'try {\n\t$1\n} catch (error) {\n\tconsole.error(error);\n\t$0\n}',
  fetch: "const response = await fetch('${1:url}');\nif (!response.ok) throw new Error(`Request failed: \${response.status}`);\nconst ${2:data} = await response.json();",
  forof: 'for (const ${1:item} of ${2:items}) {\n\t$0\n}',
  map: 'const ${1:result} = ${2:items}.map((${3:item}) => ${4:item});',
  filter: 'const ${1:result} = ${2:items}.filter((${3:item}) => ${4:true});',
  reduce: 'const ${1:result} = ${2:items}.reduce((${3:acc}, ${4:item}) => {\n\t$0\n\treturn ${3:acc};\n}, ${5:initialValue});',
  promise: 'return new Promise((resolve, reject) => {\n\t$0\n});',
  debounce: 'function debounce(fn, delay = ${1:300}) {\n\tlet timeout;\n\treturn (...args) => {\n\t\tclearTimeout(timeout);\n\t\ttimeout = setTimeout(() => fn(...args), delay);\n\t};\n}',
  domready: "document.addEventListener('DOMContentLoaded', () => {\n\t$0\n});"
}

const TYPESCRIPT_SNIPPETS = {
  interface: 'interface ${1:Name} {\n\t${2:property}: ${3:string};\n\t$0\n}',
  type: 'type ${1:Name} = {\n\t${2:property}: ${3:string};\n\t$0\n};',
  enum: 'enum ${1:Name} {\n\t${2:Value} = \'${2:Value}\',\n\t$0\n}',
  guard: 'function is${1:Type}(value: unknown): value is ${1:Type} {\n\treturn ${2:true};\n}',
  generic: 'function ${1:name}<T>(${2:value}: T): T {\n\t$0\n\treturn ${2:value};\n}'
}

const REACT_SNIPPETS = {
  rafc: 'export const ${1:Component} = () => {\n\treturn (\n\t\t<div>$0</div>\n\t);\n};',
  usestate: 'const [${1:value}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});',
  useeffect: 'useEffect(() => {\n\t$1\n\treturn () => {\n\t\t$2\n\t};\n}, [${3:dependencies}]);',
  usememo: 'const ${1:value} = useMemo(() => ${2:computeValue}, [${3:dependencies}]);',
  usecallback: 'const ${1:callback} = useCallback((${2:args}) => {\n\t$0\n}, [${3:dependencies}]);'
}

const JSX_SNIPPETS = {
  ...REACT_SNIPPETS,
  rfc: 'export function ${1:Component}({ $2 }) {\n\treturn (\n\t\t<div>$0</div>\n\t);\n}'
}

const TSX_SNIPPETS = {
  ...REACT_SNIPPETS,
  rfc: 'interface ${1:Component}Props {\n\t$2\n}\n\nexport function ${1:Component}({ $3 }: ${1:Component}Props) {\n\treturn (\n\t\t<div>$0</div>\n\t);\n}'
}

const VUE_SNIPPETS = {
  vbase: '<script setup lang="ts">\n$1\n</script>\n\n<template>\n\t<div>$0</div>\n</template>\n\n<style scoped>\n$2\n</style>',
  vref: 'const ${1:value} = ref(${2:initialValue})',
  vcomputed: 'const ${1:value} = computed(() => ${2:expression})',
  vwatch: 'watch(${1:source}, (${2:value}, ${3:oldValue}) => {\n\t$0\n})',
  vonmounted: 'onMounted(() => {\n\t$0\n})',
  vdefineprops: 'const props = defineProps<{\n\t${1:property}: ${2:string}\n}>()',
  vdefineemits: "const emit = defineEmits<{\n\t${1:event}: [${2:value}: ${3:string}]\n}>()"
}

function extension(path) {
  return path.split('.').pop()?.toLowerCase() || ''
}

function plainTrailingAbbreviation(linePrefix) {
  const match = linePrefix.match(/[a-zA-Z0-9_-]+$/)?.[0] || ''
  if (!match) return ''
  const preceding = linePrefix[linePrefix.length - match.length - 1]
  // Do not turn member access, CSS selectors, or property values into named
  // snippet completions. Statement/operator boundaries remain valid.
  return preceding && '.#:'.includes(preceding) ? '' : match
}

function trailingAbbreviation(linePrefix, language) {
  if (language !== 'html') return plainTrailingAbbreviation(linePrefix)
  let searchablePrefix = linePrefix
  const tagStart = linePrefix.lastIndexOf('<')
  if (tagStart >= 0) {
    const tagEnd = linePrefix.indexOf('>', tagStart + 1)
    // Existing markup is a hard boundary. Preserve structural `>` operators
    // typed after that boundary (for example, `<main>ul>li`) while never
    // folding the existing tag name into the new abbreviation.
    searchablePrefix = tagEnd >= 0
      ? linePrefix.slice(tagEnd + 1)
      : linePrefix.slice(tagStart + 1)
  }
  let start = 0
  let brackets = 0
  let braces = 0
  let parentheses = 0
  let quote = ''
  for (let index = 0; index < searchablePrefix.length; index++) {
    const char = searchablePrefix[index]
    if (quote) {
      if (char === quote && searchablePrefix[index - 1] !== '\\') quote = ''
      continue
    }
    if ((char === '"' || char === "'") && brackets > 0) quote = char
    else if (char === '[') brackets += 1
    else if (char === ']') brackets = Math.max(0, brackets - 1)
    else if (char === '{') braces += 1
    else if (char === '}') braces = Math.max(0, braces - 1)
    else if (char === '(') parentheses += 1
    else if (char === ')') parentheses = Math.max(0, parentheses - 1)
    else if (/\s/.test(char) && !brackets && !braces && !parentheses) start = index + 1
  }
  return searchablePrefix.slice(start)
}

function multiplierAt(value, index) {
  const match = value.slice(index).match(/^\*(\d+)/)
  if (!match) return { multiplier: 1, end: index }
  return { multiplier: Math.max(1, Math.min(Number(match[1]), 50)), end: index + match[0].length }
}

function parseAttributes(source) {
  const attributes = []
  let index = 0
  const pattern = /([:@a-z_][:@a-z0-9_.-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/iy
  while (index < source.length) {
    while (/\s/.test(source[index] || '')) index += 1
    if (index >= source.length) break
    pattern.lastIndex = index
    const match = pattern.exec(source)
    if (!match) return null
    attributes.push({ name: match[1], value: match[2] ?? match[3] ?? match[4] })
    index = pattern.lastIndex
  }
  return attributes
}

function parseNodeSpec(spec) {
  const multiplierMatch = spec.match(/\*(\d+)$/)
  const repeat = multiplierMatch ? Math.max(1, Math.min(Number(multiplierMatch[1]), 50)) : 1
  let base = multiplierMatch ? spec.slice(0, multiplierMatch.index) : spec
  let text
  const textMatches = [...base.matchAll(/\{([^{}]*)\}/g)]
  if (textMatches.length > 1) return null
  if (textMatches.length === 1) {
    text = textMatches[0][1]
    base = base.slice(0, textMatches[0].index) + base.slice(textMatches[0].index + textMatches[0][0].length)
  }
  const attributes = []
  let invalidAttributes = false
  base = base.replace(/\[([^\]]*)\]/g, (_whole, body) => {
    const parsed = parseAttributes(body)
    if (!parsed) invalidAttributes = true
    else attributes.push(...parsed)
    return ''
  })
  if (invalidAttributes || /[\[\]{}]/.test(base)) return null
  const tagMatch = base.match(/^[a-z][a-z0-9$-]*/i)
  const tag = tagMatch?.[0].toLowerCase() || ''
  if (!tag && !base.startsWith('.') && !base.startsWith('#')) return null
  const idMatches = [...base.matchAll(/#([a-z0-9_$-]+)/gi)]
  if (idMatches.length > 1) return null
  const id = idMatches[0]?.[1]
  const classes = [...base.matchAll(/\.([a-z0-9_$-]+)/gi)].map((match) => match[1])
  const remainder = base
    .slice(tagMatch?.[0].length || 0)
    .replace(/#[a-z0-9_$-]+/gi, '')
    .replace(/\.[a-z0-9_$-]+/gi, '')
  if (remainder) return null
  return { tag, id, classes, attributes, text, repeat, children: [] }
}

function cloneNumberedNode(node, number) {
  return {
    ...node,
    number,
    attributes: node.attributes.map((attribute) => ({ ...attribute })),
    children: node.children.map((child) => cloneNumberedNode(child, number))
  }
}

function matchingParenthesis(expression, start) {
  let depth = 0
  let brackets = 0
  let braces = 0
  for (let index = start; index < expression.length; index++) {
    const char = expression[index]
    if (char === '[') brackets += 1
    else if (char === ']') brackets -= 1
    else if (char === '{') braces += 1
    else if (char === '}') braces -= 1
    else if (!brackets && !braces && char === '(') depth += 1
    else if (!brackets && !braces && char === ')' && --depth === 0) return index
    if (brackets < 0 || braces < 0) return -1
  }
  return -1
}

function readHtmlTerm(expression, start) {
  if (expression[start] === '(') {
    const close = matchingParenthesis(expression, start)
    if (close < 0) return null
    const parsed = parseHtmlExpression(expression.slice(start + 1, close))
    if (!parsed) return null
    const repeated = multiplierAt(expression, close + 1)
    const nodes = []
    for (let number = 1; number <= repeated.multiplier; number++) {
      nodes.push(...parsed.map((node) => cloneNumberedNode(node, number)))
    }
    return { nodes, end: repeated.end }
  }
  let brackets = 0
  let braces = 0
  let index = start
  for (; index < expression.length; index++) {
    const char = expression[index]
    if (char === '[') brackets += 1
    else if (char === ']') brackets -= 1
    else if (char === '{') braces += 1
    else if (char === '}') braces -= 1
    else if (!brackets && !braces && (char === '>' || char === '+' || char === '^' || char === '(' || char === ')')) break
    if (brackets < 0 || braces < 0) return null
  }
  if (brackets || braces || index === start) return null
  const node = parseNodeSpec(expression.slice(start, index))
  return node ? { nodes: [node], end: index } : null
}

function parseHtmlExpression(expression) {
  if (!expression || expression.length > 500) return null
  const roots = []
  const containers = [roots]
  let depth = 0
  let index = 0
  let expectingTerm = true
  let lastNodes = []
  while (index < expression.length) {
    if (expectingTerm) {
      const term = readHtmlTerm(expression, index)
      if (!term) return null
      containers[depth].push(...term.nodes)
      lastNodes = term.nodes
      index = term.end
      expectingTerm = false
      continue
    }
    const operator = expression[index]
    if (operator === '>') {
      if (!lastNodes.length) return null
      depth += 1
      containers[depth] = lastNodes[lastNodes.length - 1].children
      containers.length = depth + 1
    } else if (operator === '+') {
      // Keep the current parent: the next term is a sibling.
    } else if (operator === '^') {
      depth = Math.max(0, depth - 1)
      containers.length = depth + 1
    } else return null
    index += 1
    expectingTerm = true
  }
  return expectingTerm ? null : roots
}

function numbered(value, number) {
  return String(value).replace(/\$+/g, (match) => String(number).padStart(match.length, '0'))
}

function implicitTag(parentTag) {
  if (parentTag === 'ul' || parentTag === 'ol') return 'li'
  if (['table', 'thead', 'tbody', 'tfoot'].includes(parentTag)) return 'tr'
  if (parentTag === 'tr') return 'td'
  if (parentTag === 'select' || parentTag === 'optgroup') return 'option'
  if (parentTag === 'dl') return 'dt'
  return 'div'
}

function renderAttributes(node, number, dialect, quote) {
  const attributes = []
  if (node.id) attributes.push({ name: 'id', value: numbered(node.id, number) })
  if (node.classes.length) attributes.push({ name: 'class', value: node.classes.map((name) => numbered(name, number)).join(' ') })
  attributes.push(...node.attributes.map((attribute) => ({
    name: attribute.name,
    value: attribute.value === undefined ? undefined : numbered(attribute.value, number)
  })))
  return attributes.map((attribute) => {
    let name = attribute.name
    if (dialect === 'jsx' && name === 'class') name = 'className'
    if (dialect === 'jsx' && name === 'for') name = 'htmlFor'
    return attribute.value === undefined ? ` ${name}` : ` ${name}=${quote}${attribute.value}${quote}`
  }).join('')
}

function renderHtmlNodes(nodes, state, depth = 0, dialect = 'html', parentTag = '', inheritedNumber = 1) {
  const rows = []
  for (const node of nodes) {
    for (let index = 0; index < node.repeat; index++) {
      const number = node.repeat > 1 ? index + 1 : (node.number || inheritedNumber)
      const tag = numbered(node.tag || implicitTag(parentTag), number)
      const indent = '\t'.repeat(depth)
      const attributes = renderAttributes(node, number, dialect, state.quote)
      if (VOID_ELEMENTS.has(tag)) {
        if (node.children.length || node.text !== undefined) return null
        rows.push(`${indent}<${tag}${attributes}${dialect === 'jsx' ? ' /' : ''}>`)
        continue
      }
      if (node.children.length) {
        const nested = renderHtmlNodes(node.children, state, depth + 1, dialect, tag, number)
        if (!nested) return null
        const text = node.text === undefined ? '' : numbered(node.text, number)
        rows.push(`${indent}<${tag}${attributes}>${text ? `\n${'\t'.repeat(depth + 1)}${text}` : ''}\n${nested}\n${indent}</${tag}>`)
      } else if (node.text !== undefined) {
        rows.push(`${indent}<${tag}${attributes}>${numbered(node.text, number)}</${tag}>`)
      } else {
        rows.push(`${indent}<${tag}${attributes}>\${${state.tabStop++}}</${tag}>`)
      }
    }
  }
  return rows.join('\n')
}

function htmlSnippet(abbreviation, dialect = 'html', quote = '"') {
  if (dialect === 'html' && HTML_SNIPPETS[abbreviation]) return HTML_SNIPPETS[abbreviation]
  const rootTag = abbreviation.match(/^[a-z][a-z0-9-]*/i)?.[0].toLowerCase()
  const hasEmmetSyntax = /[.#>+*\[\]{}()^$]/.test(abbreviation)
  const isCustomElement = rootTag?.includes('-')
  if (!hasEmmetSyntax && !isCustomElement && !HTML_ELEMENTS.has(rootTag)) return null
  const tree = parseHtmlExpression(abbreviation)
  if (!tree) return null
  const expanded = renderHtmlNodes(tree, { tabStop: 1, quote }, 0, dialect)
  return expanded ? `${expanded}$0` : null
}

function htmlSeedCompletions(column, dialect, quote) {
  return HTML_SEED_ELEMENTS.map((tag) => ({
    label: tag,
    detail: `Web Forge: insert <${tag}>`,
    documentation: 'Insert this HTML element.',
    insertText: VOID_ELEMENTS.has(tag)
      ? `${tag}${dialect === 'jsx' ? ' /' : ''}>$0`
      : `${tag}>\${1}</${tag}>$0`,
    kind: 'snippet',
    replaceStartColumn: column
  }))
}

function documentRegion(context) {
  const prefix = (context.documentPrefix || context.linePrefix).toLowerCase()
  const lastOpen = (tag) => prefix.lastIndexOf(`<${tag}`)
  const lastClose = (tag) => prefix.lastIndexOf(`</${tag}`)
  if (lastOpen('style') > lastClose('style')) return 'style'
  if (lastOpen('script') > lastClose('script')) return 'script'
  return 'markup'
}

function vueScriptLanguage(context) {
  const prefix = context.documentPrefix || context.linePrefix
  const matches = [...prefix.matchAll(/<script\b([^>]*)>/gi)]
  const attributes = matches.at(-1)?.[1] || ''
  return /\blang\s*=\s*["']ts["']/i.test(attributes) ? 'typescript' : 'javascript'
}

function cssTrailingAbbreviation(linePrefix) {
  const match = linePrefix.match(/[a-z][a-z0-9#%-]*$/i)?.[0] || ''
  if (!match) return ''
  const preceding = linePrefix[linePrefix.length - match.length - 1]
  return preceding && '.:#'.includes(preceding) ? '' : match
}

function cssValue(raw, unit = '') {
  const resolvedUnit = unit === 'p' ? '%' : unit
  return Number(raw) === 0 ? '0' : `${raw}${resolvedUnit || 'px'}`
}

function dynamicCssSnippet(abbreviation) {
  const color = abbreviation.match(/^(bg|c)#([0-9a-f]{3,8})$/i)
  if (color) return `${color[1].toLowerCase() === 'bg' ? 'background-color' : 'color'}: #${color[2]};`
  const spacing = abbreviation.match(/^(m|mt|mr|mb|ml|mx|my|p|pt|pr|pb|pl|px|py)(-?\d+)(?:-(-?\d+))?(p|rem|em|vh|vw)?$/i)
  if (spacing) {
    const properties = {
      m: 'margin', mt: 'margin-top', mr: 'margin-right', mb: 'margin-bottom', ml: 'margin-left', mx: 'margin-inline', my: 'margin-block',
      p: 'padding', pt: 'padding-top', pr: 'padding-right', pb: 'padding-bottom', pl: 'padding-left', px: 'padding-inline', py: 'padding-block'
    }
    const values = [cssValue(spacing[2], spacing[4])]
    if (spacing[3] !== undefined) values.push(cssValue(spacing[3], spacing[4]))
    return `${properties[spacing[1].toLowerCase()]}: ${values.join(' ')};`
  }
  const size = abbreviation.match(/^(w|h|minw|maxw|minh|maxh|fz|gap)(-?\d+)(p|rem|em|vh|vw)?$/i)
  if (size) {
    const properties = { w: 'width', h: 'height', minw: 'min-width', maxw: 'max-width', minh: 'min-height', maxh: 'max-height', fz: 'font-size', gap: 'gap' }
    return `${properties[size[1].toLowerCase()]}: ${cssValue(size[2], size[3])};`
  }
  return null
}

function applyFormatting(snippet, settings) {
  let formatted = snippet
  if (settings.quoteStyle === 'single') formatted = formatted.replace(/="([^"]*)"/g, "='$1'")
  if (settings.indentStyle === 'spaces-2') formatted = formatted.replace(/\t/g, '  ')
  if (settings.indentStyle === 'spaces-4') formatted = formatted.replace(/\t/g, '    ')
  return formatted
}

function positionAt(source, offset) {
  const before = source.slice(0, offset)
  const lines = before.split('\n')
  return { line: lines.length, column: lines.at(-1).length + 1 }
}

function importEdit(context, moduleName, symbol, insertionOffset = 0) {
  const source = context.documentPrefix
  if (!source || context.documentPrefixTruncated) return []
  const escapedModule = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const namedImport = new RegExp(`import\\s+[^\\n;]*?\\{([^}]*)\\}\\s*from\\s*['"]${escapedModule}['"]\\s*;?`)
  const match = namedImport.exec(source)
  if (match) {
    const names = match[1].split(',').map((name) => name.trim()).filter(Boolean)
    if (names.some((name) => name.split(/\s+as\s+/i)[0].trim() === symbol)) return []
    const open = match[0].indexOf('{')
    const close = match[0].lastIndexOf('}')
    const start = positionAt(source, match.index + open + 1)
    const end = positionAt(source, match.index + close)
    return [{
      startLine: start.line,
      startColumn: start.column,
      endLine: end.line,
      endColumn: end.column,
      text: ` ${[...names, symbol].join(', ')} `
    }]
  }
  const anyImport = new RegExp(`(?:import|require\\()[^\\n]*['"]${escapedModule}['"]`).test(source)
  if (new RegExp(`\\b${symbol}\\b`).test(source) && anyImport) return []
  const insertion = positionAt(source, insertionOffset)
  return [{
    startLine: insertion.line,
    startColumn: insertion.column,
    endLine: insertion.line,
    endColumn: insertion.column,
    text: `import { ${symbol} } from '${moduleName}';\n`
  }]
}

function frameworkImportEdits(context, abbreviation) {
  const ext = extension(context.path)
  const reactSymbols = { usestate: 'useState', useeffect: 'useEffect', usememo: 'useMemo', usecallback: 'useCallback' }
  const vueSymbols = { vref: 'ref', vcomputed: 'computed', vwatch: 'watch', vonmounted: 'onMounted' }
  if ((ext === 'jsx' || ext === 'tsx') && reactSymbols[abbreviation]) return importEdit(context, 'react', reactSymbols[abbreviation])
  if (ext === 'vue' && vueSymbols[abbreviation]) {
    const source = context.documentPrefix || ''
    const scripts = [...source.matchAll(/<script\b[^>]*>/gi)]
    const script = scripts.at(-1)
    let insertionOffset = script ? script.index + script[0].length : 0
    if (source[insertionOffset] === '\r') insertionOffset += 1
    if (source[insertionOffset] === '\n') insertionOffset += 1
    return importEdit(context, 'vue', vueSymbols[abbreviation], insertionOffset)
  }
  return []
}

function snippetFor(context, abbreviation, settings, region) {
  const ext = extension(context.path)
  const quote = settings.quoteStyle === 'single' ? "'" : '"'
  if (ext === 'vue') {
    if (settings.frameworks && (region === 'script' || abbreviation === 'vbase') && VUE_SNIPPETS[abbreviation]) return VUE_SNIPPETS[abbreviation]
    if (region === 'style' && settings.css) return CSS_SNIPPETS[abbreviation] || dynamicCssSnippet(abbreviation)
    if (region === 'script' && settings.javascript) {
      const language = vueScriptLanguage(context)
      if (language === 'typescript' && TYPESCRIPT_SNIPPETS[abbreviation]) return TYPESCRIPT_SNIPPETS[abbreviation]
      return JAVASCRIPT_SNIPPETS[abbreviation] || null
    }
    if (region === 'markup' && settings.html) return htmlSnippet(abbreviation, 'html', quote)
    return null
  }
  if (ext === 'jsx' || ext === 'tsx') {
    if (settings.frameworks) {
      const frameworkSnippet = (ext === 'tsx' ? TSX_SNIPPETS : JSX_SNIPPETS)[abbreviation]
      if (frameworkSnippet) return frameworkSnippet
    }
    return settings.html ? htmlSnippet(abbreviation, 'jsx', quote) : null
  }
  if (context.language === 'typescript' && settings.javascript && TYPESCRIPT_SNIPPETS[abbreviation]) return TYPESCRIPT_SNIPPETS[abbreviation]
  if ((context.language === 'javascript' || context.language === 'typescript') && settings.javascript && JAVASCRIPT_SNIPPETS[abbreviation]) return JAVASCRIPT_SNIPPETS[abbreviation]
  if ((context.language === 'css' || context.language === 'scss' || context.language === 'less') && settings.css) return CSS_SNIPPETS[abbreviation] || dynamicCssSnippet(abbreviation)
  if (context.language === 'html') {
    if (region === 'style' && settings.css) return CSS_SNIPPETS[abbreviation] || dynamicCssSnippet(abbreviation)
    if (region === 'script' && settings.javascript) return JAVASCRIPT_SNIPPETS[abbreviation] || null
    if (settings.html) return htmlSnippet(abbreviation, 'html', quote)
  }
  return null
}

export default function activate(delg) {
  const configurationKeys = new Set([
    COMPLETIONS_ENABLED_KEY, HTML_ENABLED_KEY, CSS_ENABLED_KEY, JAVASCRIPT_ENABLED_KEY,
    FRAMEWORKS_ENABLED_KEY, AUTO_HTML_TAGS_KEY, QUOTE_STYLE_KEY, INDENT_STYLE_KEY
  ])
  const readSettings = () => ({
    completions: delg.workspace.getConfiguration(COMPLETIONS_ENABLED_KEY) !== false,
    html: delg.workspace.getConfiguration(HTML_ENABLED_KEY) !== false,
    css: delg.workspace.getConfiguration(CSS_ENABLED_KEY) !== false,
    javascript: delg.workspace.getConfiguration(JAVASCRIPT_ENABLED_KEY) !== false,
    frameworks: delg.workspace.getConfiguration(FRAMEWORKS_ENABLED_KEY) !== false,
    autoHtmlTags: delg.workspace.getConfiguration(AUTO_HTML_TAGS_KEY) !== false,
    quoteStyle: delg.workspace.getConfiguration(QUOTE_STYLE_KEY) === 'single' ? 'single' : 'double',
    indentStyle: ['spaces-2', 'spaces-4'].includes(delg.workspace.getConfiguration(INDENT_STYLE_KEY))
      ? delg.workspace.getConfiguration(INDENT_STYLE_KEY)
      : 'tabs'
  })
  let settings = readSettings()

  delg.registerCommand('delg.web-forge.about', 'Web Forge: Show Snippet Guide', () => {
    const state = settings.completions ? 'enabled' : 'disabled in plugin settings'
    void delg.ui.showMessage(`Web Forge completions are ${state}. Use Ctrl+Space to expand snippets; open the Web Forge sidebar for the guide.`)
  })

  const guideGroups = [
    {
      id: 'html', label: 'HTML', description: 'Documents and structural abbreviations',
      entries: ['!', 'html:5', 'link:css', 'script:src', 'meta:vp', 'div.card', 'ul>li*3', 'button.primary[type=button]{Save}']
        .map((abbreviation) => ({ abbreviation, snippet: () => htmlSnippet(abbreviation) }))
    },
    {
      id: 'css', label: 'CSS / SCSS / Less', description: 'Fixed and dynamic property shortcuts',
      entries: [...Object.keys(CSS_SNIPPETS), 'm10', 'mx10-20', 'w50p', 'bg#fff']
        .map((abbreviation) => ({ abbreviation, snippet: () => CSS_SNIPPETS[abbreviation] || dynamicCssSnippet(abbreviation) }))
    },
    {
      id: 'javascript', label: 'JavaScript', description: 'Functions, imports, data, and control flow',
      entries: Object.keys(JAVASCRIPT_SNIPPETS).map((abbreviation) => ({ abbreviation, snippet: () => JAVASCRIPT_SNIPPETS[abbreviation] }))
    },
    {
      id: 'typescript', label: 'TypeScript', description: 'Types, interfaces, enums, and guards',
      entries: Object.keys(TYPESCRIPT_SNIPPETS).map((abbreviation) => ({ abbreviation, snippet: () => TYPESCRIPT_SNIPPETS[abbreviation] }))
    },
    {
      id: 'react', label: 'React', description: 'JSX-safe components and hooks',
      entries: Object.keys(JSX_SNIPPETS).map((abbreviation) => ({ abbreviation, snippet: () => JSX_SNIPPETS[abbreviation] }))
    },
    {
      id: 'vue', label: 'Vue', description: 'Single-file components and Composition API',
      entries: Object.keys(VUE_SNIPPETS).map((abbreviation) => ({ abbreviation, snippet: () => VUE_SNIPPETS[abbreviation] }))
    }
  ]
  const guideItems = guideGroups.map((group) => ({
    id: `delg.web-forge.guide.${group.id}`,
    label: group.label,
    description: group.description,
    collapsed: true,
    children: group.entries.map((entry, index) => {
      const command = `delg.web-forge.insert.${group.id}.${index}`
      delg.registerCommand(command, `Web Forge: Insert ${entry.abbreviation}`, () => {
        const snippet = entry.snippet()
        if (!snippet) return
        if (typeof delg.ui.insertSnippet !== 'function') {
          void delg.ui.showMessage('Update DELG Code IDE to use click-to-insert snippets from the Web Forge guide.')
          return
        }
        delg.ui.insertSnippet(applyFormatting(snippet, settings))
      })
      return {
        id: `delg.web-forge.guide.${group.id}.${index}`,
        label: entry.abbreviation,
        description: 'Click to insert',
        command
      }
    })
  }))
  delg.ui.setViewItems(SNIPPET_GUIDE_VIEW_ID, guideItems)

  const disposeConfiguration = delg.workspace.onDidChangeConfiguration((key) => {
    if (configurationKeys.has(key)) settings = readSettings()
  })

  const disposeCompletions = delg.ui.registerCompletionProvider(SUPPORTED_LANGUAGES, (context) => {
    if (!settings.completions) return []
    const ext = extension(context.path)
    const region = documentRegion(context)
    const dialect = ext === 'jsx' || ext === 'tsx' ? 'jsx' : 'html'
    // The IDE invokes providers as soon as `<` is typed. Seed the suggestion
    // widget here so it remains active while the user types a nested tag name.
    if (
      settings.html && settings.autoHtmlTags && region === 'markup' && context.linePrefix.endsWith('<') &&
      (context.language === 'html' || ext === 'jsx' || ext === 'tsx')
    ) {
      const quote = settings.quoteStyle === 'single' ? "'" : '"'
      return htmlSeedCompletions(context.column, dialect, quote)
    }
    let abbreviation
    if (region === 'style' || context.language === 'css' || context.language === 'scss' || context.language === 'less') {
      abbreviation = cssTrailingAbbreviation(context.linePrefix) || plainTrailingAbbreviation(context.linePrefix)
    } else if (region === 'markup' && (context.language === 'html' || ext === 'jsx' || ext === 'tsx')) {
      abbreviation = trailingAbbreviation(context.linePrefix, 'html')
    } else {
      abbreviation = plainTrailingAbbreviation(context.linePrefix)
    }
    if (!abbreviation) return []
    let insertText = snippetFor(context, abbreviation, settings, region)
    if (!insertText && (ext === 'vue' || ext === 'jsx' || ext === 'tsx')) {
      const plainAbbreviation = plainTrailingAbbreviation(context.linePrefix)
      if (plainAbbreviation && plainAbbreviation !== abbreviation) {
        const plainInsertText = snippetFor(context, plainAbbreviation, settings, region)
        if (plainInsertText) {
          abbreviation = plainAbbreviation
          insertText = plainInsertText
        }
      }
    }
    if (!insertText) return []
    const additionalTextEdits = frameworkImportEdits(context, abbreviation)
    return [{
      label: abbreviation,
      detail: `Web Forge: expand ${abbreviation}`,
      documentation: 'Expand this Web Forge abbreviation.',
      insertText: applyFormatting(insertText, settings),
      kind: 'snippet',
      replaceStartColumn: context.column - abbreviation.length,
      ...(additionalTextEdits.length ? { additionalTextEdits } : {})
    }]
  })

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    disposeCompletions()
    disposeConfiguration()
  }
}
