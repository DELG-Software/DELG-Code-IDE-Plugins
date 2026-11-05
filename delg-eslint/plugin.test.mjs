import test from 'node:test'
import assert from 'node:assert/strict'
import activate, { serverSpec } from './plugin.js'
import { fakeIde } from '../test-support/fake-ide.mjs'

test('declares the supplemental ESLint server for JavaScript and TypeScript', () => {
  assert.deepEqual(serverSpec().languages, ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'])
  assert.equal(serverSpec().entrypoint, 'servers/eslint-language-server.mjs')
  assert.equal(serverSpec().supplemental, true)
  assert.equal(serverSpec().configuration.validate, 'on')
  assert.deepEqual(serverSpec().configuration.probe, serverSpec().languages)
  assert.deepEqual(serverSpec('C:\\work space\\project').configuration.workspaceFolder, {
    uri: 'file:///C:/work%20space/project',
    name: 'project'
  })
  assert.ok(serverSpec().projectMarkers.includes('eslint.config.mjs'))
})

test('registers restart, setup help, status, and server lifecycle', async () => {
  const commands = new Map()
  const uiCalls = []
  const configListeners = []
  let registration
  const delg = {
    registerCommand(id, _title, handler) { commands.set(id, handler) },
    languageServers: {
      async register(spec) {
        registration = spec
        return {
          status: 'running',
          onDidChangeStatus(handler) { this.statusHandler = handler },
          dispose() { uiCalls.push('dispose') }
        }
      }
    },
    workspace: {
      async getRoot() { return 'C:\\workspace' },
      onDidChangeConfiguration(handler) { configListeners.push(handler) }
    },
    ui: {
      createStatusBarItem(...args) { uiCalls.push(['create', ...args]) },
      updateStatusBarItem(...args) { uiCalls.push(['update', ...args]) },
      showWarningMessage(message) { uiCalls.push(['warning', message]) },
      showInformationMessage(message) { uiCalls.push(['info', message]) },
      setStatus(message) { uiCalls.push(['status', message]) },
      async showQuickPick(items) { return items[0] }
    }
  }

  const dispose = activate(delg)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(registration.id, serverSpec().id)
  assert.ok(commands.has('delg.eslint.restart'))
  assert.ok(commands.has('delg.eslint.setupHelp'))
  assert.ok(commands.has('delg.eslint.showStatus'))
  assert.ok(uiCalls.some(([kind, id]) => kind === 'create' && id === 'delg.eslint.status'))

  configListeners[0]('delg.eslint.someSetting')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(uiCalls.filter((call) => Array.isArray(call) && call[0] === 'update').length, 2)

  dispose()
  assert.ok(uiCalls.includes('dispose'))
})

test('a failed lifecycle operation does not block later restarts', async () => {
  const ide = fakeIde()
  ide.delg.workspace.getRoot = async () => 'C:\\workspace'
  activate(ide.delg)
  await new Promise((resolve) => setImmediate(resolve))

  const server = ide.servers.at(-1)
  const dispose = server.dispose
  let failOnce = true
  server.dispose = () => {
    if (failOnce) {
      failOnce = false
      throw new Error('temporary dispose failure')
    }
    return dispose()
  }

  await ide.commands.get('delg.eslint.restart')()
  assert.equal(ide.registered.length, 1)
  assert.equal(ide.statusBar.get('delg.eslint.status').text, 'ESLint: not running')
  assert.equal(ide.warnings.length, 1)

  await ide.commands.get('delg.eslint.restart')()
  assert.equal(ide.registered.length, 2)
  assert.equal(ide.disposed, 1)
})
