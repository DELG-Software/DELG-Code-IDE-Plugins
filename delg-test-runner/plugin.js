const PLUGIN_ID = 'delg.test-runner'
const CONTROLLER_ID = PLUGIN_ID + '.projects'
const MAX_DEPTH = 6
const MAX_DIRECTORIES = 500
const SKIPPED_DIRECTORIES = new Set(['.git', '.delg', 'node_modules', 'vendor', '.venv', 'venv', '__pycache__'])
const TERMINAL_TASK_STATES = new Set(['completed', 'failed', 'cancelled', 'timed-out'])
const HELP = 'DELG Test Runner needs an IDE engine build with the testing-controller API. Update to a build that includes testing controllers; the IDE version number alone may not identify this unreleased feature. In a workspace, the runner discovers project-level npm test scripts, Go modules, and pytest projects, then runs their aggregate test commands.'

function asDisposable(value) {
  if (typeof value === 'function') return value
  if (value && typeof value.dispose === 'function') return () => value.dispose()
  return () => {}
}

function projectName(path) {
  return path || 'workspace root'
}

function projectLabel(path, suffix) {
  const label = projectName(path) + ' · ' + suffix
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
      label: test.label
    }
  }
  if (test.kind === 'go') {
    return {
      kind: 'go',
      args: test.directory ? ['-C', test.directory, 'test', './...'] : ['test', './...'],
      label: test.label
    }
  }
  return {
    kind: 'pytest',
    args: test.directory ? ['--', test.directory] : [],
    label: test.label
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
            kind: 'npm'
          })
        }
      } catch {
        // A malformed package manifest is not a runnable npm test target.
      }
    }
    if (files.has('go.mod')) {
      const label = projectLabel(directory.path, 'go test ./...')
      tests.push({
        ...item(stableId('go', directory.path), label, prefix + 'go.mod'),
        directory: directory.path,
        kind: 'go'
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
  const setResult = async (testId, result) => {
    if (!disposed && controller && typeof controller.setResult === 'function') {
      try { await controller.setResult(testId, result) } catch {}
    }
  }

  let refresh = async () => showUnavailable()
  let requestRun = async () => showUnavailable()
  let cancelRun = async () => showUnavailable()

  const commands = [
    ['refresh', 'Test Runner: Refresh Projects', () => refresh()],
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

  refresh = async () => {
    if (disposed) return
    if (activeBatch) {
      appendOutput('Refresh is available after the active test run finishes.')
      return
    }
    const generation = ++refreshGeneration
    try {
      const discovered = await discoverTests(delg)
      if (disposed || generation !== refreshGeneration) return
      await controller.setItems(discovered.map(({ id, label, path, line }) => ({ id, label, ...(path ? { path } : {}), ...(line ? { line } : {}) })))
      items = discovered
      appendOutput(discovered.length
        ? `Found ${discovered.length} project test target${discovered.length === 1 ? '' : 's'}.`
        : 'No npm test scripts, Go modules, or pytest projects were found in this workspace.')
    } catch (error) {
      if (!disposed && generation === refreshGeneration) appendOutput('Could not refresh projects: ' + String(error.message || error))
    }
  }

  const finishRun = async (run, status, message) => {
    if (run.finished) return
    run.finished = true
    const state = run.cancelRequested || status === 'cancelled' ? 'skipped' : resultState(status)
    const detail = message || (status === 'timed-out' ? 'Task timed out.' : status === 'cancelled' ? 'Cancelled.' : status === 'failed' ? 'Test command failed.' : undefined)
    await setResult(run.test.id, {
      state,
      ...(detail ? { message: detail } : {}),
      durationMs: Math.max(0, Date.now() - run.startedAt)
    })
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
      resolve: null
    }
    const completion = new Promise((resolve) => { run.resolve = resolve })
    activeRun = run
    await setResult(test.id, { state: 'running' })

    let task
    try {
      task = await delg.tasks.start(taskFor(test))
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
      if (!selected.length) appendOutput('No selected project test targets are available. Refresh the Test Runner to discover projects.')
      if (batch.cancelled) {
        for (const test of selected) await setResult(test.id, { state: 'skipped', message: 'Cancelled before this project ran.' })
        return
      }
      for (const test of selected) await setResult(test.id, { state: 'queued' })

      for (let index = 0; index < selected.length; index++) {
        if (disposed) break
        if (batch.cancelled) {
          for (const remaining of selected.slice(index)) {
            await setResult(remaining.id, { state: 'skipped', message: 'Cancelled before this project ran.' })
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
    const batch = { ids: Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [], cancelled: false }
    activeBatch = batch
    const pending = runQueue.catch(() => undefined).then(() => runBatch(batch))
    runQueue = pending.catch((error) => appendOutput('Test run error: ' + String(error.message || error)))
    return pending
  }

  cancelRun = async () => {
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
