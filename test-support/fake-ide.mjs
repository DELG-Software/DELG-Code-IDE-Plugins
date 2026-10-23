// fakeIde is the slice of the plugin API the language plugins use.
export function fakeIde(settings = {}) {
  const ide = {
    commands: new Map(), statusBar: new Map(), warnings: [], infos: [], registered: [], disposed: 0,
    configListeners: [], picks: [], settings: { ...settings }, servers: []
  }
  ide.delg = {
    registerCommand: (id, _title, run) => ide.commands.set(id, run),
    ui: {
      createStatusBarItem: async (id, text, tooltip, command) => { ide.statusBar.set(id, { text, tooltip, command }) },
      updateStatusBarItem: async (id, text) => { ide.statusBar.get(id).text = text },
      showWarningMessage: async (text) => { ide.warnings.push(text) },
      showInformationMessage: async (text) => { ide.infos.push(text) },
      setStatus: async () => {},
      showQuickPick: async (items, options) => { ide.lastPick = { items, options }; return ide.picks.shift() },
      showInputBox: async () => ide.picks.shift()
    },
    workspace: {
      getConfiguration: (key) => ide.settings[key],
      updateConfiguration: async (key, value) => { ide.settings[key] = value; for (const listener of ide.configListeners) listener(key) },
      onDidChangeConfiguration: (listener) => { ide.configListeners.push(listener); return () => {} }
    },
    languageServers: {
      register: async (spec) => {
        ide.registered.push(spec)
        const listeners = new Set()
        const server = {
          status: 'stopped',
          onDidChangeStatus: (listener) => { listeners.add(listener) },
          dispose: () => { ide.disposed++ },
          emit: (status) => { server.status = status; for (const listener of listeners) listener(status) }
        }
        ide.servers.push(server)
        return server
      }
    }
  }
  return ide
}
