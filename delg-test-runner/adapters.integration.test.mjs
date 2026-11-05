import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import activate, { discoverIndividualTests, discoverTests, caseTask, parseCaseResult } from './plugin.js'

const root = dirname(fileURLToPath(import.meta.url))
const modules = process.env.DELG_TEST_VITEST_MODULES || resolve(root, '../../DELG-Code/ide/node_modules')
const python = process.env.DELG_TEST_PYTHON || 'python'
const npmCLI = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')

async function fixture(t, files) {
  const path = await mkdtemp(join(tmpdir(), 'delg-individual-tests-'))
  const children = new Set()
  t.after(async () => {
    for (const child of children) child.kill()
    assert.equal(dirname(resolve(path)), resolve(tmpdir()))
    assert.ok(basename(path).startsWith('delg-individual-tests-'))
    await rm(path, { recursive: true, force: true })
  })
  for (const [name, value] of Object.entries(files)) {
    await mkdir(dirname(join(path, name)), { recursive: true })
    await writeFile(join(path, name), value)
  }
  const requests = [], tasks = []
  const api = {
    workspace: {
      root: path,
      listFiles: async (relative = '') => (await readdir(join(path, relative), { withFileTypes: true })).map(entry => ({ name: entry.name, isDir: entry.isDirectory() })),
      readFile: relative => readFile(join(path, relative), 'utf8')
    },
    tasks: {
      async start(options) {
        requests.push(options)
        const program = options.kind === 'npm' || options.kind === 'node' ? process.execPath : options.kind === 'python' ? python : 'go'
        const args = options.kind === 'npm' ? [npmCLI, ...options.args] : options.args
        const child = spawn(program, args, { cwd: path, windowsHide: true, env: { ...process.env, CI: '1', GOWORK: 'off', GOPROXY: 'off', GOSUMDB: 'off', NO_COLOR: '1' } })
        children.add(child)
        let status = 'running', exitCode, replay = []
        const writes = new Set(), statuses = new Set()
        const finish = value => { if (status !== 'running') return; status = value; for (const listener of statuses) listener(status) }
        for (const stream of ['stdout', 'stderr']) child[stream].on('data', bytes => {
          const event = { stream, text: bytes.toString() }
          replay.push(event)
          for (const listener of writes) listener(event)
        })
        child.on('error', error => { replay.push({ stream: 'stderr', text: String(error) }); finish('failed') })
        child.on('close', code => { exitCode = code; children.delete(child); finish(code === 0 ? 'completed' : 'failed') })
        const handle = {
          get status() { return status }, get exitCode() { return exitCode },
          onDidWrite(listener) { writes.add(listener); for (const event of replay) listener(event); replay = []; return () => writes.delete(listener) },
          onDidChangeStatus(listener) { statuses.add(listener); return () => statuses.delete(listener) },
          async stop() { child.kill(); finish('cancelled') },
          dispose() { if (status === 'running') child.kill() }
        }
        tasks.push(handle)
        return handle
      }
    }
  }
  return { path, api, requests, tasks }
}

async function collect(api, options) {
  const task = await api.tasks.start(options)
  let output = '', stderr = ''
  const removeOutput = task.onDidWrite(event => { if (event.stream === 'stdout') output += event.text; else stderr += event.text })
  try {
    const status = await new Promise(resolve => {
      task.onDidChangeStatus(resolve)
      if (task.status !== 'running') resolve(task.status)
    })
    return { status, output, stderr }
  } finally { removeOutput(); task.dispose() }
}

async function exercise(api, kind) {
  const projects = await discoverTests(api)
  const diagnostics = []
  const items = await discoverIndividualTests(api, projects, { cancelled: false }, value => diagnostics.push(value))
  const cases = items.filter(item => item.individual && item.adapter === kind)
  assert.ok(cases.length >= 3, diagnostics.join(''))
  const pass = cases.find(item => item.name.includes('Pass') || item.name.includes('pass'))
  const fail = cases.find(item => item.name.includes('Fail') || item.name.includes('fail'))
  const skip = cases.find(item => item.name.includes('Skip') || item.name.includes('skip'))
  for (const [entry, expected] of [[pass, 'passed'], [fail, 'failed'], [skip, 'skipped']]) {
    assert.ok(entry)
    assert.ok(entry.path)
    const options = caseTask(entry)
    assert.ok(options.args.every(value => value.length <= 256), 'managed task argument limit')
    const report = await collect(api, options)
    let result
    try { result = parseCaseResult(entry, report.output, report.status, api.workspace.root) }
    catch (error) { assert.fail(String(error) + '\n' + JSON.stringify(entry) + '\n' + JSON.stringify(options) + '\n' + report.output + '\n' + report.stderr) }
    assert.equal(result.state, expected, report.output)
    if (expected === 'failed') assert.ok(result.message.includes('intentional failure'), result.message)
    if (expected !== 'skipped') assert.ok(result.durationMs >= 0)
  }
  return { cases, pass, fail }
}

test('real Go discovery, exact selected execution, skips and failures in a nested module', { timeout: 60000 }, async t => {
  const env = await fixture(t, {
    'api/go/go.mod': 'module example.test/individual\n\ngo 1.22\n',
    'api/go/values_test.go': `package individual
import "testing"
func TestPass(t *testing.T) {}
func TestFail(t *testing.T) { t.Run("nested", func(t *testing.T) { t.Fatal("intentional failure") }) }
func TestSkip(t *testing.T) { t.Skip("not applicable") }
`
  })
  const { cases } = await exercise(env.api, 'go')
  assert.ok(cases.every(value => value.path === 'api/go/values_test.go' && value.line > 0))
})

test('real pytest discovery includes parameter IDs and reports failures and skipped tests', { timeout: 60000, skip: spawnSync(python, ['-c', 'import pytest']).status !== 0 }, async t => {
  const env = await fixture(t, {
    'service/py/pytest.ini': '[pytest]\n',
    'service/py/test_values.py': `import pytest
@pytest.mark.parametrize('value', [1, 2], ids=['pass [literal].*', 'pass two'])
def test_pass(value):
    assert value > 0
def test_fail():
    assert False, 'intentional failure'
@pytest.mark.skip(reason='not applicable')
def test_skip():
    pass
`
  })
  const { cases } = await exercise(env.api, 'pytest')
  assert.equal(cases.length, 4)
  assert.ok(cases.some(value => value.name.includes('pass [literal].*')))
  assert.ok(cases.every(value => value.path === 'service/py/test_values.py' && value.line > 0))
})

test('real Vitest discovers and runs literal full names in a nested project', { timeout: 60000, skip: !existsSync(join(modules, 'vitest')) }, async t => {
  const env = await fixture(t, {
    'apps/web/package.json': JSON.stringify({ type: 'module', scripts: { test: 'vitest run' }, devDependencies: { vitest: '*' } }),
    'apps/web/values.test.js': `import { describe, test, expect } from 'vitest'
describe('values', () => {
test('pass [literal].* > marker', () => expect(1).toBe(1))
test('fail', () => { throw new Error('intentional failure') })
test('skip', ({ skip }) => skip())
})
`
  })
  await symlink(modules, join(env.path, 'apps/web/node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  await exercise(env.api, 'vitest')
})

test('real plugin publishes individual tests, then runs only the selected case', { timeout: 60000 }, async t => {
  const env = await fixture(t, {
    'go.mod': 'module example.test/controller\n\ngo 1.22\n',
    'values_test.go': 'package controller\nimport "testing"\nfunc TestPass(t *testing.T) {}\nfunc TestFail(t *testing.T) { t.Fatal("must not run") }\n'
  })
  const commands = new Map()
  let controller, onRun
  Object.assign(env.api, {
    registerCommand: (id, _title, callback) => { commands.set(id, callback); return () => commands.delete(id) },
    ui: { showWarningMessage() {}, showInformationMessage() {} },
    testing: { createController() {
      controller = {
        items: [], results: new Map(), output: '',
        async setItems(items) { this.items = items },
        async setResult(id, value) { this.results.set(id, value) },
        async appendOutput(value) { this.output += value },
        onDidRequestRun(callback) { onRun = callback; return () => {} },
        onDidRequestCancel() { return () => {} }, dispose() {}
      }
      return controller
    } }
  })
  const dispose = activate(env.api)
  t.after(dispose)
  while (!controller?.items.length) await new Promise(resolve => setTimeout(resolve, 10))
  await commands.get('delg.test-runner.refresh')()
  assert.equal(controller.items.length, 2)
  const selected = controller.items.find(value => value.label.includes('TestPass'))
  await onRun([selected.id])
  assert.equal(controller.results.get(selected.id).state, 'passed', controller.output)
  assert.equal(controller.results.size, 1)
  assert.ok(env.requests.at(-1).args.includes('-run=^TestPass$'))
})
