import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import activateConsumer from '../examples/plugin-services/mercurial-consumer/plugin.js'
import { fakeIde, loadManifest } from '../test-support/fake-ide.mjs'
import activate, { changeSummary, parseHgStatus } from './plugin.js'

const execFileAsync = promisify(execFile)
const manifest = loadManifest(import.meta.url)
const consumerManifest = loadManifest(new URL('../examples/plugin-services/mercurial-consumer/plugin.js', import.meta.url))
const disposable = fn => ({ dispose: fn })

test('activates from Mercurial repositories through the .hg/requires file marker', () => {
  assert.deepEqual(manifest.activationEvents, ['workspaceContains:.hg/requires'])
})

async function matchesWorkspaceContains(root) {
  for (const event of manifest.activationEvents) {
    if (!event.startsWith('workspaceContains:')) continue
    const relative = event.slice('workspaceContains:'.length)
    if (!relative || relative.startsWith('/') || relative.includes('\\') || relative.includes(':') || relative.split('/').some(part => !part || part === '.' || part === '..')) continue
    try {
      await readFile(join(root, ...relative.split('/')))
      return true
    } catch {
      // Missing markers are non-matches, as in the engine activation probe.
    }
  }
  return false
}

function groupsByKind(groups) {
  return Object.fromEntries(groups.map(group => [group.kind, group.resources.map(resource => resource.path)]))
}

async function waitFor(predicate, timeout = 3000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  assert.fail('timed out waiting for Mercurial provider state')
}

function createRunningTask(output, status = 'completed', stderr = '') {
  let currentStatus = 'running'
  let stopped = false
  const writeListeners = new Set()
  const statusListeners = new Set()
  const handle = {
    get status() { return currentStatus },
    onDidWrite(listener) {
      writeListeners.add(listener)
      queueMicrotask(() => {
        if (output) listener({ stream: 'stdout', text: output })
        if (stderr) listener({ stream: 'stderr', text: stderr })
      })
      return disposable(() => writeListeners.delete(listener))
    },
    onDidChangeStatus(listener) {
      statusListeners.add(listener)
      queueMicrotask(() => {
        currentStatus = status
        for (const callback of statusListeners) callback(status)
      })
      return disposable(() => statusListeners.delete(listener))
    },
    async stop() {
      stopped = true
      currentStatus = 'cancelled'
      for (const callback of statusListeners) callback(currentStatus)
    },
    dispose() { stopped = true },
    get stopped() { return stopped }
  }
  return handle
}

function createCompletedTask(output, status = 'completed', stderr = '') {
  return {
    status,
    onDidWrite(listener) {
      if (output) listener({ stream: 'stdout', text: output })
      if (stderr) listener({ stream: 'stderr', text: stderr })
      return disposable(() => {})
    },
    onDidChangeStatus: () => disposable(() => {}),
    async stop() {},
    dispose() {}
  }
}

function fakeMercurialIde(root = 'C:\\Repos\\repo with spaces') {
  const ide = fakeIde({}, { manifest, root })
  ide.delg.tasks.start = async options => {
    ide.taskStarts.push(options)
    return createRunningTask('')
  }
  return ide
}

function configureTaskQueue(ide, entries) {
  ide.delg.tasks.start = async options => {
    ide.taskStarts.push(options)
    const next = entries.shift()
    if (next instanceof Error) throw next
    return next
  }
}

test('parses NUL-delimited status records while preserving spaces and sorting groups', () => {
  const groups = parseHgStatus('M src/changed file.ts\0A new file.txt\0R removed file.txt\0! missing file.txt\0? untracked file.txt\0')
  assert.deepEqual(groupsByKind(groups), {
    modified: ['src/changed file.ts'],
    added: ['new file.txt'],
    removed: ['missing file.txt', 'removed file.txt'],
    untracked: ['untracked file.txt']
  })
  assert.deepEqual(groups.find(group => group.kind === 'removed').resources[0].actions, [])
  assert.throws(() => parseHgStatus('M ../outside.txt\0'), /outside the workspace/)
  assert.throws(() => parseHgStatus('M valid record\0A\0'), /invalid status record/)
})

test('exports a path-free versioned summary for the Mercurial change contract', () => {
  const summary = changeSummary(parseHgStatus('M folder/my file\0A added\0? untracked\0'))
  assert.deepEqual(summary, {
    contract: 'delg.mercurial.changes',
    version: 1,
    counts: { modified: 1, added: 1, removed: 0, untracked: 1, total: 3 }
  })
  assert.equal(JSON.stringify(summary).includes('my file'), false)
})

test('runs native hg status, refreshes the host snapshot, and routes Open to its source path', async t => {
  try { execFileSync('hg', ['--version'], { stdio: 'ignore' }) } catch {
    t.skip('Mercurial is not installed')
    return
  }
  const root = await mkdtemp(join(tmpdir(), 'delg mercurial repo '))
  t.after(() => rm(root, { recursive: true, force: true }))
  await execFileAsync('hg', ['init'], { cwd: root })
  assert.equal(await matchesWorkspaceContains(root), true, 'a fresh hg init must match the declared workspace activation marker')
  await writeFile(join(root, 'modified file.txt'), 'before\n')
  await writeFile(join(root, 'removed file.txt'), 'remove me\n')
  await execFileAsync('hg', ['add', 'modified file.txt', 'removed file.txt'], { cwd: root })
  await execFileAsync('hg', ['commit', '-u', 'DELG Test', '-m', 'initial'], { cwd: root })
  await writeFile(join(root, 'modified file.txt'), 'after\n')
  await writeFile(join(root, 'added file.txt'), 'added\n')
  await execFileAsync('hg', ['add', 'added file.txt'], { cwd: root })
  await writeFile(join(root, 'untracked file.txt'), 'untracked\n')
  await execFileAsync('hg', ['remove', 'removed file.txt'], { cwd: root })

  const ide = fakeMercurialIde(root)
  configureTaskQueue(ide, [])
  ide.delg.tasks.start = async options => {
    ide.taskStarts.push(options)
    return realHgTask(root, options.args)
  }
  const deactivate = await activate(ide.delg)
  const provider = ide.providers[0]
  await waitFor(() => provider.groups.some(group => group.resources.length))
  assert.deepEqual(ide.taskStarts[0], { kind: 'hg', args: ['status', '-0'], label: 'Mercurial status', timeoutMs: 120000 })
  assert.deepEqual(groupsByKind(provider.groups), {
    modified: ['modified file.txt'],
    added: ['added file.txt'],
    removed: ['removed file.txt'],
    untracked: ['untracked file.txt']
  })

  const consumer = fakeIde({}, { manifest: consumerManifest, root, services: ide.serviceRegistry })
  const summary = await activateConsumer(consumer.delg)
  assert.deepEqual(summary, {
    contract: 'delg.mercurial.changes',
    version: 1,
    counts: { modified: 1, added: 1, removed: 1, untracked: 1, total: 4 }
  })
  assert.equal(JSON.stringify(summary).includes('file.txt'), false)
  assert.deepEqual(consumer.serviceCalls, [{ id: 'delg.mercurial.changes', contractVersion: 1, request: {} }])

  await writeFile(join(root, 'after refresh file.txt'), 'new change\n')
  await provider.requestRefresh()
  assert.ok(provider.groups.find(group => group.kind === 'untracked').resources.some(resource => resource.path === 'after refresh file.txt'))
  const modified = provider.groups.find(group => group.kind === 'modified').resources[0]
  await provider.runAction({ groupId: 'modified', resourceId: modified.id, actionId: 'open' })
  assert.deepEqual(ide.openedFiles, ['modified file.txt'])
  await deactivate()
  assert.equal(provider.refreshListeners.size, 0)
  assert.equal(provider.actionListeners.size, 0)
  assert.equal(ide.serviceRegistry.has('delg.mercurial.changes'), false)
})

function realHgTask(root, args) {
  let currentStatus = 'running'
  let child
  let output = ''
  let errorOutput = ''
  const writeListeners = new Set()
  const statusListeners = new Set()
  const handle = {
    get status() { return currentStatus },
    onDidWrite(listener) {
      writeListeners.add(listener)
      if (output) queueMicrotask(() => listener({ stream: 'stdout', text: output }))
      if (errorOutput) queueMicrotask(() => listener({ stream: 'stderr', text: errorOutput }))
      return disposable(() => writeListeners.delete(listener))
    },
    onDidChangeStatus(listener) {
      statusListeners.add(listener)
      if (currentStatus !== 'running') queueMicrotask(() => listener(currentStatus))
      return disposable(() => statusListeners.delete(listener))
    },
    async stop() { child?.kill(); currentStatus = 'cancelled'; for (const listener of statusListeners) listener(currentStatus) },
    dispose() { child?.kill() }
  }
  child = execFile('hg', args, { cwd: root, encoding: 'utf8' }, (error, stdout, stderr) => {
    output = stdout || ''
    errorOutput = stderr || ''
    if (output) for (const listener of writeListeners) listener({ stream: 'stdout', text: output })
    if (errorOutput) for (const listener of writeListeners) listener({ stream: 'stderr', text: errorOutput })
    currentStatus = error ? 'failed' : 'completed'
    for (const listener of statusListeners) listener(currentStatus)
  })
  return handle
}

test('shows missing tools, denied task permissions, and failed hg commands as refresh errors', async () => {
  for (const failure of [new Error('hg executable was not found on PATH'), new Error('managed-task permission denied'), createRunningTask('', 'failed', 'abort: not a Mercurial repository')]) {
    const ide = fakeMercurialIde()
    configureTaskQueue(ide, [failure])
    const deactivate = await activate(ide.delg)
    const provider = ide.providers[0]
    await waitFor(() => !!provider.error)
    assert.match(provider.error, /hg|permission|Mercurial|not a Mercurial/)
    await deactivate()
  }
})

test('replays output from a task that completed before listeners attach', async () => {
  const ide = fakeMercurialIde()
  configureTaskQueue(ide, [createCompletedTask('M fast file.txt\0')])
  const deactivate = await activate(ide.delg)
  const provider = ide.providers[0]
  await waitFor(() => provider.groups.some(group => group.resources.length))
  assert.deepEqual(groupsByKind(provider.groups), { modified: ['fast file.txt'], added: [], removed: [], untracked: [] })
  await deactivate()
})

test('manual refresh supersedes an in-flight initial task without publishing its stale result', async () => {
  const ide = fakeMercurialIde()
  const initial = createRunningTask('M stale initial.txt\0', 'running')
  const manual = createCompletedTask('M current refresh.txt\0')
  configureTaskQueue(ide, [initial, manual])
  const deactivate = await activate(ide.delg)
  const provider = ide.providers[0]
  await waitFor(() => ide.taskStarts.length === 1)
  await provider.requestRefresh()
  await waitFor(() => provider.groups.some(group => group.resources.length))
  assert.equal(initial.stopped, true)
  assert.deepEqual(groupsByKind(provider.groups), { modified: ['current refresh.txt'], added: [], removed: [], untracked: [] })
  await deactivate()
})

test('cancels in-flight tasks and unregisters provider callbacks on unload', async () => {
  const ide = fakeMercurialIde()
  const task = createRunningTask('', 'running')
  configureTaskQueue(ide, [task])
  const deactivate = await activate(ide.delg)
  const provider = ide.providers[0]
  await waitFor(() => ide.taskStarts.length === 1)
  await deactivate()
  assert.equal(task.stopped, true)
  assert.equal(provider.refreshListeners.size, 0)
  assert.equal(provider.actionListeners.size, 0)
  await provider.requestRefresh()
  assert.equal(ide.taskStarts.length, 1)
})
