import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Capability the host requires for each part of the plugin API (see the
// broker's request.go and the sandbox bridge). Calls to anything listed here
// are rejected unless the plugin's manifest declares the capability. Parts the
// host never gates (for example delg.workspace.root and the configuration
// getters) are not listed.
export const REQUIRED_CAPABILITIES = {
  registerCommand: 'commands',
  'languageServers.register': 'language-servers',
  'workspace.getRoot': 'workspace-read',
  'workspace.readFile': 'workspace-read',
  'workspace.listFiles': 'workspace-list',
  'workspace.writeFile': 'workspace-write',
  'workspace.watch': 'workspace-watch',
  'storage.get': 'storage',
  'storage.set': 'storage',
  'storage.delete': 'storage',
  'servers.startStatic': 'local-static-server',
  'tasks.start': 'managed-tasks',
  'testing.createController': 'testing',
  'sourceControl.createProvider': 'source-control',
  'editor.getActiveDocument': 'editor-read',
  'ui.openFile': 'editor-open',
  'ui.openExternal': 'open-external',
  'ui.showInformationMessage': 'status',
  'ui.showWarningMessage': 'status',
  'ui.showQuickPick': 'status',
  'ui.showInputBox': 'status',
  'ui.setStatus': 'status',
  'ui.createStatusBarItem': 'status-bar',
  'ui.updateStatusBarItem': 'status-bar'
}

const SYNCHRONOUS = new Set(['registerCommand', 'workspace.watch', 'testing.createController'])

// loadManifest reads manifest.json next to the test file that passes its
// import.meta.url.
export function loadManifest(metaUrl) {
  return JSON.parse(readFileSync(join(dirname(fileURLToPath(metaUrl)), 'manifest.json'), 'utf8'))
}

// enforceCapabilities wraps the functions of an existing delg object so each
// call fails the way the host does when the manifest lacks the capability.
export function enforceCapabilities(delg, manifest) {
  const declared = new Set(manifest.capabilities || [])
  for (const [path, capability] of Object.entries(REQUIRED_CAPABILITIES)) {
    const parts = path.split('.')
    const name = parts.pop()
    let owner = delg
    for (const part of parts) owner = owner && owner[part]
    if (!owner || typeof owner[name] !== 'function') continue
    const original = owner[name]
    owner[name] = (...args) => {
      if (!declared.has(capability)) {
        const error = new Error(capability + ' capability is required')
        // Synchronous APIs throw; async ones reject like the broker.
        if (SYNCHRONOUS.has(path)) throw error
        return Promise.reject(error)
      }
      return original.apply(owner, args)
    }
  }
  return delg
}

// A disposable like the real API's: a function that also has dispose().
function disposable(fn) {
  const dispose = () => fn()
  dispose.dispose = dispose
  return dispose
}

// fakeIde is the slice of the plugin API the plugins use. Pass the plugin's
// manifest (loadManifest(import.meta.url)) to enforce its capabilities, a
// workspace root, and folders: a map from a workspace-relative path to the
// directory entries ({ name, isDir }) listFiles returns for it.
export function fakeIde(settings = {}, { manifest, root = '', folders = {} } = {}) {
  const ide = {
    commands: new Map(), statusBar: new Map(), warnings: [], infos: [], registered: [], disposed: 0,
    configListeners: [], picks: [], settings: { ...settings }, servers: [], providers: [], taskStarts: [], openedFiles: [], root, folders
  }
  ide.delg = {
    registerCommand: (id, _title, run) => {
      ide.commands.set(id, run)
      return disposable(() => { if (ide.commands.get(id) === run) ide.commands.delete(id) })
    },
    ui: {
      createStatusBarItem: async (id, text, tooltip, command) => {
        ide.statusBar.set(id, { text, tooltip, command })
        return { id, text, tooltip, command, dispose: () => { ide.statusBar.delete(id) } }
      },
      updateStatusBarItem: async (id, text) => {
        const item = ide.statusBar.get(id)
        if (!item) throw new Error('unknown status bar item: ' + id)
        item.text = text
      },
      showWarningMessage: async (text) => { ide.warnings.push(text) },
      openFile: async (path) => { ide.openedFiles.push(path) },
      showInformationMessage: async (text) => { ide.infos.push(text) },
      setStatus: async () => {},
      showQuickPick: async (items, options) => { ide.lastPick = { items, options }; return ide.picks.shift() },
      showInputBox: async () => ide.picks.shift()
    },
    workspace: {
      get root() { return ide.root },
      getRoot: async () => ide.root,
      listFiles: async (path = '') => (ide.folders[path] || []).map((entry) => ({ ...entry })),
      getConfiguration: (key) => ide.settings[key],
      updateConfiguration: async (key, value) => { ide.settings[key] = value; for (const listener of [...ide.configListeners]) listener(key) },
      onDidChangeConfiguration: (listener) => {
        ide.configListeners.push(listener)
        return disposable(() => { ide.configListeners = ide.configListeners.filter((item) => item !== listener) })
      }
    },
    languageServers: {
      register: async (spec) => {
        ide.registered.push(spec)
        const listeners = new Set()
        const server = {
          status: 'stopped',
          onDidChangeStatus: (listener) => {
            listeners.add(listener)
            return disposable(() => listeners.delete(listener))
          },
          dispose: () => { ide.disposed++ },
          emit: (status) => { server.status = status; for (const listener of listeners) listener(status) }
        }
        ide.servers.push(server)
        return server
      }
    },
    sourceControl: {
      createProvider: async ({ id, label, groups = [] }) => {
        let snapshotId = 'r0:0'
        let disposed = false
        const refreshListeners = new Set()
        const actionListeners = new Set()
        const provider = {
          id,
          label,
          groups,
          error: '',
          refreshListeners,
          actionListeners,
          get snapshotId() { return snapshotId },
          refresh: async () => { await provider.requestRefresh() },
          setGroups: async (next, expected = snapshotId) => {
            if (disposed) throw new Error('source-control provider is no longer active')
            if (expected !== snapshotId) throw new Error('source-control provider snapshot is stale')
            provider.groups = next
            provider.error = ''
            snapshotId = `r0:${Number(snapshotId.slice(3)) + 1}`
          },
          setError: async (message, expected = snapshotId) => {
            if (disposed) throw new Error('source-control provider is no longer active')
            if (expected !== snapshotId) throw new Error('source-control provider snapshot is stale')
            provider.error = message || ''
          },
          onDidRequestRefresh: (listener) => { refreshListeners.add(listener); return disposable(() => refreshListeners.delete(listener)) },
          onDidRunAction: (listener) => { actionListeners.add(listener); return disposable(() => actionListeners.delete(listener)) },
          requestRefresh: async () => { await Promise.all([...refreshListeners].map(listener => listener({ providerId: id, snapshotId }))) },
          runAction: async (event) => {
            const group = provider.groups.find(item => item.id === event.groupId)
            const resource = group?.resources.find(item => item.id === event.resourceId)
            const action = resource?.actions?.find(item => item.id === event.actionId)
            if (!group || !resource || !action) return
            await Promise.all([...actionListeners].map(listener => listener({ providerId: id, snapshotId, path: resource.path, kind: group.kind, ...event })))
          },
          dispose() { disposed = true; refreshListeners.clear(); actionListeners.clear() }
        }
        ide.providers.push(provider)
        return provider
      }
    }
  }
  ide.delg.tasks = {
    start: async (options) => {
      ide.taskStarts.push(options)
      throw new Error('managed task runner is not configured')
    }
  }
  if (manifest) enforceCapabilities(ide.delg, manifest)
  return ide
}
