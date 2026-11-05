import test from 'node:test'
import assert from 'node:assert/strict'
import activate, { serverSpec } from './plugin.js'
import { fakeIde as baseFakeIde, loadManifest } from '../test-support/fake-ide.mjs'

// The fake enforces the capabilities this plugin's manifest declares.
const manifest = loadManifest(import.meta.url)
const fakeIde = (settings, options) => baseFakeIde(settings, { manifest, root: 'C:\\workspace', ...options })
const settle = () => new Promise((resolve) => setImmediate(resolve))

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
  const ide = fakeIde()
  const dispose = activate(ide.delg)
  await settle()
  assert.equal(ide.registered.length, 1)
  assert.equal(ide.registered[0].id, serverSpec().id)
  assert.equal(ide.registered[0].configuration.workspaceFolder.name, 'workspace')
  for (const command of ['restart', 'setupHelp', 'showStatus']) assert.ok(ide.commands.has('delg.eslint.' + command))
  assert.equal(ide.statusBar.get('delg.eslint.status').command, 'delg.eslint.showStatus')

  await ide.delg.workspace.updateConfiguration('delg.eslint.someSetting', true)
  await settle()
  assert.equal(ide.registered.length, 2)

  dispose()
  assert.equal(ide.disposed, 2)
})

test('the status bar labels every language server status', async () => {
  const ide = fakeIde()
  activate(ide.delg)
  await settle()
  const item = ide.statusBar.get('delg.eslint.status')
  const expected = {
    inactive: 'ESLint: inactive',
    starting: 'ESLint: starting…',
    running: 'ESLint',
    stopping: 'ESLint: stopping…',
    stopped: 'ESLint',
    error: 'ESLint: not running',
    paused: 'ESLint: not running'
  }
  for (const [status, text] of Object.entries(expected)) {
    ide.servers[0].emit(status)
    assert.equal(item.text, text, status)
  }
  assert.equal(ide.warnings.length, 1)
})

test('the plugin only uses capabilities its manifest declares', async () => {
  const ide = fakeIde({}, { manifest: { ...manifest, capabilities: manifest.capabilities.filter((name) => name !== 'language-servers') } })
  activate(ide.delg)
  await settle()
  assert.equal(ide.registered.length, 0)
  assert.equal(ide.warnings.length, 1)

  // The host rejects getRoot without workspace-read; the plugin must not need it.
  await assert.rejects(fakeIde().delg.workspace.getRoot(), /workspace-read capability is required/)
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
