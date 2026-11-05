import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import activate, { discoverTests, parseDiscovery, parseCaseResult, discoveryTask, caseTask } from './plugin.js'
import { enforceCapabilities } from '../test-support/fake-ide.mjs'

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
            if (response.output) listener({ stream: 'stdout', text: response.output })
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
  // Reject calls the manifest's capabilities do not allow, like the host.
  enforceCapabilities(delg, JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')))
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
  // The testing panel needs the controller before any command runs.
  for (const marker of ['package.json', 'go.mod', 'pytest.ini', 'pyproject.toml']) assert.ok(manifest.activationEvents.includes('workspaceContains:' + marker))
  assert.deepEqual(manifest.contributes.commands.map(({ command }) => command), [
    'delg.test-runner.refresh', 'delg.test-runner.cancel', 'delg.test-runner.setupHelp'
  ])
})

test('Vitest discovery scopes literal selections to source and rejects duplicates and outside paths', () => {
  const project = { id: 'web', kind: 'npm', adapter: 'vitest', directory: 'apps/web', label: 'web' }
  const cases = parseDiscovery(project, 'npm banner\n' + JSON.stringify([
    { name: 'suite pass [literal].*', file: 'C:/repo/apps/web/a.test.js' },
    { name: 'suite pass [literal].*', file: 'C:/repo/apps/web/b.test.js' },
    { name: 'outside', file: 'C:/outside/escape.test.js' }
  ]), 'C:/repo')
  assert.equal(cases.length, 2)
  assert.notEqual(cases[0].id, cases[1].id)
  const command = caseTask(cases[0])
  assert.equal(command.kind, 'node')
  assert.equal(command.args[0], './apps/web/node_modules/vitest/vitest.mjs')
  assert.ok(command.args.includes('./a.test.js'))
  assert.ok(command.args.includes('--testNamePattern=^suite pass \\[literal\\]\\.\\*$'))
  assert.throws(() => parseDiscovery(project, JSON.stringify([{ name: 'same', file: 'a.js' }, { name: 'same', file: 'a.js' }])), /Duplicate/)
})

test('Go discovery ignores logs and benchmarks and requires a matching terminal case result', () => {
  const project = { id: 'go', kind: 'go', directory: '', label: 'go' }
  const output = [
    { Package: 'sample', Output: 'TestPass\n' },
    { Package: 'sample', Output: 'BenchmarkPerformance\n' },
    { Package: 'sample', Output: 'TestName with log text\n' },
    { Package: 'other', Output: 'TestPass\n' }
  ].map(value => JSON.stringify(value)).join('\n')
  const cases = parseDiscovery(project, output)
  assert.equal(cases.length, 2)
  assert.notEqual(cases[0].id, cases[1].id)
  assert.throws(() => parseCaseResult(cases[0], '{"Action":"pass","Package":"other","Test":"TestPass"}', 'completed'), /did not report/)
  const report = '{"Action":"pass","Package":"sample","Test":"TestPass","Elapsed":0.125}'
  assert.equal(parseCaseResult(cases[0], report, 'completed').durationMs, 125)
  assert.equal(parseCaseResult(cases[0], report, 'failed').state, 'errored')
})

test('pytest preserves parameter identities, source lines and teardown failures', () => {
  const project = { id: 'py', kind: 'pytest', directory: 'python', label: 'pytest' }
  const prefix = 'DELG_TEST_RUNNER:'
  const [entry] = parseDiscovery(project, prefix + JSON.stringify({ event: 'test', nodeid: 'test_values.py::test_value[a.*]', path: 'C:/repo/python/test_values.py', line: 4 }), 'C:/repo')
  assert.equal(entry.line, 4)
  assert.ok(caseTask(entry).args.includes('./python/test_values.py::test_value[a.*]'))
  assert.ok(discoveryTask(project).args.every(arg => arg.length <= 256))
  const report = [
    { event: 'result', nodeid: entry.nodeid, phase: 'call', outcome: 'passed', duration: 0.1 },
    { event: 'result', nodeid: entry.nodeid, phase: 'teardown', outcome: 'failed', duration: 0.2, message: 'fixture cleanup failed' }
  ].map(value => prefix + JSON.stringify(value)).join('\n')
  const result = parseCaseResult(entry, report, 'failed')
  assert.equal(result.state, 'errored')
  assert.equal(Math.round(result.durationMs), 300)
  assert.equal(result.message, 'fixture cleanup failed')
})

test('Vitest requires an exact case report and reports malformed JSON as an error', () => {
  const test = { individual: true, adapter: 'vitest', path: 'a.test.js', name: 'one' }
  const report = JSON.stringify({ testResults: [{ name: 'a.test.js', assertionResults: [{ fullName: 'one', status: 'failed', duration: 12, failureMessages: ['expected 2'] }] }] })
  assert.equal(parseCaseResult(test, '[unrelated log]\n' + report, 'failed').state, 'failed')
  assert.equal(parseCaseResult(test, report, 'failed').message, 'expected 2')
  assert.throws(() => parseCaseResult({ ...test, name: 'other' }, report, 'failed'), /exactly one/)
  assert.throws(() => parseCaseResult(test, '{"testResults":', 'completed'), /complete JSON/)
})

test('explicit refresh replaces projects with cases and publishes per-case results and durations', async () => {
  const line = value => JSON.stringify(value) + '\n'
  const ide = fakeIde({ folders: { '': [{ name: 'go.mod', isDir: false }] }, files: { 'go.mod': 'module sample\n' }, responses: [{ status: 'completed', output: line({ Package: 'sample', Output: 'TestPass\n' }) + line({ Package: 'sample', Output: 'TestFail\n' }) }] })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller.items.length === 1)
  await ide.commands.get('delg.test-runner.refresh')()
  assert.equal(ide.controller.items.length, 2)
  const [pass, fail] = ide.controller.items
  const run = ide.controller.requestRun([pass.id, fail.id])
  await waitFor(() => ide.tasks.length === 2)
  ide.tasks[1].write(line({ Package: 'sample', Test: 'TestPass', Action: 'pass', Elapsed: 0.025 }))
  ide.tasks[1].finish('completed')
  await waitFor(() => ide.tasks.length === 3)
  ide.tasks[2].write(line({ Package: 'sample', Test: 'TestFail', Action: 'output', Output: 'intentional failure' }) + line({ Package: 'sample', Test: 'TestFail', Action: 'fail', Elapsed: 0.05 }))
  ide.tasks[2].finish('failed')
  await run
  assert.equal(ide.controller.results.get(pass.id).state, 'passed')
  assert.equal(ide.controller.results.get(pass.id).durationMs, 25)
  assert.equal(ide.controller.results.get(fail.id).state, 'failed')
  assert.match(ide.controller.results.get(fail.id).message, /intentional failure/)
  dispose()
})

test('cancelling discovery stops its task and preserves the previous list', async () => {
  const ide = fakeIde({ folders: { '': [{ name: 'go.mod', isDir: false }] } })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller.items.length === 1)
  const before = ide.controller.items
  const refresh = ide.commands.get('delg.test-runner.refresh')()
  await waitFor(() => ide.tasks.length === 1)
  await ide.commands.get('delg.test-runner.cancel')()
  await refresh
  assert.deepEqual(ide.controller.items, before)
  assert.equal(ide.tasks[0].stopCount, 1)
  assert.equal(ide.tasks[0].disposeCount, 1)
  dispose()
})

test('discovery failure preserves a runnable project and explains the failure', async () => {
  const ide = fakeIde({ folders: { '': [{ name: 'go.mod', isDir: false }] }, responses: [{ throw: 'tool not installed' }] })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller.items.length === 1)
  await ide.commands.get('delg.test-runner.refresh')()
  assert.equal(ide.controller.items.length, 1)
  assert.match(ide.controller.output.join('\n'), /tool not installed/)
  dispose()
})

test('a run requested immediately from the final result is queued instead of lost', async () => {
  const ide = fakeIde({ folders: { '': [{ name: 'go.mod', isDir: false }] } })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller.items.length === 1)
  const id = ide.controller.items[0].id
  const original = ide.controller.setResult
  let second, restarted = false
  ide.controller.setResult = async (testId, result) => {
    await original(testId, result)
    if (result.state === 'passed' && !restarted) { restarted = true; second = ide.controller.requestRun([id]) }
  }
  const first = ide.controller.requestRun([id])
  await waitFor(() => ide.tasks.length === 1)
  ide.tasks[0].finish('completed')
  await waitFor(() => ide.tasks.length === 2)
  ide.tasks[1].finish('completed')
  await first
  await second
  assert.equal(ide.controller.results.get(id).state, 'passed')
  dispose()
})

test('disposal cancels a discovery task whose handle arrives late', async () => {
  const ide = fakeIde({ folders: { '': [{ name: 'go.mod', isDir: false }] } })
  const dispose = activate(ide.delg)
  await waitFor(() => ide.controller.items.length === 1)
  let release
  const start = ide.delg.tasks.start
  ide.delg.tasks.start = async options => {
    const handle = await start(options)
    await new Promise(resolve => { release = resolve })
    return handle
  }
  const refresh = ide.commands.get('delg.test-runner.refresh')()
  await waitFor(() => typeof release === 'function')
  dispose()
  release()
  await refresh
  assert.equal(ide.tasks[0].stopCount, 1)
  assert.equal(ide.tasks[0].disposeCount, 1)
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
