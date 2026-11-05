const PLUGIN_ID = 'delg.test-runner'
const CONTROLLER_ID = PLUGIN_ID + '.projects'
const MAX_DEPTH = 6
const MAX_DIRECTORIES = 500
const SKIPPED_DIRECTORIES = new Set(['.git', '.delg', 'node_modules', 'vendor', '.venv', 'venv', '__pycache__'])
const TERMINAL_TASK_STATES = new Set(['completed', 'failed', 'cancelled', 'timed-out'])
const HELP = 'Use Test Runner: Refresh Tests to discover individual Vitest, pytest and Go tests. Discovery uses managed tasks and the tools already installed in your project (Vitest 3/4, Python with pytest, or Go). Unsupported npm scripts remain project targets. Go discovery lists top-level tests and examples; dynamic subtests run with their parent. The IDE must include the testing-controller API.'
const MAX_CAPTURE = 4 * 1024 * 1024
const MAX_TESTS = 10_000
const PYTEST_PREFIX = 'DELG_TEST_RUNNER:'
// A built-in pytest plugin supplies identities and all setup/call/teardown
// outcomes without installing a reporting extension or writing project files.
const PYTEST_REPORTER = `import sys,json,pytest
n=int(sys.argv[1])
def emit(value):
 print('\\n${PYTEST_PREFIX}'+json.dumps(value,ensure_ascii=True),flush=True)
class Reporter:
 def pytest_collection_finish(self,session):
  emit(dict(event='collection',count=len(session.items)))
  for item in session.items:
   emit(dict(event='test',nodeid=item.nodeid,path=str(item.path),line=item.location[1]+1))
 def pytest_runtest_logreport(self,report):
  emit(dict(event='result',nodeid=report.nodeid,phase=report.when,outcome=report.outcome,duration=report.duration,message=str(report.longrepr or '')[:8000]))
sys.exit(pytest.main(sys.argv[2+n:],plugins=[Reporter()]))
`

function pythonArgs(args) {
  const chunks = PYTEST_REPORTER.match(/[\s\S]{1,240}/g)
  return ['-c', "import sys;exec(''.join(sys.argv[2:2+int(sys.argv[1])]))", String(chunks.length), ...chunks, ...args]
}

function safePath(value, root = '') {
  if (typeof value !== 'string') return undefined
  let path = value.replaceAll('\\', '/')
  const normalizedRoot = String(root || '').replaceAll('\\', '/').replace(/\/$/, '')
  if (normalizedRoot && path.toLowerCase().startsWith(normalizedRoot.toLowerCase() + '/')) path = path.slice(normalizedRoot.length + 1)
  path = path.replace(/^\.\//, '')
  if (!path || path.length > 1000 || /[\x00-\x1f\x7f:]/.test(path) || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..')) return undefined
  return path
}

function jsonLines(output, prefix = '') {
  const values = []
  for (const line of output.split(/\r?\n/)) {
    if (prefix && !line.startsWith(prefix)) continue
    try { values.push(JSON.parse(prefix ? line.slice(prefix.length) : line)) } catch {}
  }
  return values
}

function jsonDocument(output) {
  // npm may print a banner before the runner's JSON payload.
  let attempts = 0
  for (const match of output.matchAll(/^[ \t]*(?=[\[{])/gm)) {
    if (++attempts > 32) break
    try { return JSON.parse(output.slice(match.index).trim()) } catch {}
  }
  throw new Error('The runner did not produce a complete JSON report')
}

function literalPattern(name) { return '^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$' }
// Vitest list displays suite boundaries as " > "; its run filter and JSON
// reporter join them with spaces. Preserve literal separators in test titles.
function vitestPattern(name) {
  return '^' + name.split(' > ').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?: > | )') + '$'
}
function vitestTask(project, args) {
  const entry = project.vitestEntry || [project.directory, 'node_modules/vitest/vitest.mjs'].filter(Boolean).join('/')
  return { kind: 'node', args: ['./' + entry, ...args, '--root=' + (project.directory ? './' + project.directory : '.')], label: project.label.slice(0, 120) }
}

async function vitestEntry(delg, directory) {
  let path = directory
  while (true) {
    const entry = [path, 'node_modules/vitest/vitest.mjs'].filter(Boolean).join('/')
    try { await delg.workspace.readFile(entry); return entry } catch {}
    if (!path) throw new Error('Project-local Vitest was not found. Install Vitest in this project before discovery.')
    path = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  }
}
function goTask(project, args) {
  return { kind: 'go', args: [...(project.directory ? ['-C', project.directory] : []), 'test', ...args], label: project.label.slice(0, 120) }
}

export function discoveryTask(project) {
  if (project.adapter === 'vitest') return vitestTask(project, ['list', '--json', '--includeTaskLocation'])
  if (project.kind === 'go') return goTask(project, ['-list=^(Test|Example)', '-json', './...'])
  if (project.kind === 'pytest') return { kind: 'python', args: pythonArgs(['--collect-only', '-q', '--color=no', '--override-ini=addopts=', '--', './' + (project.directory || '')]), label: project.label.slice(0, 120) }
  return null
}

export function parseDiscovery(project, output, root = '') {
  const entries = []
  if (project.adapter === 'vitest') {
    const report = jsonDocument(output)
    if (!Array.isArray(report)) throw new Error('Vitest list did not return a test array; use Vitest 3 or 4')
    for (const value of report) {
      const path = safePath(value?.file, root)
      if (!path || typeof value.name !== 'string' || !value.name.trim()) continue
      entries.push({ name: value.name, path, projectName: typeof value.projectName === 'string' ? value.projectName : undefined, ...(Number.isSafeInteger(value.location?.line) && value.location.line > 0 ? { line: value.location.line } : {}) })
    }
  } else if (project.kind === 'pytest') {
    for (const value of jsonLines(output, PYTEST_PREFIX)) {
      const path = safePath(value?.path, root)
      if (value.event !== 'test' || !path || typeof value.nodeid !== 'string' || !value.nodeid.includes('::')) continue
      const suffix = value.nodeid.slice(value.nodeid.indexOf('::'))
      entries.push({ name: value.nodeid, path, selector: './' + path + suffix, nodeid: value.nodeid, line: value.line })
    }
  } else if (project.kind === 'go') {
    for (const value of jsonLines(output)) {
      if (typeof value?.Output !== 'string' || typeof value.Package !== 'string') continue
      const name = value.Output.trim()
      if (/^(?:Test\S+|Example\S*)$/.test(name)) entries.push({ name, package: value.Package })
    }
  }
  const seen = new Set()
  return entries.map(value => {
    const identity = JSON.stringify([value.package, value.path, value.projectName, project.adapter === 'vitest' ? value.name.replaceAll(' > ', ' ') : value.name])
    if (seen.has(identity)) throw new Error('Duplicate test names cannot be selected individually. Give tests unique full names.')
    seen.add(identity)
    return { ...project, ...value, id: stableId('case', project.id + identity), adapter: project.adapter || project.kind, label: projectLabel(project.directory, (value.package ? value.package + ' · ' : '') + value.name), individual: true }
  }).filter(Boolean)
}

export function caseTask(test) {
  if (!test.individual) return taskFor(test)
  if (test.adapter === 'vitest') return vitestTask(test, ['run', './' + (test.line ? test.path : test.directory ? test.path.slice(test.directory.length + 1) : test.path) + (test.line ? ':' + test.line : ''), '--reporter=json', '--includeTaskLocation', '--testNamePattern=' + vitestPattern(test.name), ...(test.projectName ? ['--project=' + test.projectName] : [])])
  if (test.adapter === 'go') return goTask(test, ['-json', '-count=1', '-run=' + literalPattern(test.name), test.package])
  return { kind: 'python', args: pythonArgs(['-q', '--color=no', '--override-ini=addopts=', '--', test.selector]), label: test.label.slice(0, 120) }
}

export function parseCaseResult(test, output, status, root = '') {
  if (!test.individual) return { state: resultState(status) }
  let result
  if (test.adapter === 'vitest') {
    const report = jsonDocument(output)
    const matches = []
    const namePattern = new RegExp(vitestPattern(test.name))
    const matchesCase = assertion => typeof assertion.fullName === 'string' && namePattern.test(assertion.fullName) && (!test.line || !assertion.location?.line || assertion.location.line === test.line)
    for (const file of report.testResults || []) {
      if (safePath(file.name, root) !== test.path) continue
      for (const assertion of file.assertionResults || []) if (matchesCase(assertion) && assertion.status !== 'pending' && assertion.status !== 'todo') {
        matches.push({ state: assertion.status === 'passed' ? 'passed' : assertion.status === 'failed' ? 'failed' : 'skipped', durationMs: assertion.duration, message: (assertion.failureMessages || []).join('\n') })
      }
      if (!matches.length) for (const assertion of file.assertionResults || []) if (matchesCase(assertion)) matches.push({ state: 'skipped', message: 'Skipped by Vitest.' })
    }
    if (matches.length !== 1) throw new Error('Vitest did not report exactly one matching test; refresh discovery (duplicate names are not individually selectable)')
    result = matches[0]
  } else if (test.adapter === 'go') {
    const events = jsonLines(output).filter(value => value.Package === test.package && (value.Test === test.name || (typeof value.Test === 'string' && value.Test.startsWith(test.name + '/'))))
    const terminal = events.filter(value => value.Test === test.name && ['pass', 'fail', 'skip'].includes(value.Action)).at(-1)
    if (terminal) result = { state: terminal.Action === 'pass' ? 'passed' : terminal.Action === 'fail' ? 'failed' : 'skipped', durationMs: (terminal.Elapsed || 0) * 1000, message: events.map(value => value.Output || '').join('') }
  } else {
    const reports = jsonLines(output, PYTEST_PREFIX).filter(value => value.event === 'result' && value.nodeid === test.nodeid)
    const failure = reports.find(value => value.outcome === 'failed')
    const skipped = reports.find(value => value.outcome === 'skipped')
    if (failure || skipped || reports.some(value => value.phase === 'call' && value.outcome === 'passed')) result = {
      state: failure ? failure.phase === 'call' ? 'failed' : 'errored' : skipped ? 'skipped' : 'passed',
      durationMs: reports.reduce((sum, value) => sum + (Number(value.duration) || 0) * 1000, 0),
      message: failure?.message || skipped?.message || ''
    }
  }
  if (!result) throw new Error('The runner did not report this test. Refresh discovery; check the captured output for collection or build errors.')
  if (status !== 'completed' && (result.state === 'passed' || result.state === 'skipped')) return { state: 'errored', message: 'The test process failed outside this test. See captured output.' }
  return { ...result, ...(result.message ? { message: result.message.slice(-8000) } : {}), ...(Number.isFinite(result.durationMs) ? { durationMs: Math.max(0, result.durationMs) } : { durationMs: undefined }) }
}

async function goSource(delg, project, test, cache, token) {
  if (!project.modulePath || (test.package !== project.modulePath && !test.package.startsWith(project.modulePath + '/'))) return
  const suffix = test.package.slice(project.modulePath.length).replace(/^\//, '')
  const directory = [project.directory, suffix].filter(Boolean).join('/')
  if (!cache.has(directory)) {
    const sources = []
    const entries = await delg.workspace.listFiles(directory)
    for (const entry of entries.filter(entry => !entry.isDir && typeof entry.name === 'string' && entry.name.endsWith('_test.go')).slice(0, 100)) {
      if (token.cancelled) return
      const path = safePath([directory, entry.name].filter(Boolean).join('/'))
      if (!path) continue
      try { sources.push({ path, text: String(await delg.workspace.readFile(path)) }) } catch {}
    }
    cache.set(directory, sources)
  }
  const pattern = new RegExp('^\\s*func\\s+' + test.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(', 'm')
  for (const source of cache.get(directory)) {
    const match = pattern.exec(source.text)
    if (match) { test.path = source.path; test.line = source.text.slice(0, match.index).split('\n').length; return }
  }
}

export async function discoverIndividualTests(delg, projects, token = { cancelled: false }, appendOutput = () => {}) {
  const items = [], sourceCache = new Map(), ids = new Set(), caseIndexes = new Map()
  for (let project of projects) {
    if (token.cancelled) break
    let options = discoveryTask(project)
    if (!options) { items.push(project); continue }
    try {
      if (project.adapter === 'vitest') {
        project = { ...project, vitestEntry: await vitestEntry(delg, project.directory) }
        if (token.cancelled) break
        options = discoveryTask(project)
      }
      appendOutput('Discovering ' + project.label + '\n')
      const report = await captureTask(delg, { ...options, timeoutMs: 120000 }, token, appendOutput)
      if (token.cancelled) break
      if (report.truncated) throw new Error('Discovery output exceeded its limit')
      if (report.status !== 'completed') throw new Error(report.stderr.slice(-1000) || 'The discovery command failed. Check the tool installation and captured output.')
      if (project.kind === 'pytest' && !jsonLines(report.stdout, PYTEST_PREFIX).some(value => value.event === 'collection')) throw new Error('pytest did not report a collection; check Python and pytest installation')
      const tests = parseDiscovery(project, report.stdout, delg.workspace.root)
      for (const test of tests) {
        if (items.length >= MAX_TESTS) break
        if (project.kind === 'go') { try { await goSource(delg, project, test, sourceCache, token) } catch {} }
        if (token.cancelled) break
        // Nested pytest/Vitest projects can also be collected by their parent.
        // Keep the closest project configuration for a shared test identity.
        const identity = JSON.stringify([test.adapter, test.path || test.package, test.projectName, test.adapter === 'pytest' ? test.nodeid.slice(test.nodeid.indexOf('::')) : test.name])
        if (caseIndexes.has(identity)) {
          const index = caseIndexes.get(identity)
          if (test.directory.length > items[index].directory.length) items[index] = test
          continue
        }
        caseIndexes.set(identity, items.length)
        items.push(test)
      }
    } catch (error) {
      if (token.cancelled) break
      appendOutput(project.label + ': ' + String(error.message || error) + '\nKeeping its project-level target.\n')
      items.push(project)
    }
    if (items.length >= MAX_TESTS) { appendOutput('Discovery reached the 10,000-test limit.\n'); break }
  }
  for (const test of items) {
    const base = test.id
    let suffix = 1
    while (ids.has(test.id)) test.id = base + '-' + suffix++
    ids.add(test.id)
  }
  return items
}

// Managed-task handles replay early output and expose a terminal status snapshot.
// Cancellation also covers a handle that arrives after the caller is disposed.
async function captureTask(delg, options, token, appendOutput = () => {}) {
  let stdout = '', stderr = '', truncated = false
  let done = false, resolveDone
  const completion = new Promise(resolve => { resolveDone = resolve })
  const subscriptions = []
  const task = await delg.tasks.start(options)
  token.task = task
  const finish = status => { if (!done) { done = true; resolveDone(status) } }
  try {
    if (token.cancelled) { await task.stop(); return { status: 'cancelled', stdout, stderr, truncated } }
    subscriptions.push(asDisposable(task.onDidWrite(event => {
      if (done || typeof event?.text !== 'string') return
      appendOutput(event.stream === 'stderr' ? '[stderr] ' + event.text : event.text)
      if (stdout.length + stderr.length + event.text.length > MAX_CAPTURE || event.truncated) truncated = true
      if (event.stream === 'stderr') stderr = (stderr + event.text).slice(-MAX_CAPTURE)
      else stdout = (stdout + event.text).slice(-MAX_CAPTURE)
    })))
    subscriptions.push(asDisposable(task.onDidChangeStatus(status => { if (TERMINAL_TASK_STATES.has(status)) finish(status) })))
    if (TERMINAL_TASK_STATES.has(task.status)) finish(task.status)
    const status = await completion
    return { status, stdout, stderr, truncated }
  } finally {
    for (const dispose of subscriptions) dispose()
    task.dispose()
    if (token.task === task) token.task = null
  }
}

function asDisposable(value) {
  if (typeof value === 'function') return value
  if (value && typeof value.dispose === 'function') return () => value.dispose()
  return () => {}
}

function projectName(path) {
  return path || 'workspace root'
}

function projectLabel(path, suffix) {
  const label = (projectName(path) + ' · ' + suffix).replace(/[\x00-\x1f\x7f]/g, ' ')
  return label.length <= 240 ? label : label.slice(0, 237) + '...'
}

function stableId(kind, directory) {
  const value = kind + '\0' + directory
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0
  return kind + '-' + hash.toString(36)
}

function item(id, label, path) {
  return { id, label, ...(path ? { path } : {}) }
}

function taskFor(test) {
  if (test.kind === 'npm') {
    return {
      kind: 'npm',
      args: test.directory ? ['--prefix=' + test.directory, 'test'] : ['test'],
      label: test.label.slice(0, 120)
    }
  }
  if (test.kind === 'go') {
    return {
      kind: 'go',
      args: test.directory ? ['-C', test.directory, 'test', './...'] : ['test', './...'],
      label: test.label.slice(0, 120)
    }
  }
  return {
    kind: 'pytest',
    args: test.directory ? ['--', test.directory] : [],
    label: test.label.slice(0, 120)
  }
}

// Discover runnable project-level test targets. Managed tasks execute at the
// workspace root, so nested projects use their CLI's directory option/argument.
export async function discoverTests(delg) {
  const tests = []
  const pending = [{ path: '', depth: 0 }]
  let visited = 0

  while (pending.length && visited < MAX_DIRECTORIES) {
    const directory = pending.shift()
    visited++
    let entries
    try {
      entries = await delg.workspace.listFiles(directory.path)
    } catch {
      continue
    }
    if (!Array.isArray(entries)) continue

    const files = new Set()
    for (const entry of entries) {
      if (!entry || typeof entry.name !== 'string') continue
      if (entry.isDir) {
        if (directory.depth < MAX_DEPTH && !SKIPPED_DIRECTORIES.has(entry.name)
          && entry.name !== '.' && entry.name !== '..' && !/[\\/]/.test(entry.name)) {
          const childPath = directory.path ? directory.path + '/' + entry.name : entry.name
          if (childPath.length > 1000) continue
          pending.push({
            path: childPath,
            depth: directory.depth + 1
          })
        }
      } else {
        if (entry.name !== '.' && entry.name !== '..' && !/[\\/]/.test(entry.name)) files.add(entry.name)
      }
    }

    const prefix = directory.path ? directory.path + '/' : ''
    if (files.has('package.json')) {
      try {
        const metadata = JSON.parse(String(await delg.workspace.readFile(prefix + 'package.json')))
        if (typeof metadata?.scripts?.test === 'string' && metadata.scripts.test.trim()) {
          const label = projectLabel(directory.path, 'npm test')
          tests.push({
            ...item(stableId('npm', directory.path), label, prefix + 'package.json'),
            directory: directory.path,
            kind: 'npm',
            ...((metadata.devDependencies?.vitest || metadata.dependencies?.vitest || /\bvitest\b/.test(metadata.scripts.test)) ? { adapter: 'vitest' } : {})
          })
        }
      } catch {
        // A malformed package manifest is not a runnable npm test target.
      }
    }
    if (files.has('go.mod')) {
      const label = projectLabel(directory.path, 'go test ./...')
      let modulePath
      try { modulePath = /^\s*module\s+["']?([^\s"']+)/m.exec(String(await delg.workspace.readFile(prefix + 'go.mod')))?.[1] } catch {}
      tests.push({
        ...item(stableId('go', directory.path), label, prefix + 'go.mod'),
        directory: directory.path,
        kind: 'go', modulePath
      })
    }
    const pythonMarker = files.has('pytest.ini') ? 'pytest.ini' : files.has('pyproject.toml') ? 'pyproject.toml' : ''
    if (pythonMarker) {
      const label = projectLabel(directory.path, 'pytest')
      tests.push({
        ...item(stableId('pytest', directory.path), label, prefix + pythonMarker),
        directory: directory.path,
        kind: 'pytest'
      })
    }
  }

  tests.sort((left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind))
  const seenIds = new Set()
  for (const test of tests) {
    const base = test.id
    let suffix = 1
    while (seenIds.has(test.id)) test.id = base + '-' + suffix++
    seenIds.add(test.id)
  }
  return tests
}

function resultState(status) {
  if (status === 'completed') return 'passed'
  if (status === 'failed') return 'failed'
  if (status === 'cancelled') return 'skipped'
  return 'errored'
}

export default function activate(delg) {
  let disposed = false
  let controller = null
  let controllerSubscriptions = []
  let items = []
  let refreshGeneration = 0
  let runQueue = Promise.resolve()
  let activeBatch = null
  let activeRun = null
  let activeDiscovery = null

  const quiet = (promise) => { Promise.resolve(promise).catch(() => undefined) }
  const setupHelp = () => {
    if (typeof delg.ui?.showInformationMessage === 'function') quiet(delg.ui.showInformationMessage(HELP))
  }
  const showUnavailable = (error) => {
    const message = error ? HELP + ' (' + String(error.message || error).slice(0, 160) + ')' : HELP
    if (typeof delg.ui?.showWarningMessage === 'function') quiet(delg.ui.showWarningMessage(message))
  }
  const appendOutput = (text) => {
    if (!disposed && controller && typeof controller.appendOutput === 'function') {
      const value = String(text)
      for (let start = 0; start < value.length;) {
        let end = Math.min(value.length, start + 60000)
        if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1])) end--
        quiet(controller.appendOutput(value.slice(start, end)))
        start = end
      }
    }
  }
  const setResult = async (testId, result, batch) => {
    // The host enables Run as soon as its last result arrives. Release this
    // batch before publishing that result so an immediate next run is queued.
    if (batch && ['passed', 'failed', 'skipped', 'errored'].includes(result.state)) {
      batch.pending?.delete(testId)
      if (batch.pending?.size === 0 && activeBatch === batch) activeBatch = null
    }
    if (!disposed && controller && typeof controller.setResult === 'function') {
      try { await controller.setResult(testId, result) } catch {}
    }
  }

  let refresh = async () => showUnavailable()
  let requestRun = async () => showUnavailable()
  let cancelRun = async () => showUnavailable()

  const commands = [
    ['refresh', 'Test Runner: Refresh Tests', () => refresh(true)],
    ['cancel', 'Test Runner: Cancel Test Run', () => cancelRun()],
    ['setupHelp', 'Test Runner: Show Setup Help', () => setupHelp()]
  ]
  const commandDisposables = commands.map(([suffix, title, run]) => asDisposable(
    delg.registerCommand(PLUGIN_ID + '.' + suffix, title, run)
  ))

  if (typeof delg.testing?.createController !== 'function' || typeof delg.tasks?.start !== 'function') {
    showUnavailable()
    return () => {
      if (disposed) return
      disposed = true
      for (const dispose of commandDisposables) dispose()
    }
  }

  let candidate
  try {
    candidate = delg.testing.createController(CONTROLLER_ID, 'DELG Test Runner')
    if (!candidate || typeof candidate.setItems !== 'function' || typeof candidate.setResult !== 'function'
      || typeof candidate.appendOutput !== 'function'
      || typeof candidate.onDidRequestRun !== 'function' || typeof candidate.onDidRequestCancel !== 'function') {
      throw new Error('The testing controller API is incomplete')
    }
    controller = candidate
  } catch (error) {
    controller = null
    try { candidate?.dispose() } catch {}
    showUnavailable(error)
    return () => {
      if (disposed) return
      disposed = true
      for (const dispose of commandDisposables) dispose()
    }
  }

  refresh = async (individual = false) => {
    if (disposed) return
    if (activeBatch) {
      appendOutput('Refresh is available after the active test run finishes.')
      return
    }
    if (activeDiscovery) { appendOutput('Test discovery is already active. Use Cancel Test Run to stop it.'); return }
    const token = { cancelled: false, task: null }
    activeDiscovery = token
    const generation = ++refreshGeneration
    try {
      const projects = await discoverTests(delg)
      const discovered = individual ? await discoverIndividualTests(delg, projects, token, appendOutput) : projects
      if (disposed || token.cancelled || generation !== refreshGeneration) return
      await controller.setItems(discovered.map(({ id, label, path, line }) => ({ id, label, ...(path ? { path } : {}), ...(line ? { line } : {}) })))
      items = discovered
      appendOutput(discovered.length
        ? `Found ${discovered.length} test target${discovered.length === 1 ? '' : 's'}.${individual ? '' : ' Use Test Runner: Refresh Tests to discover individual cases.'}`
        : 'No npm test scripts, Go modules, or pytest projects were found in this workspace.')
    } catch (error) {
      if (!disposed && generation === refreshGeneration) appendOutput('Could not refresh tests: ' + String(error.message || error))
    } finally { if (activeDiscovery === token) activeDiscovery = null }
  }

  const finishRun = async (run, status, message) => {
    if (run.finished) return
    run.finished = true
    const state = run.cancelRequested || status === 'cancelled' ? 'skipped' : resultState(status)
    const detail = message || (status === 'timed-out' ? 'Task timed out.' : status === 'cancelled' ? 'Cancelled.' : status === 'failed' ? 'Test command failed.' : undefined)
    let result = {
      state,
      ...(detail ? { message: detail } : {}),
      durationMs: Math.max(0, Date.now() - run.startedAt)
    }
    if (run.test.individual && !run.cancelRequested && status !== 'cancelled') {
      try {
        if (run.truncated) throw new Error('Test output exceeded its limit; results could not be verified.')
        result = { ...result, ...parseCaseResult(run.test, run.stdout, status, delg.workspace.root) }
      } catch (error) { result = { state: 'errored', message: String(error.message || error).slice(0, 8000) } }
    }
    await setResult(run.test.id, result, run.batch)
    for (const dispose of run.subscriptions) {
      try { dispose() } catch {}
    }
    if (run.task) {
      try { run.task.dispose() } catch {}
    }
    if (activeRun === run) activeRun = null
    run.resolve()
  }

  const execute = async (batch, test) => {
    const run = {
      batch,
      test,
      task: null,
      subscriptions: [],
      startedAt: Date.now(),
      cancelRequested: false,
      finished: false,
      stdout: '', truncated: false,
      resolve: null
    }
    const completion = new Promise((resolve) => { run.resolve = resolve })
    activeRun = run
    await setResult(test.id, { state: 'running' }, batch)

    let task
    try {
      task = await delg.tasks.start(caseTask(test))
      run.task = task
    } catch (error) {
      appendOutput(`${test.label}: ${String(error.message || error)}`)
      await finishRun(run, 'errored', String(error.message || error))
      await completion
      return
    }

    if (disposed || run.finished || batch.cancelled || run.cancelRequested) {
      run.cancelRequested = true
      try { await task.stop() } catch {}
      try { task.dispose() } catch {}
      if (!run.finished) await finishRun(run, task.status || 'cancelled')
      await completion
      return
    }

    const isCurrent = () => !disposed && activeRun === run && !run.finished
    run.subscriptions.push(asDisposable(task.onDidWrite((event) => {
      if (!isCurrent() || typeof event?.text !== 'string') return
      appendOutput(event.stream === 'stderr' ? '[stderr] ' + event.text : event.text)
      if (event.stream !== 'stderr') {
        if (run.stdout.length + event.text.length > MAX_CAPTURE || event.truncated) run.truncated = true
        run.stdout = (run.stdout + event.text).slice(-MAX_CAPTURE)
      }
    })))
    run.subscriptions.push(asDisposable(task.onDidChangeStatus((status) => {
      if (isCurrent() && TERMINAL_TASK_STATES.has(status)) void finishRun(run, status)
    })))

    // A short task can finish before tasks.start resolves and before listeners
    // are attached. The handle's snapshot status closes that race.
    if (TERMINAL_TASK_STATES.has(task.status)) void finishRun(run, task.status)
    if (disposed || batch.cancelled || run.cancelRequested) {
      run.cancelRequested = true
      try { await task.stop() } catch {}
      if (TERMINAL_TASK_STATES.has(task.status)) void finishRun(run, task.status)
    }
    await completion
  }

  const runBatch = async (batch) => {
    if (disposed || activeBatch !== batch) return
    try {
      const selected = items.filter(({ id }) => batch.ids.includes(id))
      batch.pending = new Set(selected.map(test => test.id))
      if (!selected.length) appendOutput('No selected project test targets are available. Refresh the Test Runner to discover projects.')
      if (batch.cancelled) {
        for (const test of selected) await setResult(test.id, { state: 'skipped', message: 'Cancelled before this project ran.' }, batch)
        return
      }
      for (const test of selected) await setResult(test.id, { state: 'queued' }, batch)

      for (let index = 0; index < selected.length; index++) {
        if (disposed) break
        if (batch.cancelled) {
          for (const remaining of selected.slice(index)) {
            await setResult(remaining.id, { state: 'skipped', message: 'Cancelled before this project ran.' }, batch)
          }
          break
        }
        await execute(batch, selected[index])
      }
    } finally {
      if (activeBatch === batch) activeBatch = null
    }
  }

  requestRun = (ids = []) => {
    if (disposed) return Promise.resolve()
    if (activeBatch) {
      appendOutput('A project test run is already active.')
      return Promise.resolve()
    }
    if (activeDiscovery) { appendOutput('Wait for discovery to finish before running tests.'); return Promise.reject(new Error('Test discovery is still running')) }
    const batch = { ids: Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [], cancelled: false }
    activeBatch = batch
    const pending = runQueue.catch(() => undefined).then(() => runBatch(batch))
    runQueue = pending.catch((error) => appendOutput('Test run error: ' + String(error.message || error)))
    return pending
  }

  cancelRun = async () => {
    if (activeDiscovery) {
      activeDiscovery.cancelled = true
      if (activeDiscovery.task) { try { await activeDiscovery.task.stop() } catch {} }
    }
    const batch = activeBatch
    if (!batch) return
    batch.cancelled = true
    const run = activeRun
    if (!run || run.batch !== batch) return
    run.cancelRequested = true
    if (run.task) {
      try { await run.task.stop() } catch (error) { appendOutput('Could not cancel test task: ' + String(error.message || error)) }
      if (!run.finished && TERMINAL_TASK_STATES.has(run.task.status)) void finishRun(run, run.task.status)
    }
  }

  const onRun = controller.onDidRequestRun((ids) => requestRun(ids))
  const onCancel = controller.onDidRequestCancel(() => cancelRun())
  controllerSubscriptions = [asDisposable(onRun), asDisposable(onCancel)]
  void refresh()

  return () => {
    if (disposed) return
    disposed = true
    if (activeDiscovery) {
      activeDiscovery.cancelled = true
      try { quiet(activeDiscovery.task?.stop()) } catch {}
    }
    if (activeBatch) activeBatch.cancelled = true
    activeBatch = null
    if (activeRun) {
      const run = activeRun
      run.cancelRequested = true
      if (run.task) {
        try { void run.task.stop().catch(() => undefined) } catch {}
      }
      void finishRun(run, 'cancelled')
    }
    for (const dispose of controllerSubscriptions) dispose()
    for (const dispose of commandDisposables) dispose()
    try { controller.dispose() } catch {}
  }
}
