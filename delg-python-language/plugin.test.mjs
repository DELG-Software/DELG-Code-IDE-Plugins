import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import activate, { projectInterpreters, serverSpec } from './plugin.js'
import { fakeIde } from '../test-support/fake-ide.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function withWorkspace(ide, workspaceRoot, folders) {
  ide.delg.workspace.getRoot = async () => workspaceRoot
  ide.delg.workspace.listFiles = async (path) => folders[path] || []
  return ide
}

test('the registered server matches the manifest declaration', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
  assert.deepEqual(serverSpec(), manifest.contributes.languageServers[0])
  const commands = manifest.contributes.commands.map(({ command }) => command)
  assert.ok(commands.includes('delg.python-language.chooseInterpreter'))
  assert.ok(commands.includes('delg.python-language.showStatus'))
  assert.ok(manifest.capabilities.includes('workspace-list'))
})

test('virtual environments at the top of the workspace are offered', async () => {
  const windows = withWorkspace(fakeIde(), 'C:\\work\\app', {
    '': [{ name: '.venv', isDir: true }, { name: 'src', isDir: true }, { name: 'venv', isDir: false }],
    '.venv': [{ name: 'Scripts', isDir: true }]
  })
  assert.deepEqual(await projectInterpreters(windows.delg), ['C:\\work\\app\\.venv\\Scripts\\python.exe'])

  const unix = withWorkspace(fakeIde(), '/home/me/app/', {
    '': [{ name: 'env', isDir: true }, { name: 'venv', isDir: true }],
    env: [{ name: 'bin', isDir: true }],
    venv: [{ name: 'lib', isDir: true }]
  })
  assert.deepEqual(await projectInterpreters(unix.delg), ['/home/me/app/env/bin/python'])
})

test('choosing an interpreter saves it and restarts the server', async () => {
  const ide = withWorkspace(fakeIde(), '/app', { '': [{ name: '.venv', isDir: true }], '.venv': [{ name: 'bin', isDir: true }] })
  activate(ide.delg)
  await settle()
  assert.equal(ide.registered.length, 1)

  ide.picks.push({ label: '/app/.venv/bin/python' })
  await ide.commands.get('delg.python-language.chooseInterpreter')()
  await settle()
  assert.equal(ide.settings['delg.python-language.interpreter'], '/app/.venv/bin/python')
  assert.equal(ide.registered.length, 2)

  ide.picks.push({ label: 'Enter a path…' }, '  /usr/bin/python3 ')
  await ide.commands.get('delg.python-language.chooseInterpreter')()
  assert.equal(ide.settings['delg.python-language.interpreter'], '/usr/bin/python3')

  ide.picks.push({ label: 'Detect automatically' })
  await ide.commands.get('delg.python-language.chooseInterpreter')()
  assert.equal(ide.settings['delg.python-language.interpreter'], '')

  ide.picks.push(undefined)
  await ide.commands.get('delg.python-language.chooseInterpreter')()
  assert.equal(ide.settings['delg.python-language.interpreter'], '')
})

test('the status menu offers the interpreter picker', async () => {
  const ide = withWorkspace(fakeIde(), '/app', {})
  activate(ide.delg)
  await settle()
  ide.picks.push(undefined)
  await ide.commands.get('delg.python-language.showStatus')()
  assert.deepEqual(ide.lastPick.items.map(({ label }) => label), ['Choose interpreter', 'Restart language server', 'Show setup help'])
})
