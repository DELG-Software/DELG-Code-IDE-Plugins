const SUPPORTED_LANGUAGES = ['html', 'css', 'scss', 'less', 'javascript', 'typescript']
const COMPLETIONS_ENABLED_KEY = 'delg.web-forge.completions.enabled'
const SNIPPET_GUIDE_VIEW_ID = 'delg.web-forge.snippet-guide'
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])

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
  rfc: 'interface ${1:Component}Props {\n\t$2\n}\n\nexport function ${1:Component}({ $3 }: ${1:Component}Props) {\n\treturn (\n\t\t<div>$0</div>\n\t);\n}',
  rafc: 'export const ${1:Component} = () => {\n\treturn (\n\t\t<div>$0</div>\n\t);\n};',
  usestate: 'const [${1:value}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});',
  useeffect: 'useEffect(() => {\n\t$1\n\treturn () => {\n\t\t$2\n\t};\n}, [${3:dependencies}]);',
  usememo: 'const ${1:value} = useMemo(() => ${2:computeValue}, [${3:dependencies}]);',
  usecallback: 'const ${1:callback} = useCallback((${2:args}) => {\n\t$0\n}, [${3:dependencies}]);'
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

function trailingAbbreviation(linePrefix) {
  return linePrefix.match(/[a-zA-Z0-9!#.:+>*_-]+$/)?.[0] || ''
}

function parseNode(spec) {
  const multiplierMatch = spec.match(/\*(\d+)$/)
  const multiplier = multiplierMatch ? Math.min(Number(multiplierMatch[1]), 50) : 1
  const base = multiplierMatch ? spec.slice(0, multiplierMatch.index) : spec
  const tagMatch = base.match(/^[a-z][a-z0-9-]*/i)
  const tag = tagMatch?.[0].toLowerCase() || (base.startsWith('.') || base.startsWith('#') ? 'div' : '')
  if (!tag) return null
  const id = base.match(/#([a-z0-9_-]+)/i)?.[1]
  const classes = [...base.matchAll(/\.([a-z0-9_-]+)/gi)].map((match) => match[1])
  const remainder = base.slice(tagMatch?.[0].length || 0).replace(/#[a-z0-9_-]+/gi, '').replace(/\.[a-z0-9_-]+/gi, '')
  return remainder ? null : { tag, id, classes, multiplier }
}

function expandHtmlExpression(expression, state, depth = 0) {
  const siblings = expression.split('+').filter(Boolean)
  if (siblings.length > 1) {
    const expanded = siblings.map((part) => expandHtmlExpression(part, state, depth))
    return expanded.every(Boolean) ? expanded.join('\n') : null
  }
  const childIndex = expression.indexOf('>')
  const head = childIndex >= 0 ? expression.slice(0, childIndex) : expression
  const child = childIndex >= 0 ? expression.slice(childIndex + 1) : ''
  if (childIndex >= 0 && !child) return null
  const node = parseNode(head)
  if (!node) return null
  const rows = []
  for (let index = 0; index < node.multiplier; index++) {
    const indent = '\t'.repeat(depth)
    const attributes = `${node.id ? ` id="${node.id}"` : ''}${node.classes.length ? ` class="${node.classes.join(' ')}"` : ''}`
    if (VOID_ELEMENTS.has(node.tag)) rows.push(`${indent}<${node.tag}${attributes}>`)
    else if (child) {
      const nested = expandHtmlExpression(child, state, depth + 1)
      if (!nested) return null
      rows.push(`${indent}<${node.tag}${attributes}>\n${nested}\n${indent}</${node.tag}>`)
    } else rows.push(`${indent}<${node.tag}${attributes}>\${${state.tabStop++}}</${node.tag}>`)
  }
  return rows.join('\n')
}

function htmlSnippet(abbreviation) {
  if (HTML_SNIPPETS[abbreviation]) return HTML_SNIPPETS[abbreviation]
  const expanded = expandHtmlExpression(abbreviation, { tabStop: 1 })
  return expanded ? `${expanded}$0` : null
}

function snippetFor(context, abbreviation) {
  const ext = extension(context.path)
  if (ext === 'vue' && VUE_SNIPPETS[abbreviation]) return VUE_SNIPPETS[abbreviation]
  if ((ext === 'jsx' || ext === 'tsx') && REACT_SNIPPETS[abbreviation]) return REACT_SNIPPETS[abbreviation]
  if (context.language === 'typescript' && TYPESCRIPT_SNIPPETS[abbreviation]) return TYPESCRIPT_SNIPPETS[abbreviation]
  if ((context.language === 'javascript' || context.language === 'typescript') && JAVASCRIPT_SNIPPETS[abbreviation]) return JAVASCRIPT_SNIPPETS[abbreviation]
  if (context.language === 'css' || context.language === 'scss' || context.language === 'less') return CSS_SNIPPETS[abbreviation] || null
  if (context.language === 'html') return htmlSnippet(abbreviation)
  return null
}

export default function activate(delg) {
  let completionsEnabled = delg.workspace.getConfiguration(COMPLETIONS_ENABLED_KEY) !== false

  delg.registerCommand('delg.web-forge.about', 'Web Forge: Show Snippet Guide', () => {
    const state = completionsEnabled ? 'enabled' : 'disabled in plugin settings'
    void delg.ui.showMessage(`Web Forge completions are ${state}. Use Ctrl+Space to expand snippets; open the Web Forge sidebar for the guide.`)
  })

  delg.ui.setViewItems(SNIPPET_GUIDE_VIEW_ID, [
    {
      id: 'delg.web-forge.guide.html',
      label: 'HTML',
      description: 'Documents, elements, and structural abbreviations',
      collapsed: true,
      children: [
        { id: 'delg.web-forge.guide.html.documents', label: '!  html:5', description: 'HTML document templates' },
        { id: 'delg.web-forge.guide.html.assets', label: 'link:css  script:src  meta:vp', description: 'Common head and asset tags' },
        { id: 'delg.web-forge.guide.html.structure', label: 'div.card  ul>li*3  header+main+footer', description: 'Structural abbreviations' }
      ]
    },
    {
      id: 'delg.web-forge.guide.css',
      label: 'CSS / SCSS / Less',
      description: 'Layout and styling shortcuts',
      collapsed: true,
      children: [
        { id: 'delg.web-forge.guide.css.layout', label: 'df  dg  center  gridauto', description: 'Layout' },
        { id: 'delg.web-forge.guide.css.style', label: 'bgc  fz  br  shadow  transition', description: 'Styling' },
        { id: 'delg.web-forge.guide.css.structure', label: 'media  keyframes  vars', description: 'CSS structures' }
      ]
    },
    {
      id: 'delg.web-forge.guide.javascript',
      label: 'JavaScript / TypeScript',
      description: 'Functions, imports, data, and types',
      collapsed: true,
      children: [
        { id: 'delg.web-forge.guide.javascript.core', label: 'clg  fn  afn  imp  fetch  debounce', description: 'JavaScript helpers' },
        { id: 'delg.web-forge.guide.typescript.core', label: 'interface  type  enum  guard  generic', description: 'TypeScript helpers' }
      ]
    },
    {
      id: 'delg.web-forge.guide.frameworks',
      label: 'React / Vue',
      description: 'Components and composition helpers',
      collapsed: true,
      children: [
        { id: 'delg.web-forge.guide.react', label: 'rfc  rafc  usestate  useeffect', description: 'React (.jsx and .tsx)' },
        { id: 'delg.web-forge.guide.vue', label: 'vbase  vref  vcomputed  vwatch', description: 'Vue (.vue)' }
      ]
    }
  ])

  const disposeConfiguration = delg.workspace.onDidChangeConfiguration((key) => {
    if (key === COMPLETIONS_ENABLED_KEY) {
      completionsEnabled = delg.workspace.getConfiguration(COMPLETIONS_ENABLED_KEY) !== false
    }
  })

  const disposeCompletions = delg.ui.registerCompletionProvider(SUPPORTED_LANGUAGES, (context) => {
    if (!completionsEnabled) return []
    const abbreviation = trailingAbbreviation(context.linePrefix)
    if (!abbreviation) return []
    const insertText = snippetFor(context, abbreviation)
    if (!insertText) return []
    return [{
      label: abbreviation,
      detail: `Web Forge: expand ${abbreviation}`,
      documentation: 'Expand this Web Forge abbreviation.',
      insertText,
      kind: 'snippet',
      replaceStartColumn: context.column - abbreviation.length
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
