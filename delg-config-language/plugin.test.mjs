import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import activate, { JSON_SCHEMAS, serverSpecs } from './plugin.js'
import { fakeIde } from '../test-support/fake-ide.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

test('the registered servers match the manifest declarations', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
  assert.deepEqual(serverSpecs(fakeIde().delg), manifest.contributes.languageServers)
  const languages = manifest.contributes.languageServers.flatMap(({ languages }) => languages)
  assert.deepEqual(languages, ['yaml', 'json', 'jsonc', 'toml'])
})

test('every server entrypoint and schema association is well formed', async () => {
  for (const spec of serverSpecs(fakeIde().delg)) {
    await readFile(join(root, spec.entrypoint), 'utf8')
  }
  for (const { fileMatch, url } of JSON_SCHEMAS) {
    assert.ok(fileMatch.length > 0)
    assert.match(url, /^https:\/\//)
  }
})

test('turning SchemaStore off removes the schemas and restarts the servers', async () => {
  const ide = fakeIde()
  activate(ide.delg)
  await settle()
  assert.equal(ide.registered.length, 3)

  await ide.delg.workspace.updateConfiguration('delg.config-language.schemaStore', false)
  await settle()
  assert.equal(ide.registered.length, 6)
  assert.equal(ide.disposed, 3)
  const [yaml, json] = ide.registered.slice(3)
  assert.equal(yaml.configuration.yaml.schemaStore.enable, false)
  assert.deepEqual(json.configuration.json.schemas, [])

  await ide.delg.workspace.updateConfiguration('editor.fontSize', 14)
  await settle()
  assert.equal(ide.registered.length, 6)
})

test('a server that cannot start warns once until one runs', async () => {
  const ide = fakeIde()
  activate(ide.delg)
  await settle()
  ide.servers[0].emit('error')
  ide.servers[1].emit('error')
  assert.equal(ide.warnings.length, 1)
  assert.match(ide.warnings[0], /Node\.js 18/)
  ide.servers[0].emit('running')
  ide.servers[2].emit('paused')
  assert.equal(ide.warnings.length, 2)
})

test('the commands restart the servers and show the help', async () => {
  const ide = fakeIde()
  const dispose = activate(ide.delg)
  await settle()
  await ide.commands.get('delg.config-language.restart')()
  assert.equal(ide.registered.length, 6)
  await ide.commands.get('delg.config-language.setupHelp')()
  assert.equal(ide.infos.length, 1)
  dispose()
  assert.equal(ide.disposed, 6)
})
