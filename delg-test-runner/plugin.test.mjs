import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import activate, { discoverTests } from './plugin.js'

const root = dirname(fileURLToPath(import.meta.url))
const settle = () => new Promise((resolve) => setImmediate(resolve))

function fakeIde({ files = {}, folders = {}, withTesting = true, responses = [] } = {}) {
  const ide = {
    commands: new Map(),
    warnings: [],
    infos: [],
    files,
    folders,
    tasks: [],
    taskRequests: [],
    disposedCommands: 0,
    controller: null,
    responses: [...responses]
  }
  const delg = {
    registerCommand(id, _title, run) {
      ide.commands.set(id, run)
      return () => { ide.disposedCommands++ }
    },
    workspace: {
      listFiles: async (path) => folders[path] || [],
      readFile: async (path) => {
        if (!(path in files)) throw new Error('not found: ' + path)
        return files[path]
      }
    },
    tasks: {
      async start(options) {
        ide.taskRequests.push(options)
        const response = ide.responses.shift() || {}
        if (response.throw) throw new Error(response.throw)
        const task = {
          status: 'starting',
          writes: new Set(),
          statuses: new Set(),
          stopCount: 0,
          disposeCount: 0,
          onDidWrite(listener) {
            this.writes.add(listener)
            return { dispose: () => this.writes.delete(listener) }
          },
          onDidChangeStatus(listener) {
            this.statuses.add(listener)
            return { dispose: () => this.statuses.delete(listener) }
          },
          write(text, stream = 'stdout') {
            for (const listener of this.writes) listener({ type: 'output', text, stream })
          },
          finish(status) {
            this.status = status
            for (const listener of this.statuses) listener(status)
          },
          async stop() {
            this.stopCount++
            if (!['completed', 'failed', 'cancelled', 'timed-out'].includes(this.status)) this.finish('cancelled')
          },
          dispose() { this.disposeCount++ }
        }
        if (response.status) task.status = response.status
        ide.tasks.push(task)
        return task
      }
    },
    ui: {
      showWarningMessage: async (message) => ide.warnings.push(message),
      showInformationMessage: async (message) => ide.infos.push(message)
    }
  }
  if (withTesting) {
    delg.testing = {
      createController(id, label) {
        const listeners = { run: null, cancel: null }
        const controller = {
          id,
          label,
          items: [],
          setItemsCalls: 0,
          results: new Map(),
          resultEvents: [],
          output: [],
          disposed: false,
          setItems: async (items) => { controller.items = items.map((entry) => ({ ...entry })); controller.setItemsCalls++ },
          setResult: async (testId, result) => {
            controller.results.set(testId, result)
            controller.resultEvents.push([testId, result])
          },
          appendOutput: async (text) => controller.output.push(text),
          onDidRequestRun: (callback) => { listeners.run = callback; return () => { listeners.run = null } },
          onDidRequestCancel: (callback) => { listeners.cancel = callback; return () => { listeners.cancel = null } },
          requestRun: (ids) => listeners.run?.(ids),
          requestCancel: () => listeners.cancel?.(),
          dispose: () => { controller.disposed = true }
        }
        ide.controller = controller
        return controller
      }
    }
  }
  ide.delg = delg
  return ide
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (predicate()) return
    await settle()
  }
  assert.fail('condition did not become true')
}

const exampleFolders = {
  '': [
    { name: 'package.json', isDir: false },
    { name: 'go.mod', isDir: false },
    { name: 'pytest.ini', isDir: false },
    { name: 'pyproject.toml', isDir: false },
    { name: 'packages', isDir: true },
    { name: 'node_modules', isDir: true }
  ],
  packages: [
    { name: 'web app', isDir: true },
    { name: 'go', isDir: true }
  ],
  'packages/web app': [{ name: 'package.json', isDir: false }],
  'packages/go': [{ name: 'go.mod', isDir: false }],
  node_modules: [{ name: 'package.json', isDir: false }]
}

const exampleFiles = {
  'package.json': JSON.stringify({ name: 'root', scripts: { test: 'vitest run' } }),
  'packages/web app/package.json': JSON.stringify({ scripts: { test: 'jest' } }),
  'packages/go/go.mod': 'module example.test/nested'
}

test('manifest declares testing and managed-task capabilities and commands', { timeout: 5000 }, async () => {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
  assert.equal(manifest.id, 'delg.test-runner')
  assert.ok(manifest.capabilities.includes('testing'))
  assert.ok(manifest.capabilities.includes('managed-tasks'))
  assert.deepEqual(manifest.contributes.commands.map(({ command }) => command), [
    'delg.test-runner.refresh', 'delg.test-runner.cancel', 'delg.test-runner.setupHelp'
  ])
})

test('discovers bounded project-level npm, Go, and pytest targets with safe IDs', { timeout: 5000 }, async () => {
  const ide = fakeIde({ folders: exampleFolders, files: exampleFiles })
  const tests = await discoverTests(ide.delg)
  assert.deepEqual(tests.map(({ kind, directory }) => [kind, directory]), [
    ['go', ''], ['npm', ''], ['go', 'packages/go'], ['npm', 'packages/web app'], ['pytest', '']
  ])
  assert.ok(tests.every(({ id }) => /^[a-z]+-[a-z0-9-]{1,30}$/.test(id)))
  assert.equal(new Set(tests.map(({ id }) => id)).size, tests.length)
  assert.equal(tests.find(({ kind }) => kind === 'pytest').path, 'pytest.ini')
  assert.equal(tests.some(({ path }) => path.includes('node_modules')), false)
})

test('refresh populates the controller; selected projects run sequentially with output and aggregate states', { timeout: 5000 }, async () => {
  const ide = fakeIde({ folders: exampleFolders, files: exampleFiles })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller?.items.length === 5)
  const selected = ide.controller.items.map(({ id }) => id)

  const run = ide.controller.requestRun(selected)
  await waitFor(() => ide.tasks.length === 1)
  assert.deepEqual(ide.taskRequests[0], { kind: 'go', args: ['test', './...'], label: 'workspace root · go test ./...' })
  ide.tasks[0].write('ok example.test', 'stdout')
  ide.tasks[0].finish('completed')

  await waitFor(() => ide.tasks.length === 2)
  assert.deepEqual(ide.taskRequests[1], { kind: 'npm', args: ['test'], label: 'workspace root · npm test' })
  ide.tasks[1].write('npm test failed', 'stderr')
  ide.tasks[1].finish('failed')

  await waitFor(() => ide.tasks.length === 3)
  assert.deepEqual(ide.taskRequests[2], { kind: 'go', args: ['-C', 'packages/go', 'test', './...'], label: 'packages/go · go test ./...' })
  ide.tasks[2].finish('timed-out')

  await waitFor(() => ide.tasks.length === 4)
  assert.deepEqual(ide.taskRequests[3], { kind: 'npm', args: ['--prefix=packages/web app', 'test'], label: 'packages/web app · npm test' })
  ide.tasks[3].finish('completed')

  await waitFor(() => ide.tasks.length === 5)
  assert.deepEqual(ide.taskRequests[4], { kind: 'pytest', args: [], label: 'workspace root · pytest' })
  ide.tasks[4].finish('completed')
  await run

  const byLabel = new Map(ide.controller.items.map((entry) => [entry.label, ide.controller.results.get(entry.id)]))
  assert.equal(byLabel.get('workspace root · go test ./...').state, 'passed')
  assert.equal(byLabel.get('workspace root · pytest').state, 'passed')
  assert.equal(byLabel.get('workspace root · npm test').state, 'failed')
  assert.equal(byLabel.get('packages/go · go test ./...').state, 'errored')
  assert.equal(byLabel.get('packages/web app · npm test').state, 'passed')
  assert.ok(ide.controller.output.includes('ok example.test'))
  assert.ok(ide.controller.output.includes('[stderr] npm test failed'))
  assert.ok(ide.tasks.every((task) => task.disposeCount === 1))

  dispose()
  assert.equal(ide.controller.disposed, true)
})

test('uses a terminal task status snapshot when a very fast task finishes before listeners attach', { timeout: 5000 }, async () => {
  const ide = fakeIde({ folders: exampleFolders, files: exampleFiles, responses: [{ status: 'completed' }] })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller?.items.length === 5)
  const id = ide.controller.items[0].id
  await ide.controller.requestRun([id])
  assert.equal(ide.tasks[0].status, 'completed')
  assert.equal(ide.controller.results.get(id).state, 'passed')
  dispose()
})

test('passes a nested pytest directory beginning with a dash as a path, not an option', { timeout: 5000 }, async () => {
  const ide = fakeIde({ folders: {
    '': [{ name: '-reports', isDir: true }],
    '-reports': [{ name: 'pytest.ini', isDir: false }]
  } })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller?.items.length === 1)
  const id = ide.controller.items[0].id
  const run = ide.controller.requestRun([id])
  await waitFor(() => ide.tasks.length === 1)
  assert.deepEqual(ide.taskRequests[0], { kind: 'pytest', args: ['--', '-reports'], label: '-reports · pytest' })
  ide.tasks[0].finish('completed')
  await run
  dispose()
})

test('cancel stops the current task and marks later selected projects skipped', { timeout: 5000 }, async () => {
  const ide = fakeIde({ folders: exampleFolders, files: exampleFiles })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller?.items.length === 5)
  const selected = ide.controller.items.slice(0, 2).map(({ id }) => id)
  const run = ide.controller.requestRun(selected)
  await waitFor(() => ide.tasks.length === 1)
  await ide.commands.get('delg.test-runner.refresh')()
  assert.equal(ide.controller.setItemsCalls, 1)

  await ide.controller.requestCancel()
  await run
  assert.equal(ide.tasks[0].stopCount, 1)
  assert.equal(ide.controller.results.get(selected[0]).state, 'skipped')
  assert.equal(ide.controller.results.get(selected[1]).state, 'skipped')
  assert.equal(ide.tasks.length, 1)
  dispose()
})

test('cancelling immediately after a run request prevents the queued task from starting', { timeout: 5000 }, async () => {
  const ide = fakeIde({ folders: exampleFolders, files: exampleFiles })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller?.items.length === 5)
  const selected = ide.controller.items.slice(0, 2).map(({ id }) => id)

  const run = ide.controller.requestRun(selected)
  const cancel = ide.controller.requestCancel()
  await Promise.all([run, cancel])

  assert.equal(ide.tasks.length, 0)
  assert.equal(ide.controller.results.get(selected[0]).state, 'skipped')
  assert.equal(ide.controller.results.get(selected[1]).state, 'skipped')
  dispose()
})

test('missing controller API shows upgrade guidance and registered commands remain safe', { timeout: 5000 }, async () => {
  const ide = fakeIde({ withTesting: false })
  const dispose = activate(ide.delg)
  assert.equal(ide.warnings.length, 1)
  assert.match(ide.warnings[0], /testing-controller/)
  await ide.commands.get('delg.test-runner.refresh')()
  await ide.commands.get('delg.test-runner.cancel')()
  await ide.commands.get('delg.test-runner.setupHelp')()
  assert.equal(ide.infos.length, 1)
  assert.match(ide.infos[0], /testing-controller/)
  dispose()
})

test('disposal cancels the current task and a fresh activation creates a new controller', { timeout: 5000 }, async () => {
  const ide = fakeIde({ folders: exampleFolders, files: exampleFiles })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller?.items.length === 5)
  const oldController = ide.controller
  const run = oldController.requestRun([oldController.items[0].id])
  await waitFor(() => ide.tasks.length === 1)

  dispose()
  await waitFor(() => ide.tasks[0].stopCount === 1)
  ide.tasks[0].finish('cancelled')
  await run
  assert.equal(oldController.disposed, true)

  const disposeFresh = activate(ide.delg)
  await waitFor(() => ide.controller !== oldController && ide.controller.items.length === 5)
  assert.equal(ide.controller.disposed, false)
  disposeFresh()
})

test('a task handle that arrives after disposal is stopped and disposed', { timeout: 5000 }, async () => {
  const ide = fakeIde({ folders: exampleFolders, files: exampleFiles })
  const startTask = ide.delg.tasks.start
  let releaseStart
  ide.delg.tasks.start = (options) => new Promise((resolve, reject) => {
    releaseStart = async () => {
      try { resolve(await startTask(options)) } catch (error) { reject(error) }
    }
  })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller?.items.length === 5)
  const run = ide.controller.requestRun([ide.controller.items[0].id])
  await waitFor(() => typeof releaseStart === 'function')

  dispose()
  await releaseStart()
  await run
  assert.equal(ide.tasks.length, 1)
  assert.equal(ide.tasks[0].stopCount, 1)
  assert.equal(ide.tasks[0].disposeCount, 1)
})
