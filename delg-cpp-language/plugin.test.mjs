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
  assert.deepEqual(manifest.contributes.languageServers[0].languages, ['c', 'cpp'])
  const commands = manifest.contributes.commands.map(({ command }) => command)
  assert.deepEqual(commands, ['delg.cpp-language.restart', 'delg.cpp-language.setupHelp', 'delg.cpp-language.showStatus'])
})

test('settings become clangd flags', () => {
  assert.deepEqual(serverSpec(fakeIde().delg).args, ['--background-index', '--clang-tidy', '--header-insertion=iwyu'])
  const ide = fakeIde({
    'delg.cpp-language.clangTidy': false,
    'delg.cpp-language.headerInsertion': 'never',
    'delg.cpp-language.compileCommandsDir': ' out/build '
  })
  assert.deepEqual(serverSpec(ide.delg).args, ['--background-index', '--clang-tidy=false', '--header-insertion=never', '--compile-commands-dir=out/build'])
})

test('the status bar follows the server and a settings change restarts it', async () => {
  const ide = fakeIde()
  const dispose = activate(ide.delg)
  await settle()
  const item = ide.statusBar.get('delg.cpp-language.status')
  ide.servers.at(-1).emit('starting')
  assert.equal(item.text, 'C/C++: starting…')
  ide.servers.at(-1).emit('error')
  assert.match(ide.warnings[0], /clangd/)
  assert.match(ide.warnings[0], /CMAKE_EXPORT_COMPILE_COMMANDS/)

  await ide.delg.workspace.updateConfiguration('delg.cpp-language.clangTidy', false)
  await settle()
  assert.equal(ide.registered.length, 2)
  assert.ok(ide.registered.at(-1).args.includes('--clang-tidy=false'))
  dispose()
  assert.equal(ide.disposed, 2)
})
