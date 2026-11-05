const PLUGIN_ID = 'delg.mercurial'
const PROVIDER_ID = PLUGIN_ID + '.changes'
const MAX_CAPTURE = 4 * 1024 * 1024
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'timed-out'])
const GROUPS = [
  ['modified', 'Modified'],
  ['added', 'Added'],
  ['removed', 'Removed'],
  ['untracked', 'Untracked']
]

function safePath(value) {
  const path = String(value || '').replaceAll('\\', '/')
  if (!path || path.length > 1024 || /[\x00-\x1f\x7f:]/.test(path) || path.startsWith('/') || path.endsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Mercurial returned a path outside the workspace')
  }
  return path
}

/** Parse NUL-terminated `hg status -0` records without splitting filenames on spaces. */
export function parseHgStatus(output) {
  if (typeof output !== 'string') throw new Error('Mercurial status output is invalid')
  const byKind = new Map(GROUPS.map(([kind, label]) => [kind, { id: kind, label, kind, resources: [] }]))
  const statusKinds = new Map([['M', 'modified'], ['A', 'added'], ['R', 'removed'], ['!', 'removed'], ['?', 'untracked']])
  const seen = new Set()
  for (const record of output.split('\0')) {
    if (!record) continue
    if (record.length < 3 || record[1] !== ' ') throw new Error('Mercurial returned an invalid status record')
    const kind = statusKinds.get(record[0])
    if (!kind) continue
    const path = safePath(record.slice(2))
    if (seen.has(path)) throw new Error('Mercurial returned a duplicate status path')
    seen.add(path)
    byKind.get(kind).resources.push({
      id: `${kind}-${byKind.get(kind).resources.length + 1}`,
      path,
      actions: kind === 'removed' ? [] : [{ id: 'open', label: 'Open', tooltip: 'Open this file in the editor' }]
    })
  }
  return GROUPS.map(([kind]) => {
    const group = byKind.get(kind)
    group.resources.sort((a, b) => a.path.localeCompare(b.path))
    // Reassign after sorting so IDs remain unique and deterministic per group.
    group.resources.forEach((resource, index) => { resource.id = `${kind}-${index + 1}` })
    return group
  })
}

/** The versioned integration contract intentionally carries counts, never paths. */
export function changeSummary(groups) {
  const counts = { modified: 0, added: 0, removed: 0, untracked: 0, total: 0 }
  for (const group of Array.isArray(groups) ? groups : []) {
    if (!Object.prototype.hasOwnProperty.call(counts, group?.kind) || !Array.isArray(group.resources)) continue
    counts[group.kind] += group.resources.length
  }
  counts.total = counts.modified + counts.added + counts.removed + counts.untracked
  return { contract: 'delg.mercurial.changes', version: 1, counts }
}

function asDisposable(value) {
  if (typeof value === 'function') return { dispose: value }
  return value && typeof value.dispose === 'function' ? value : { dispose() {} }
}

function captureHgStatus(delg, activation, refreshToken) {
  return new Promise(async (resolve, reject) => {
    let task
    const subscriptions = []
    let stdout = ''
    let stderr = ''
    let status = 'starting'
    let settled = false
    const finish = (error, groups) => {
      if (settled) return
      settled = true
      for (const subscription of subscriptions) subscription.dispose()
      if (refreshToken.task === task) refreshToken.task = undefined
      if (task) task.dispose()
      if (error) reject(error)
      else resolve(groups)
    }

    try {
      task = await delg.tasks.start({ kind: 'hg', args: ['status', '-0'], label: 'Mercurial status', timeoutMs: 120000 })
      if (!activation.active || !refreshToken.active) {
        await task.stop()
        finish(new Error('Mercurial provider was unloaded'))
        return
      }
      refreshToken.task = task
      subscriptions.push(asDisposable(task.onDidWrite(event => {
        if (settled || typeof event?.text !== 'string') return
        const next = event.stream === 'stderr' ? stderr + event.text : stdout + event.text
        if (next.length + (event.stream === 'stderr' ? stdout.length : stderr.length) > MAX_CAPTURE || event.truncated) {
          finish(new Error('Mercurial status output exceeded 4 MB'))
          return
        }
        if (event.stream === 'stderr') stderr = next
        else stdout = next
      })))
      subscriptions.push(asDisposable(task.onDidChangeStatus(next => {
        status = next
        if (!TERMINAL.has(status)) return
        if (status !== 'completed') finish(new Error(stderr.trim() || `hg status ended with ${status}`))
        else {
          try { finish(undefined, parseHgStatus(stdout)) } catch (error) { finish(error) }
        }
      })))
      status = task.status
      if (TERMINAL.has(status)) {
        if (status !== 'completed') finish(new Error(stderr.trim() || `hg status ended with ${status}`))
        else {
          try { finish(undefined, parseHgStatus(stdout)) } catch (error) { finish(error) }
        }
      }
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

function messageOf(error) {
  const message = String(error instanceof Error ? error.message : error).replace(/[\r\n\t\0-\x1f\x7f]+/g, ' ').trim()
  return (message || 'Mercurial status failed').slice(0, 1000)
}

export default async function activate(delg) {
  if (typeof delg.sourceControl?.createProvider !== 'function' || typeof delg.tasks?.start !== 'function') {
    await delg.ui?.showWarningMessage?.('Mercurial support requires the DELG Code IDE source-control provider and managed-task APIs. Update the IDE and reload plugins.')
    return
  }

  const activation = { active: true, groups: [], snapshotId: '', refreshEpoch: 0, refreshes: new Set() }
  const provider = await delg.sourceControl.createProvider({ id: PROVIDER_ID, label: 'Mercurial' })
  activation.snapshotId = provider.snapshotId
  const refresh = async (snapshotId = provider.snapshotId) => {
    if (!activation.active) return
    const epoch = ++activation.refreshEpoch
    for (const previous of activation.refreshes) {
      previous.active = false
      if (previous.task) void previous.task.stop().catch(() => undefined)
    }
    const refreshToken = { active: true, epoch, task: undefined }
    activation.refreshes.add(refreshToken)
    try {
      const groups = await captureHgStatus(delg, activation, refreshToken)
      if (!activation.active || !refreshToken.active || epoch !== activation.refreshEpoch) return
      await provider.setGroups(groups, snapshotId)
      if (!activation.active || !refreshToken.active || epoch !== activation.refreshEpoch) return
      activation.groups = groups
      activation.snapshotId = provider.snapshotId
    } catch (error) {
      if (!activation.active || !refreshToken.active || epoch !== activation.refreshEpoch) return
      await provider.setError(messageOf(error), snapshotId).catch(() => undefined)
    } finally {
      refreshToken.active = false
      activation.refreshes.delete(refreshToken)
    }
  }
  const refreshSubscription = asDisposable(provider.onDidRequestRefresh(event => {
    if (event.providerId === PROVIDER_ID) return refresh(event.snapshotId)
  }))
  const actionSubscription = asDisposable(provider.onDidRunAction(async event => {
    if (!activation.active || event.providerId !== PROVIDER_ID || event.actionId !== 'open') return
    if (event.snapshotId !== activation.snapshotId || event.snapshotId !== provider.snapshotId) return
    const resource = activation.groups.find(group => group.id === event.groupId)?.resources.find(item => item.id === event.resourceId)
    if (!resource || resource.path !== event.path) return
    await delg.ui.openFile(resource.path)
  }))

  void provider.refresh().catch(error => provider.setError(messageOf(error)).catch(() => undefined))
  return () => {
    activation.active = false
    for (const refreshToken of activation.refreshes) {
      refreshToken.active = false
      if (refreshToken.task) void refreshToken.task.stop().catch(() => undefined)
    }
    activation.refreshes.clear()
    refreshSubscription.dispose()
    actionSubscription.dispose()
    provider.dispose()
  }
}
