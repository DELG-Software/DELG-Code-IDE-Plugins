const STATUS_ID = 'delg.live-server.status'
let server = null
let statusBar = null

function setting(delg, key, fallback) {
  const value = delg.workspace.getConfiguration('delg.live-server.' + key)
  return value === undefined || value === null || value === '' ? fallback : value
}

function setStatus(delg, text) {
  delg.ui.setStatus('Live Server: ' + text)
  if (statusBar) void delg.ui.updateStatusBarItem(STATUS_ID, 'Live Server: ' + text)
}

function activePath(delg) {
  return delg.editor.getActiveDocument().then((document) => {
    if (!document || !/\.(html?|xhtml)$/i.test(document.path)) return '/'
    const root = String(setting(delg, 'root', '.')).replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
    const path = document.path.replaceAll('\\', '/').replace(/^\/+/, '')
    if (root && root !== '.' && path !== root && !path.startsWith(root + '/')) return '/'
    const relative = root && root !== '.' ? path.slice(root.length + 1) : path
    return '/' + relative
  })
}

async function start(delg, openBrowser) {
  if (server) await server.stop().catch(() => undefined)
  setStatus(delg, 'starting')
  try {
    server = await delg.servers.startStatic({
      root: String(setting(delg, 'root', '.')),
      index: String(setting(delg, 'index', 'index.html')),
      spaFallback: setting(delg, 'spaFallback', false) === true,
      liveReload: setting(delg, 'liveReload', true) !== false,
      exclude: String(setting(delg, 'exclude', '')).split(',').map((item) => item.trim()).filter(Boolean)
    })
    server.onDidChangeStatus((status) => {
      setStatus(delg, status)
      if (status === 'stopped') server = null
    })
    setStatus(delg, 'running')
    if (openBrowser) await open(delg)
  } catch (error) {
    server = null
    setStatus(delg, 'error: ' + String(error).slice(0, 120))
  }
}

async function open(delg) {
  try {
    if (!server) await start(delg, false)
    if (!server) return
    const path = await activePath(delg)
    const url = await server.urlFor(path)
    await delg.ui.openExternal(url)
  } catch (error) {
    setStatus(delg, 'error: ' + String(error).slice(0, 120))
  }
}

async function stop(delg) {
  if (server) await server.stop().catch(() => undefined)
  server = null
  setStatus(delg, 'stopped')
}

export default function activate(delg) {
  try {
    statusBar = delg.ui.registerStatusBarItem(STATUS_ID, 'Live Server: stopped', 'DELG Live Server')
  } catch {
    statusBar = null
  }
  setStatus(delg, 'stopped')
  delg.registerCommand('delg.live-server.start', 'Live Server: Start Server', () => void start(delg, setting(delg, 'openBrowser', true) !== false))
  delg.registerCommand('delg.live-server.stop', 'Live Server: Stop Server', () => void stop(delg))
  delg.registerCommand('delg.live-server.restart', 'Live Server: Restart Server', () => void start(delg, setting(delg, 'openBrowser', true) !== false))
  delg.registerCommand('delg.live-server.open', 'Live Server: Open in Browser', () => void open(delg))
  delg.workspace.onDidChangeConfiguration(() => {
    if (server) void start(delg, false)
  })
  return () => { void stop(delg) }
}
