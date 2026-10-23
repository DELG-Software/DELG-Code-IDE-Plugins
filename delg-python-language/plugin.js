// The IDE starts Pyright from the manifest's languageServers entry and applies
// the interpreter settings. The plugin registers the same server again so it
// can follow its state, restart it when the interpreter changes, and offer an
// interpreter picker.
const SERVER = {
  id: 'delg.python-language.pyright',
  languages: ['python'],
  command: '',
  entrypoint: 'servers/pyright-langserver.mjs',
  args: ['--stdio'],
  projectMarkers: ['pyproject.toml', 'pyrightconfig.json', 'setup.py', 'requirements.txt', '.venv', 'venv'],
  configuration: { useLibraryCodeForTypes: true, autoSearchPaths: true }
}
const ENVIRONMENT_FOLDERS = ['.venv', 'venv', 'env']

export function serverSpec() {
  return SERVER
}

function join(root, ...parts) {
  const separator = root.includes('\\') ? '\\' : '/'
  return [root.replace(/[\\/]+$/, ''), ...parts].join(separator)
}

// projectInterpreters finds virtual environments at the top of the workspace:
// <folder>/Scripts/python.exe on Windows, <folder>/bin/python elsewhere.
export async function projectInterpreters(delg) {
  const root = String((await delg.workspace.getRoot()) || '')
  if (!root) return []
  const top = await delg.workspace.listFiles('').catch(() => [])
  const found = []
  for (const entry of top) {
    if (!entry.isDir || !ENVIRONMENT_FOLDERS.includes(entry.name)) continue
    const inside = await delg.workspace.listFiles(entry.name).catch(() => [])
    if (inside.some((item) => item.isDir && item.name === 'Scripts')) found.push(join(root, entry.name, 'Scripts', 'python.exe'))
    else if (inside.some((item) => item.isDir && item.name === 'bin')) found.push(join(root, entry.name, 'bin', 'python'))
  }
  return found
}

async function chooseInterpreter(delg) {
  const current = String(delg.workspace.getConfiguration('delg.python-language.interpreter') || '')
  const choices = [
    ...(await projectInterpreters(delg)).map((path) => ({ label: path, path })),
    { label: 'Detect automatically', path: '' },
    { label: 'Enter a path…', enter: true }
  ]
  const choice = await delg.ui.showQuickPick(choices.map(({ label }) => ({ label })), {
    title: 'Python interpreter' + (current ? ': ' + current : ' (detected automatically)')
  })
  const picked = choice && choices.find(({ label }) => label === choice.label)
  if (!picked) return
  let path = picked.path
  if (picked.enter) {
    path = await delg.ui.showInputBox({ title: 'Python interpreter path', value: current, placeHolder: 'C:\\Python312\\python.exe or /usr/bin/python3' })
    if (path === undefined || path === null) return
    path = String(path).trim()
  }
  if (path === current) return
  // Saving the setting restarts the server, which then uses it.
  await delg.workspace.updateConfiguration('delg.python-language.interpreter', path, 'global')
}

export default function activate(delg) {
  delg.registerCommand('delg.python-language.chooseInterpreter', 'Python: Choose Interpreter', () => chooseInterpreter(delg))
  return languageServerUi(delg, {
    prefix: 'delg.python-language',
    name: 'Python',
    spec: serverSpec,
    help: 'Python support runs Pyright on Node.js and downloads it from npm the first time it starts. Install Node.js 18 or newer from nodejs.org if you have not, check your internet connection, then run "Python: Restart Language Server". To change which Python it uses, run "Python: Choose Interpreter".',
    extraActions: [{ label: 'Choose interpreter', run: () => chooseInterpreter(delg) }]
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
