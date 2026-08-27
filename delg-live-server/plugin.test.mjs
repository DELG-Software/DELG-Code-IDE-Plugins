import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

test('manifest declares the sandboxed live-server contract', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
  assert.equal(manifest.schemaVersion, 2)
  assert.equal(manifest.id, 'delg.live-server')
  assert.ok(manifest.capabilities.includes('local-static-server'))
  assert.ok(manifest.capabilities.includes('workspace-watch'))
  assert.ok(!manifest.capabilities.includes('full-host'))
})

test('plugin exposes the four server commands', async () => {
  const source = await readFile(join(root, 'plugin.js'), 'utf8')
  for (const command of ['delg.live-server.start', 'delg.live-server.stop', 'delg.live-server.restart', 'delg.live-server.open']) {
    assert.match(source, new RegExp(command.replaceAll('.', '\\.') ))
  }
})
