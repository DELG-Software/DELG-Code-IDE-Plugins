import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import activate, { serverSpec } from './plugin.js'
import { fakeIde } from '../test-support/fake-ide.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

test('the registered server matches the manifest declaration', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
  assert.deepEqual(serverSpec(fakeIde().delg), manifest.contributes.languageServers[0])
  const commands = manifest.contributes.commands.map(({ command }) => command)
  assert.deepEqual(commands, ['delg.rust-language.restart', 'delg.rust-language.setupHelp', 'delg.rust-language.showStatus'])
  for (const capability of ['commands', 'status-bar', 'language-servers']) assert.ok(manifest.capabilities.includes(capability))
})

test('settings reach rust-analyzer at start and when it asks again', () => {
  const ide = fakeIde({ 'delg.rust-language.checkCommand': 'clippy', 'delg.rust-language.allFeatures': true })
  const { configuration } = serverSpec(ide.delg)
  const expected = { check: { command: 'clippy' }, cargo: { features: 'all' } }
  assert.deepEqual(configuration['rust-analyzer'], expected)
  assert.deepEqual({ check: configuration.check, cargo: configuration.cargo }, expected)

  const defaults = serverSpec(fakeIde({ 'delg.rust-language.checkCommand': 'rm -rf' }).delg).configuration
  assert.deepEqual(defaults['rust-analyzer'], { check: { command: 'check' } })
})

test('the status bar follows the server and a settings change restarts it', async () => {
  const ide = fakeIde()
  const dispose = activate(ide.delg)
  await settle()
  const item = ide.statusBar.get('delg.rust-language.status')
  assert.equal(item.command, 'delg.rust-language.showStatus')
  ide.servers.at(-1).emit('error')
  assert.equal(item.text, 'Rust: not running')
  assert.match(ide.warnings[0], /rustup component add rust-analyzer/)

  await ide.delg.workspace.updateConfiguration('delg.rust-language.checkCommand', 'clippy')
  await settle()
  assert.equal(ide.registered.length, 2)
  assert.equal(ide.registered.at(-1).configuration['rust-analyzer'].check.command, 'clippy')
  dispose()
  assert.equal(ide.disposed, 2)
})
