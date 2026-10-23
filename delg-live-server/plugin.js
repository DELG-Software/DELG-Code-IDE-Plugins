const STATUS_ID = 'delg.live-server.status'
const MAX_PAGES = 100
const MAX_DEPTH = 6
const SKIPPED_FOLDERS = new Set(['node_modules', '.git', '.delg'])
let server = null
let address = ''

function setting(delg, key, fallback) {
  const value = delg.workspace.getConfiguration('delg.live-server.' + key)
  return value === undefined || value === null || value === '' ? fallback : value
}

function quiet(promise) {
  Promise.resolve(promise).catch(() => undefined)
}

function setStatus(delg, text) {
  quiet(delg.ui.setStatus('Live Server: ' + text))
  quiet(delg.ui.updateStatusBarItem(STATUS_ID, 'Live Server: ' + text))
}

// hostOf shortens http://127.0.0.1:53123/ to 127.0.0.1:53123 for the status bar.
export function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function contentRoot(delg) {
  const root = String(setting(delg, 'root', '.')).replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  return root === '.' ? '' : root
}

// servedPath turns a workspace path into the server path, or null when the
// file is outside the served folder.
export function servedPath(root, path) {
  const normalized = String(path).replaceAll('\\', '/').replace(/^\/+/, '')
  if (!root) return '/' + normalized
  if (normalized !== root && !normalized.startsWith(root + '/')) return null
  return '/' + normalized.slice(root.length + 1)
}

function activePath(delg) {
  return delg.editor.getActiveDocument().then((document) => {
    if (!document || !/\.(html?|xhtml)$/i.test(document.path)) return '/'
    return servedPath(contentRoot(delg), document.path) || '/'
  })
}

// htmlPages lists the HTML files in the served folder, nearest first.
export async function htmlPages(delg) {
  const root = contentRoot(delg)
  const pages = []
  let level = [root]
  for (let depth = 0; depth < MAX_DEPTH && level.length && pages.length < MAX_PAGES; depth++) {
    const next = []
    for (const folder of level) {
      const entries = await delg.workspace.listFiles(folder).catch(() => [])
      for (const entry of entries) {
        const path = folder ? folder + '/' + entry.name : entry.name
        if (entry.isDir) {
          if (!SKIPPED_FOLDERS.has(entry.name)) next.push(path)
        } else if (/\.(html?|xhtml)$/i.test(entry.name) && pages.length < MAX_PAGES) {
          pages.push(path)
        }
      }
    }
    level = next
  }
  return pages
}

async function start(delg, openBrowser) {
  if (server) await server.stop().catch(() => undefined)
  server = null
  address = ''
  setStatus(delg, 'starting')
  try {
    const started = await delg.servers.startStatic({
      root: String(setting(delg, 'root', '.')),
      index: String(setting(delg, 'index', 'index.html')),
      spaFallback: setting(delg, 'spaFallback', false) === true,
      liveReload: setting(delg, 'liveReload', true) !== false,
      exclude: String(setting(delg, 'exclude', '')).split(',').map((item) => item.trim()).filter(Boolean)
    })
    server = started
    address = hostOf(started.url)
    started.onDidChangeStatus((status) => {
      if (server !== started) return
      if (status === 'stopped') {
        server = null
        address = ''
      }
      setStatus(delg, status === 'running' && address ? address : status)
    })
    setStatus(delg, address || 'running')
    if (openBrowser) await open(delg)
  } catch (error) {
    server = null
    setStatus(delg, 'error: ' + String(error).slice(0, 120))
  }
}

async function open(delg, path) {
  try {
    if (!server) await start(delg, false)
    if (!server) return
    const url = await server.urlFor(path || await activePath(delg))
    await delg.ui.openExternal(url)
  } catch (error) {
    setStatus(delg, 'error: ' + String(error).slice(0, 120))
  }
}

async function openPage(delg) {
  const pages = await htmlPages(delg)
  if (!pages.length) {
    quiet(delg.ui.showInformationMessage('No HTML files were found in the served folder.'))
    return
  }
  const choice = await delg.ui.showQuickPick(pages.map((label) => ({ label })), { title: 'Open a page in the browser' })
  if (!choice) return
  const path = servedPath(contentRoot(delg), choice.label)
  if (path) await open(delg, path)
}

async function stop(delg) {
  const current = server
  server = null
  address = ''
  if (current) await current.stop().catch(() => undefined)
  setStatus(delg, 'stopped')
}

async function showUrl(delg) {
  if (!server) return quiet(delg.ui.showInformationMessage('Live Server is not running.'))
  quiet(delg.ui.showInformationMessage('Live Server is serving at ' + server.url))
}

async function menu(delg) {
  const actions = server
    ? [
        { label: 'Open in browser', run: () => open(delg) },
        { label: 'Open a page…', run: () => openPage(delg) },
        { label: 'Show address', run: () => showUrl(delg) },
        { label: 'Restart server', run: () => start(delg, false) },
        { label: 'Stop server', run: () => stop(delg) }
      ]
    : [
        { label: 'Start and open in browser', run: () => start(delg, true) },
        { label: 'Open a page…', run: () => openPage(delg) },
        { label: 'Start server', run: () => start(delg, false) }
      ]
  const choice = await delg.ui.showQuickPick(actions.map(({ label }) => ({ label })), {
    title: server ? 'Live Server: ' + (address || 'running') : 'Live Server: stopped'
  })
  const action = choice && actions.find(({ label }) => label === choice.label)
  if (action) await action.run()
}

export default function activate(delg) {
  quiet(delg.ui.createStatusBarItem(STATUS_ID, 'Live Server: stopped', 'DELG Live Server: click for options', 'delg.live-server.menu'))
  setStatus(delg, 'stopped')
  delg.registerCommand('delg.live-server.start', 'Live Server: Start Server', () => start(delg, setting(delg, 'openBrowser', true) !== false))
  delg.registerCommand('delg.live-server.stop', 'Live Server: Stop Server', () => stop(delg))
  delg.registerCommand('delg.live-server.restart', 'Live Server: Restart Server', () => start(delg, false))
  delg.registerCommand('delg.live-server.open', 'Live Server: Open in Browser', () => open(delg))
  delg.registerCommand('delg.live-server.openPage', 'Live Server: Open a Page…', () => openPage(delg))
  delg.registerCommand('delg.live-server.showUrl', 'Live Server: Show Address', () => showUrl(delg))
  delg.registerCommand('delg.live-server.menu', 'Live Server: Show Options', () => menu(delg))
  delg.workspace.onDidChangeConfiguration((key) => {
    if (server && (typeof key !== 'string' || key.startsWith('delg.live-server.'))) void start(delg, false)
  })
  return () => { void stop(delg) }
}
