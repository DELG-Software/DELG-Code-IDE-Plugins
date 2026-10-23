// The IDE starts gopls from the manifest's languageServers entry. The plugin
// registers the same server again so it can follow its state, restart it and
// apply the Go settings below.
const SERVER = {
  id: 'delg.go-language.gopls',
  languages: ['go'],
  command: 'gopls',
  args: ['serve'],
  projectMarkers: ['go.mod', 'go.work'],
  configuration: { analyses: { unusedparams: true }, staticcheck: true }
}

export function serverSpec(delg) {
  const value = (key, fallback) => {
    const v = delg.workspace.getConfiguration('delg.go-language.' + key)
    return v === undefined || v === null ? fallback : v
  }
  const tags = String(value('buildTags', '')).split(',').map((tag) => tag.trim()).filter(Boolean)
  const configuration = { ...SERVER.configuration, staticcheck: value('staticcheck', true) !== false }
  if (tags.length) configuration.buildFlags = ['-tags=' + tags.join(',')]
  return { ...SERVER, configuration }
}

export default function activate(delg) {
  return languageServerUi(delg, {
    prefix: 'delg.go-language',
    name: 'Go',
    spec: () => serverSpec(delg),
    help: 'Go support needs gopls. Install Go 1.22 or newer, run "go install golang.org/x/tools/gopls@latest", make sure your Go bin folder is on PATH, then run "Go: Restart Language Server".'
  })
}

// --- Shared by the DELG language plugins; keep the copies identical. ---

// languageServerUi shows the server's state in the status bar, warns once with
// setup help when it cannot start, and adds Restart, Setup Help and Status
// commands (declared in the manifest as <prefix>.restart, .setupHelp and
// .showStatus). Changing one of the plugin's settings restarts the server so
// the change applies. extraActions adds entries to the Status menu.
export function languageServerUi(delg, { prefix, name, spec, help, extraActions = [] }) {
  const statusId = prefix + '.status'
  const labels = { stopped: name, starting: name + ': starting…', running: name, error: name + ': not running', paused: name + ': not running' }
  const quiet = (promise) => { Promise.resolve(promise).catch(() => undefined) }
  let server = null
  let warned = false
  let disposed = false

  const show = (status) => {
    quiet(delg.ui.updateStatusBarItem(statusId, labels[status] || ''))
    if ((status === 'error' || status === 'paused') && !warned) {
      warned = true
      quiet(delg.ui.showWarningMessage(help))
    }
    if (status === 'running') warned = false
  }

  const ready = Promise.resolve(delg.ui.createStatusBarItem(statusId, '', name + ' language server', prefix + '.showStatus')).catch(() => undefined)

  const register = async () => {
    await ready
    if (disposed) return
    if (server) server.dispose()
    server = null
    try {
      const registered = await delg.languageServers.register(spec())
      if (disposed) return registered.dispose()
      server = registered
      server.onDidChangeStatus(show)
      show(server.status)
    } catch (error) {
      // The IDE refused the server outright, for example because Node.js is
      // missing: say why and how to fix it.
      quiet(delg.ui.updateStatusBarItem(statusId, labels.error))
      quiet(delg.ui.setStatus(name + ': ' + String((error && error.message) || error).slice(0, 200)))
      if (!warned) {
        warned = true
        quiet(delg.ui.showWarningMessage(help))
      }
    }
  }
  // One registration at a time, so a settings change during start-up cannot
  // leave two handles for the same server.
  let queue = Promise.resolve()
  const restart = () => (queue = queue.then(register))

  const showHelp = () => quiet(delg.ui.showInformationMessage(help))
  delg.registerCommand(prefix + '.restart', name + ': Restart Language Server', () => restart())
  delg.registerCommand(prefix + '.setupHelp', name + ': Show Setup Help', showHelp)
  delg.registerCommand(prefix + '.showStatus', name + ': Language Server Status', async () => {
    const actions = [
      ...extraActions,
      { label: 'Restart language server', run: restart },
      { label: 'Show setup help', run: showHelp }
    ]
    const choice = await delg.ui.showQuickPick(actions.map(({ label }) => ({ label })), {
      title: name + ' language server: ' + (server ? server.status : 'not started')
    })
    const action = choice && actions.find(({ label }) => label === choice.label)
    if (action) await action.run()
  })
  delg.workspace.onDidChangeConfiguration((key) => {
    if (typeof key === 'string' && key.startsWith(prefix + '.')) void restart()
  })
  void restart()

  return () => {
    disposed = true
    if (server) server.dispose()
  }
}
