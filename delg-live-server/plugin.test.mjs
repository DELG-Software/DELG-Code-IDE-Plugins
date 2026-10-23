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
  assert.deepEqual(manifest.images, ['media/files-in-root.png', 'media/command-palette.png'])
})

test('store screenshots are publishable PNGs', async () => {
  for (const filename of ['files-in-root.png', 'command-palette.png']) {
    const image = await readFile(join(root, 'media', filename))
    assert.ok(image.length > 0)
    assert.ok(image.length <= 2 * 1024 * 1024)
    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  }
})

test('plugin exposes the server commands', async () => {
  const source = await readFile(join(root, 'plugin.js'), 'utf8')
  for (const command of ['delg.live-server.start', 'delg.live-server.stop', 'delg.live-server.restart', 'delg.live-server.open', 'delg.live-server.openPage', 'delg.live-server.showUrl', 'delg.live-server.menu']) {
    assert.match(source, new RegExp(command.replaceAll('.', '\\.') ))
  }
})

const { default: activate, hostOf, servedPath, htmlPages } = await import('./plugin.js')

function fakeIde(files = {}, settings = {}) {
  const ide = { commands: new Map(), bar: {}, opened: [], infos: [], picks: [], started: 0, stopped: 0 }
  ide.delg = {
    registerCommand: (id, _title, run) => ide.commands.set(id, run),
    ui: {
      createStatusBarItem: async (id, text, tooltip, command) => { ide.bar = { id, text, tooltip, command } },
      updateStatusBarItem: async (_id, text) => { ide.bar.text = text },
      setStatus: async () => {},
      showInformationMessage: async (text) => { ide.infos.push(text) },
      showQuickPick: async (items, options) => { ide.lastPick = { items, options }; return ide.picks.shift() },
      openExternal: async (url) => { ide.opened.push(url) }
    },
    editor: { getActiveDocument: async () => ide.active },
    workspace: {
      getConfiguration: (key) => settings[key],
      onDidChangeConfiguration: () => () => {},
      listFiles: async (path) => files[path] || []
    },
    servers: {
      startStatic: async () => {
        ide.started++
        return {
          url: 'http://127.0.0.1:53123/',
          urlFor: async (path) => 'http://127.0.0.1:53123' + path,
          stop: async () => { ide.stopped++ },
          onDidChangeStatus: () => () => {}
        }
      }
    }
  }
  return ide
}

test('the status bar shows the address and opens the options menu', async () => {
  const ide = fakeIde()
  activate(ide.delg)
  assert.equal(ide.bar.command, 'delg.live-server.menu')
  assert.equal(ide.bar.text, 'Live Server: stopped')

  ide.picks.push({ label: 'Start server' })
  await ide.commands.get('delg.live-server.menu')()
  assert.equal(ide.started, 1)
  assert.equal(ide.bar.text, 'Live Server: 127.0.0.1:53123')

  ide.picks.push({ label: 'Show address' })
  await ide.commands.get('delg.live-server.menu')()
  assert.deepEqual(ide.infos, ['Live Server is serving at http://127.0.0.1:53123/'])
  assert.deepEqual(ide.lastPick.items.map(({ label }) => label), ['Open in browser', 'Open a page…', 'Show address', 'Restart server', 'Stop server'])

  ide.picks.push({ label: 'Stop server' })
  await ide.commands.get('delg.live-server.menu')()
  assert.equal(ide.stopped, 1)
  assert.equal(ide.bar.text, 'Live Server: stopped')
})

test('open a page lists HTML files in the served folder and opens the chosen one', async () => {
  const ide = fakeIde({
    site: [{ name: 'index.html', isDir: false }, { name: 'docs', isDir: true }, { name: 'node_modules', isDir: true }, { name: 'app.js', isDir: false }],
    'site/docs': [{ name: 'guide.htm', isDir: false }],
    'site/node_modules': [{ name: 'skip.html', isDir: false }]
  }, { 'delg.live-server.root': 'site' })
  assert.deepEqual(await htmlPages(ide.delg), ['site/index.html', 'site/docs/guide.htm'])

  activate(ide.delg)
  ide.picks.push({ label: 'site/docs/guide.htm' })
  await ide.commands.get('delg.live-server.openPage')()
  assert.deepEqual(ide.opened, ['http://127.0.0.1:53123/docs/guide.htm'])
})

test('paths and addresses', () => {
  assert.equal(hostOf('http://127.0.0.1:5500/'), '127.0.0.1:5500')
  assert.equal(hostOf('not a url'), '')
  assert.equal(servedPath('', 'a/b.html'), '/a/b.html')
  assert.equal(servedPath('site', 'site' + String.fromCharCode(92) + 'a.html'), '/a.html')
  assert.equal(servedPath('site', 'other/a.html'), null)
})
