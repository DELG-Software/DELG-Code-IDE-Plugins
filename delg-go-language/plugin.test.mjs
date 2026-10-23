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
  assert.deepEqual(serverSpec({ workspace: { getConfiguration: () => undefined } }), manifest.contributes.languageServers[0])
  const commands = manifest.contributes.commands.map(({ command }) => command)
  assert.deepEqual(commands, ['delg.go-language.restart', 'delg.go-language.setupHelp', 'delg.go-language.showStatus'])
  for (const capability of ['commands', 'status-bar', 'language-servers']) assert.ok(manifest.capabilities.includes(capability))
})

test('settings become gopls configuration', () => {
  const ide = fakeIde({ 'delg.go-language.staticcheck': false, 'delg.go-language.buildTags': ' integration, linux ,' })
  const spec = serverSpec(ide.delg)
  assert.equal(spec.configuration.staticcheck, false)
  assert.deepEqual(spec.configuration.buildFlags, ['-tags=integration,linux'])
  assert.deepEqual(spec.configuration.analyses, { unusedparams: true })
})

test('the status bar follows the server and setup help shows once per failure', async () => {
  const ide = fakeIde()
  activate(ide.delg)
  await settle()
  const item = ide.statusBar.get('delg.go-language.status')
  assert.equal(item.command, 'delg.go-language.showStatus')
  assert.equal(item.text, 'Go')

  const server = ide.servers.at(-1)
  server.emit('starting')
  assert.equal(item.text, 'Go: starting…')
  server.emit('error')
  server.emit('paused')
  assert.equal(item.text, 'Go: not running')
  assert.equal(ide.warnings.length, 1)
  assert.match(ide.warnings[0], /go install golang\.org\/x\/tools\/gopls@latest/)
  server.emit('running')
  server.emit('error')
  assert.equal(ide.warnings.length, 2)
  server.emit('inactive')
  assert.equal(item.text, '')
})

test('restart and a settings change register the server again', async () => {
  const ide = fakeIde()
  const dispose = activate(ide.delg)
  await settle()
  assert.equal(ide.registered.length, 1)

  await ide.commands.get('delg.go-language.restart')()
  assert.equal(ide.registered.length, 2)
  assert.equal(ide.disposed, 1)

  await ide.delg.workspace.updateConfiguration('delg.go-language.buildTags', 'e2e')
  await ide.delg.workspace.updateConfiguration('other.plugin.key', 'x')
  await settle()
  assert.equal(ide.registered.length, 3)
  assert.deepEqual(ide.registered.at(-1).configuration.buildFlags, ['-tags=e2e'])

  ide.picks.push({ label: 'Restart language server' })
  await ide.commands.get('delg.go-language.showStatus')()
  await settle()
  assert.equal(ide.registered.length, 4)
  assert.match(ide.lastPick.options.title, /^Go language server: /)

  dispose()
  assert.equal(ide.disposed, 4)
  await ide.commands.get('delg.go-language.restart')()
  assert.equal(ide.registered.length, 4)
})

test('the language plugins share one copy of the status code', async () => {
  const marker = '// --- Shared by the DELG language plugins; keep the copies identical. ---'
  const shared = async (folder) => {
    const source = await readFile(join(root, '..', folder, 'plugin.js'), 'utf8')
    return source.slice(source.indexOf(marker))
  }
  const go = await shared('delg-go-language')
  assert.ok(go.startsWith(marker))
  assert.equal(await shared('delg-vue-language'), go)
  assert.equal(await shared('delg-python-language'), go)
  assert.equal(await shared('delg-rust-language'), go)
  assert.equal(await shared('delg-cpp-language'), go)
})

test('a server the IDE refuses shows the setup help', async () => {
  const ide = fakeIde()
  ide.delg.languageServers.register = async () => { throw new Error('Node.js was not found') }
  activate(ide.delg)
  await settle()
  assert.equal(ide.statusBar.get('delg.go-language.status').text, 'Go: not running')
  assert.equal(ide.warnings.length, 1)
  await ide.commands.get('delg.go-language.restart')()
  assert.equal(ide.warnings.length, 1)
})
