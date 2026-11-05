const LANGUAGES = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact']

const SERVER = {
  id: 'delg.eslint.language-server',
  languages: LANGUAGES,
  command: '',
  entrypoint: 'servers/eslint-language-server.mjs',
  args: ['--stdio'],
  supplemental: true,
  projectMarkers: [
    'package.json',
    'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs',
    'eslint.config.ts', 'eslint.config.mts',
    '.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json',
    '.eslintrc.yaml', '.eslintrc.yml'
  ],
  configuration: {
    packageManager: 'npm',
    nodePath: null,
    experimental: { useFlatConfig: false },
    useESLintClass: true,
    options: {},
    rulesCustomizations: [],
    problems: { shortenToSingleLine: false },
    codeAction: {
      disableRuleComment: { enable: false, location: 'separateLine', commentStyle: 'line' },
      showDocumentation: { enable: false }
    },
    format: false,
    quiet: false,
    onIgnoredFiles: 'off',
    validate: 'on',
    run: 'onType',
    probe: LANGUAGES,
    workingDirectory: { mode: 'location' },
    codeActionOnSave: { enable: true, mode: 'all' }
  }
}

function fileUri(path) {
  const normalized = String(path).replace(/\\/g, '/')
  const encoded = (value) => value.split('/').map((part) => encodeURIComponent(part)).join('/')
  if (/^[A-Za-z]:\//.test(normalized)) return 'file:///' + normalized.slice(0, 2) + encoded(normalized.slice(2))
  if (normalized.startsWith('//')) {
    const [host, ...parts] = normalized.slice(2).split('/')
    return 'file://' + host + '/' + parts.map((part) => encodeURIComponent(part)).join('/')
  }
  if (normalized.startsWith('/')) return 'file://' + encoded(normalized)
  return 'file:///' + encoded(normalized)
}

function folderName(path) {
  const parts = String(path).replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || String(path)
}

export function serverSpec(root = '') {
  const configuration = { ...SERVER.configuration }
  if (root) configuration.workspaceFolder = { uri: fileUri(root), name: folderName(root) }
  return { ...SERVER, configuration }
}

export default function activate(delg) {
  const prefix = 'delg.eslint'
  const name = 'ESLint'
  const help = 'ESLint support runs on Node.js 18 or newer and uses the ESLint package installed in your project. Install ESLint in the workspace (for example, npm install --save-dev eslint@9), add an ESLint config, and run "ESLint: Restart Language Server". ESLint 10 is not supported by this bundled server.'
  const statusId = prefix + '.status'
  const labels = {
    inactive: name + ': inactive',
    starting: name + ': starting…',
    running: name,
    stopping: name + ': stopping…',
    stopped: name,
    error: name + ': not running',
    paused: name + ': not running'
  }
  const quiet = (promise) => { Promise.resolve(promise).catch(() => undefined) }
  let server = null
  let warned = false
  let disposed = false
  let queue = Promise.resolve()

  const show = (status) => {
    quiet(delg.ui.updateStatusBarItem(statusId, labels[status] || ''))
    if ((status === 'error' || status === 'paused') && !warned) {
      warned = true
      quiet(delg.ui.showWarningMessage(help))
    }
    if (status === 'running') warned = false
  }

  const ready = Promise.resolve(delg.ui.createStatusBarItem(statusId, '', 'ESLint language server', prefix + '.showStatus')).catch(() => undefined)
  const register = async () => {
    await ready
    if (disposed) return
    if (server) server.dispose()
    server = null
    try {
      const root = String(delg.workspace.root || '')
      const registered = await delg.languageServers.register(serverSpec(root))
      if (disposed) return registered.dispose()
      server = registered
      server.onDidChangeStatus(show)
      show(server.status)
    } catch (error) {
      quiet(delg.ui.updateStatusBarItem(statusId, labels.error))
      quiet(delg.ui.setStatus(name + ': ' + String((error && error.message) || error).slice(0, 200)))
      if (!warned) {
        warned = true
        quiet(delg.ui.showWarningMessage(help))
      }
    }
  }
  const reportUnexpectedFailure = (error) => {
    quiet(delg.ui.updateStatusBarItem(statusId, labels.error))
    quiet(delg.ui.setStatus(name + ': ' + String((error && error.message) || error).slice(0, 200)))
    if (!warned) {
      warned = true
      quiet(delg.ui.showWarningMessage(help))
    }
  }
  // Keep a single restart queue, but recover it if a lifecycle operation
  // fails outside the guarded registration block.
  const restart = () => (queue = queue.catch(() => undefined).then(register).catch(reportUnexpectedFailure))
  const showHelp = () => quiet(delg.ui.showInformationMessage(help))

  delg.registerCommand(prefix + '.restart', name + ': Restart Language Server', restart)
  delg.registerCommand(prefix + '.setupHelp', name + ': Show Setup Help', showHelp)
  delg.registerCommand(prefix + '.showStatus', name + ': Language Server Status', async () => {
    const actions = [
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
