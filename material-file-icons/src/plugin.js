// Material File Icons — a DELG IDE plugin using Google's Material Icons
// path data instead of text badges. The host renders these as safe, filled
// SVG paths in a 24x24 viewBox and applies the per-file Material palette.

// Material Icons are Apache-2.0 licensed:
// https://github.com/material-icons/material-icons
const MATERIAL_PATHS = Object.freeze({
  description: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  code: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6l6 6l1.4-1.4zm5.2 0l4.6-4.6l-4.6-4.6L16 6l6 6l-6 6l-1.4-1.4z',
  dataObject: 'M4 7v2c0 .55-.45 1-1 1H2v4h1c.55 0 1 .45 1 1v2c0 1.65 1.35 3 3 3h3v-2H7c-.55 0-1-.45-1-1v-2c0-1.3-.84-2.42-2-2.83v-.34C5.16 11.42 6 10.3 6 9V7c0-.55.45-1 1-1h3V4H7C5.35 4 4 5.35 4 7zm17 3c-.55 0-1-.45-1-1V7c0-1.65-1.35-3-3-3h-3v2h3c.55 0 1 .45 1 1v2c0 1.3.84 2.42 2 2.83v.34c-1.16.41-2 1.52-2 2.83v2c0 .55-.45 1-1 1h-3v2h3c1.65 0 3-1.35 3-3v-2c0-.55.45-1 1-1h1v-4h-1z',
  dataArray: 'M15 4v2h3v12h-3v2h5V4zM4 20h5v-2H6V6h3V4H4z',
  image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  audioFile: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 11h-3v3.75c0 1.24-1.01 2.25-2.25 2.25S8.5 17.99 8.5 16.75s1.01-2.25 2.25-2.25c.46 0 .89.14 1.25.38V11h4v2zm-3-4V3.5L18.5 9H13z',
  videoFile: 'M14 2H6.01a2 2 0 0 0-2 2L4 20c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm1 5l2-1.06v4.12L14 16v1c0 .55-.45 1-1 1H9c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h4c.55 0 1 .45 1 1v1z',
  fontDownload: 'M9.93 13.5h4.14L12 7.98zM20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-4.05 16.5l-1.14-3H9.17l-1.12 3H5.96l5.11-13h1.86l5.11 13h-2.09z',
  terminal: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16c1.1 0 2-.9 2-2V6a2 2 0 0 0-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4l-4 4z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94c0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6s3.6 1.62 3.6 3.6s-1.62 3.6-3.6 3.6z',
  tableChart: 'M10 10.02h5V21h-5zM17 21h3c1.1 0 2-.9 2-2v-9h-5v11zm3-18H5c-1.1 0-2 .9-2 2v3h19V5c0-1.1-.9-2-2-2zM3 19c0 1.1.9 2 2 2h3V10H3v9z',
  article: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  science: 'M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z',
  cloud: 'M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5c0-2.64-2.05-4.78-4.65-4.96z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2s-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1c1.71 0 3.1 1.39 3.1 3.1v2z',
  schema: 'M14 9v2h-3V9H8.5V7H11V1H4v6h2.5v2H4v6h2.5v2H4v6h7v-6H8.5v-2H11v-2h3v2h7V9h-7z',
  bugReport: 'M20 8h-2.81a5.985 5.985 0 0 0-1.82-1.96L17 4.41L15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3L7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z',
  build: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9c-2-2-5-2.4-7.4-1.3L9 6L6 9L1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
  archive: 'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z',
  javascript: 'M12 14v-1h1.5v.5h2v-1H13c-.55 0-1-.45-1-1V10c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1h-1.5v-.5h-2v1H16c.55 0 1 .45 1 1V14c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1zM9 9v4.5H7.5v-1H6v1c0 .83.67 1.5 1.5 1.5H9c.83 0 1.5-.67 1.5-1.5V9H9z',
  html: 'M3.5 9H5v6H3.5v-2.5h-2V15H0V9h1.5v2h2V9zm14 0H13c-.55 0-1 .45-1 1v5h1.5v-4.5h1V14H16v-3.51h1V15h1.5v-5c0-.55-.45-1-1-1zM11 9H6v1.5h1.75V15h1.5v-4.5H11V9zm13 6v-1.5h-2.5V9H20v6h4z',
  css: 'M9.5 14v-1H11v.5h2v-1h-2.5c-.55 0-1-.45-1-1V10c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1H13v-.5h-2v1h2.5c.55 0 1 .45 1 1V14c0 .55-.45 1-1 1h-3c-.55 0-1-1-1-1zm7.5 1h3c.55 0 1-.45 1-1v-1.5c0-.55-.45-1-1-1h-2.5v-1h2v.5H21v-1c0-.55-.45-1-1-1h-3c-.55 0-1 1-1 1v1.5c0 .55.45 1 1 1h2.5v1h-2V13H16v1c0 .55.45 1 1 1zm-9-5c0-.55-.45-1-1-1H4c-.55 0-1 1-1 1v4c0 .55.45 1 1 1h3c.55 0 1-1 1-1v-1H6.5v.5h-2v-3h2v.5H8v-1z'
})

const ICONS = []

function addIcon(icon, color, extensions) {
  for (const extension of extensions) ICONS.push([extension, icon, color])
}

// Languages use the official Material `code` symbol. Material Icons does
// not provide third-party brand logos for TypeScript, Vue, or similar tools.
addIcon('code', '#3776AB', ['.py', '.pyi', '.pyw'])
addIcon('code', '#CC342D', ['.rb', '.erb'])
addIcon('code', '#777BB4', ['.php', '.phtml'])
addIcon('code', '#ED8B00', ['.java'])
addIcon('code', '#7F52FF', ['.kt', '.kts'])
addIcon('code', '#FA7343', ['.swift'])
addIcon('code', '#239120', ['.cs'])
addIcon('code', '#378BBA', ['.fs'])
addIcon('code', '#659AD2', ['.cpp', '.cc', '.cxx', '.c'])
addIcon('code', '#9B59B6', ['.h', '.hpp'])
addIcon('code', '#438EFF', ['.m', '.mm'])
addIcon('code', '#276DC3', ['.r'])
addIcon('code', '#7986CB', ['.lua'])
addIcon('code', '#0175C2', ['.dart'])
addIcon('code', '#DC322F', ['.scala', '.sc'])
addIcon('code', '#6E4A7E', ['.ex', '.exs'])
addIcon('code', '#5881D8', ['.clj', '.cljs'])
addIcon('code', '#5E5086', ['.hs'])
addIcon('code', '#1293D8', ['.elm'])
addIcon('code', '#00ADD8', ['.go'])
addIcon('code', '#C97E5C', ['.rs'])
addIcon('code', '#EC915C', ['.zig'])
addIcon('code', '#FFE953', ['.nim'])
addIcon('code', '#5B7DB1', ['.v'])
addIcon('code', '#9558B2', ['.jl'])

addIcon('code', '#42B883', ['.vue'])
addIcon('code', '#FF3E00', ['.svelte'])
addIcon('code', '#FF5D01', ['.astro'])
addIcon('code', '#61DAFB', ['.jsx', '.tsx'])
addIcon('code', '#3178C6', ['.ts'])
addIcon('javascript', '#F7DF1E', ['.js', '.mjs', '.cjs'])
addIcon('css', '#9B7CD6', ['.css'])
addIcon('css', '#C76494', ['.scss', '.sass'])
addIcon('css', '#42A5F5', ['.less'])
addIcon('css', '#FF6347', ['.styl'])
addIcon('html', '#E07B53', ['.html', '.htm'])
addIcon('image', '#D4A24C', ['.svg'])

addIcon('dataObject', '#CBCB41', ['.json', '.jsonc', '.json5'])
addIcon('settings', '#CB171E', ['.yaml', '.yml'])
addIcon('settings', '#9C4221', ['.toml'])
addIcon('settings', '#82AAFF', ['.ini', '.cfg', '.conf', '.env'])
addIcon('settings', '#F05033', ['.gitignore', '.gitattributes', '.gitmodules'])
addIcon('settings', '#CB3837', ['.npmrc', '.nvmrc'])
addIcon('settings', '#56B6C2', ['.prettierrc'])
addIcon('settings', '#4B32C3', ['.eslintrc'])
addIcon('settings', '#5C6BC0', ['.editorconfig', '.dockerignore'])
addIcon('lock', '#9E9E9E', ['.lock'])

addIcon('terminal', '#4EAA25', ['.sh', '.bash', '.zsh', '.fish'])
addIcon('terminal', '#64B5F6', ['.ps1'])
addIcon('terminal', '#C1C1C1', ['.bat', '.cmd'])

addIcon('article', '#42A5F5', ['.md', '.mdx'])
addIcon('description', '#90A4AE', ['.rst', '.txt', '.pdf', '.tex', '.log'])
addIcon('tableChart', '#2E7D32', ['.csv', '.tsv'])
addIcon('schema', '#E91E63', ['.xml', '.graphql', '.gql'])
addIcon('dataObject', '#C78A4B', ['.sql', '.prisma'])

addIcon('image', '#FF9800', ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.avif'])
addIcon('fontDownload', '#795548', ['.woff', '.woff2', '.ttf', '.otf', '.eot'])
addIcon('audioFile', '#FF5722', ['.mp3', '.wav', '.ogg', '.flac'])
addIcon('videoFile', '#FF5722', ['.mp4', '.webm', '.mov'])

addIcon('archive', '#8D6E63', ['.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z'])
addIcon('build', '#2496ED', ['.dockerfile'])
addIcon('cloud', '#7B42BC', ['.tf', '.tfvars'])

export default function activate(delg) {
  let iconCount = 0

  for (const [extension, materialIcon, color] of ICONS) {
    try {
      delg.ui.registerExplorerIcon(extension, {
        path: MATERIAL_PATHS[materialIcon],
        color
      })
      iconCount++
    } catch (error) {
      console.warn('[material-file-icons] skipped ' + extension, error)
    }
  }

  try {
    const result = delg.ui.registerStatusBarItem(
      'delg.material-file-icons.status',
      iconCount + ' Material icons',
      'Material File Icons registered ' + iconCount + ' Explorer SVG icons'
    )
    if (result && typeof result.catch === 'function') {
      void result.catch((error) => console.warn('[material-file-icons] could not register status item', error))
    }
  } catch (error) {
    console.warn('[material-file-icons] could not register status item', error)
  }

  const disposeSummary = delg.registerCommand(
    'delg.material-file-icons.showSummary',
    'Material File Icons: Show Summary',
    () => delg.ui.showMessage(
      'Material File Icons registered ' + iconCount + ' Explorer SVG icons.'
    )
  )

  delg.ui.setStatus('Material File Icons: ' + iconCount + ' SVG icons registered')

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    disposeSummary?.()
  }
}
