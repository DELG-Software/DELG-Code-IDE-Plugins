// The IDE starts rust-analyzer from the manifest's languageServers entry. The
// plugin registers the same server again so it can follow its state, restart
// it and apply the Rust settings below.
const SERVER = {
  id: 'delg.rust-language.rust-analyzer',
  languages: ['rust'],
  command: 'rust-analyzer',
  args: [],
  projectMarkers: ['Cargo.toml', 'rust-project.json']
}

export function serverSpec(delg) {
  const value = (key, fallback) => {
    const v = delg.workspace.getConfiguration('delg.rust-language.' + key)
    return v === undefined || v === null ? fallback : v
  }
  const settings = { check: { command: value('checkCommand', 'check') === 'clippy' ? 'clippy' : 'check' } }
  if (value('allFeatures', false) === true) settings.cargo = { features: 'all' }
  // rust-analyzer reads its settings from initializationOptions at start and
  // from the "rust-analyzer" section when it asks for configuration later, so
  // they appear in both places.
  return { ...SERVER, configuration: { ...settings, 'rust-analyzer': settings } }
}

export default function activate(delg) {
  return languageServerUi(delg, {
    prefix: 'delg.rust-language',
    name: 'Rust',
    spec: () => serverSpec(delg),
    help: 'Rust support needs rust-analyzer. Install Rust from rustup.rs, run "rustup component add rust-analyzer", make sure your Cargo bin folder is on PATH, then run "Rust: Restart Language Server".'
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
