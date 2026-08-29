import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { unzipSync } from '../../DELG-Code/ide/node_modules/fflate/esm/index.mjs'
import { buildPlugin, validateManifest } from './build.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(root, 'src', 'plugin.js'), 'utf8')
const { default: activate } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))

function host(overrides = {}) {
  const calls = { icons: [], statusItems: [], statuses: [], messages: [], disposed: 0, iconDisposals: 0, statusDisposals: 0 }
  const delg = {
    ...overrides,
    ui: {
      registerExplorerIcon(extension, icon) { calls.icons.push([extension, icon]); return () => { calls.iconDisposals++ } },
      registerStatusBarItem(...args) { calls.statusItems.push(args); return () => { calls.statusDisposals++ } },
      setStatus(value) { calls.statuses.push(value) },
      showMessage(value) { calls.messages.push(value) },
      ...overrides.ui
    },
    registerCommand(id, title, callback) {
      calls.command = { id, title, callback }
      return () => { calls.disposed++ }
    }
  }
  return { delg, calls }
}

describe('activation', () => {
  test('registers more than 120 unique valid extension icons', () => {
    const { delg, calls } = host()
    activate(delg)
    assert.ok(calls.icons.length > 120)
    assert.equal(new Set(calls.icons.map(([extension]) => extension)).size, calls.icons.length)
    for (const [extension, icon] of calls.icons) {
      assert.match(extension, /^\.[a-z0-9]+$/i)
      assert.match(icon.path, /^m[0-9\s.,+\-a-z]+$/i)
      assert.match(icon.color, /^#[0-9a-f]{6}$/i)
    }
  })

  test('reports status and the registered icon count', async () => {
    const { delg, calls } = host()
    activate(delg)
    assert.match(calls.statusItems[0][1], /^\d+ Material icons$/)
    assert.match(calls.statuses[0], /^Material File Icons: \d+ SVG icons registered$/)
    assert.equal(calls.command.id, manifest.contributes.commands[0].command)
    await calls.command.callback()
    assert.match(calls.messages[0], /^Material File Icons registered \d+ Explorer SVG icons\.$/)
  })

  test('cleanup is idempotent', () => {
    const { delg, calls } = host()
    const dispose = activate(delg)
    dispose(); dispose()
    assert.equal(calls.disposed, 1)
    assert.equal(calls.iconDisposals, calls.icons.length)
    assert.equal(calls.statusDisposals, 1)
  })

  test('handles fulfilled and rejected host promises without unhandled rejections', async () => {
    const unhandled = []
    const listener = (reason) => unhandled.push(reason)
    const originalWarn = console.warn
    process.on('unhandledRejection', listener)
    console.warn = () => {}
    try {
      activate(host({ ui: { registerStatusBarItem: () => Promise.reject(new Error('status')) } }).delg)
      activate(host({ ui: { registerStatusBarItem: () => Promise.resolve() } }).delg)
      await new Promise((resolve) => setImmediate(resolve))
      assert.deepEqual(unhandled, [])
    } finally { console.warn = originalWarn; process.off('unhandledRejection', listener) }
  })
})

describe('manifest schema', () => {
  test('declares the schema-v2 Trusted UI contract', () => {
    assert.equal(manifest.schemaVersion, 2)
    assert.equal(manifest.engines.delgIde, '>=0.17.2')
    for (const capability of ['commands', 'explorer-icons', 'status', 'status-bar', 'trusted-ui']) {
      assert.ok(manifest.capabilities.includes(capability))
    }
    assert.ok(!manifest.capabilities.includes('full-host'))
    assert.doesNotThrow(() => validateManifest(manifest))
  })
  test('rejects traversal, non-strict versions, old engines, and partial source', () => {
    for (const patch of [
      { schemaVersion: 1 }, { entry: '../plugin.js' }, { version: '1.2' }, { engines: { delgIde: '>=0.17.1' } },
      { source: { repository: 'https://github.com/delg/material-file-icons' } },
      { source: { repository: 'http://github.com/delg/material-file-icons', commit: 'a'.repeat(40) } }
    ]) assert.throws(() => validateManifest({ ...manifest, ...patch }))
  })
})

describe('package', () => {
  let fixture
  before(async () => {
    fixture = await mkdtemp(join(tmpdir(), 'material-file-icons-test-'))
    for (const path of ['manifest.json', 'src/plugin.js', 'media/icon.png', 'media/overview.png']) {
      const target = join(fixture, ...path.split('/'))
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, await readFile(join(root, ...path.split('/'))))
    }
  })
  after(async () => { await rm(fixture, { recursive: true, force: true }) })

  test('builds exact manifest-driven contents with source/dist parity', async () => {
    const result = await buildPlugin(fixture)
    assert.deepEqual(result.files.sort(), ['dist/plugin.js', 'manifest.json', 'media/icon.png', 'media/overview.png'])
    const archive = unzipSync(await readFile(result.output))
    assert.deepEqual(Object.keys(archive).sort(), result.files.sort())
    assert.deepEqual(Buffer.from(archive['dist/plugin.js']), await readFile(join(fixture, 'src/plugin.js')))
    assert.deepEqual(await readFile(join(fixture, 'dist/plugin.js')), await readFile(join(fixture, 'src/plugin.js')))
    assert.match(result.sha256, /^[0-9a-f]{64}$/)
    const repeated = await buildPlugin(fixture)
    assert.equal(repeated.sha256, result.sha256)
  })
})
