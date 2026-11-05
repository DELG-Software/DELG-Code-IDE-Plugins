import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const tests = spawnSync(process.execPath, ['--test', join(root, 'plugin.test.mjs')], { cwd: root, stdio: 'inherit' })
if (tests.status !== 0) throw new Error('Test Runner tests failed; source validation stopped')

const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
await readFile(join(root, manifest.entry), 'utf8')
if (manifest.id !== 'delg.test-runner') throw new Error('unexpected plugin id')
if (manifest.version !== metadata.version) throw new Error('package and manifest versions must match')
if (!manifest.capabilities.includes('testing') || !manifest.capabilities.includes('managed-tasks')) {
  throw new Error('manifest must declare testing and managed-tasks capabilities')
}
for (const command of ['refresh', 'cancel', 'setupHelp']) {
  if (!manifest.contributes.commands.some((entry) => entry.command === `delg.test-runner.${command}`)) {
    throw new Error(`manifest is missing the ${command} command`)
  }
}

console.log(`Validated ${manifest.id}@${manifest.version}; no archive was generated.`)
