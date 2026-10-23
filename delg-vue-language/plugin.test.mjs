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
  assert.deepEqual(serverSpec(), manifest.contributes.languageServers[0])
  assert.deepEqual(manifest.contributes.commands.map(({ command }) => command), ['delg.vue-language.restart', 'delg.vue-language.setupHelp', 'delg.vue-language.showStatus'])
})

test('the status bar shows the Vue server', async () => {
  const ide = fakeIde()
  activate(ide.delg)
  await settle()
  assert.equal(ide.statusBar.get('delg.vue-language.status').text, 'Vue')
  ide.servers.at(-1).emit('error')
  assert.match(ide.warnings[0], /Vue: Restart Language Server/)
})
