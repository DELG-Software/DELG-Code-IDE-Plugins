import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import activate, { serverSpec } from './plugin.js'
import { fakeIde as baseFakeIde, loadManifest } from '../test-support/fake-ide.mjs'

const manifest = loadManifest(import.meta.url)
const fakeIde = (settings, options) => baseFakeIde(settings, { manifest, ...options })
const root = dirname(fileURLToPath(import.meta.url))
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

test('the registered server matches the manifest and debugging is declared', async () => {
  const declared = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
  assert.deepEqual(serverSpec(fakeIde().delg), declared.contributes.languageServers[0])
  assert.ok(declared.capabilities.includes('debugging'))
})

test('unloading Go disposes a debug adapter registration that arrives late', async () => {
  const ide = fakeIde()
  let finishRegistration
  let disposals = 0
  ide.delg.debugging = {
    registerAdapter(declaration) {
      assert.deepEqual(declaration, { id: 'delg.go-language.delve', kind: 'delve' })
      return new Promise((resolve) => { finishRegistration = resolve })
    }
  }
  const dispose = activate(ide.delg)
  dispose()
  finishRegistration({ id: 'delg.go-language.delve', dispose: () => { disposals++ } })
  await settle()
  assert.equal(disposals, 1)
})
