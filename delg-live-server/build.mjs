import { createHash } from 'node:crypto'
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, unzipSync, zipSync } from '../../DELG-Code/ide/node_modules/fflate/esm/index.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const manifestText = await readFile(join(root, 'manifest.json'), 'utf8')
const manifest = JSON.parse(manifestText)
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
if (metadata.version !== manifest.version) throw new Error('package and manifest versions must match')
const tests = await import('node:child_process').then(({ spawnSync }) => spawnSync(process.execPath, ['--test', join(root, 'plugin.test.mjs')], { stdio: 'inherit' }))
if (tests.status !== 0) throw new Error('Live Server tests failed')

const entry = await readFile(join(root, manifest.entry))
const files = {
  'manifest.json': strToU8(manifestText),
  [manifest.entry]: entry
}
const mediaPaths = [manifest.icon, ...(Array.isArray(manifest.images) ? manifest.images : [])]
  .filter((path, index, paths) => typeof path === 'string' && path && paths.indexOf(path) === index)
for (const path of mediaPaths) files[path] = await readFile(join(root, path))

const packageBytes = zipSync(files, { level: 6, mtime: new Date(1980, 0, 1) })
const embedded = unzipSync(packageBytes)
for (const [path, contents] of Object.entries(files)) {
  if (!embedded[path] || !Buffer.from(embedded[path]).equals(Buffer.from(contents))) {
    throw new Error(`embedded package file does not match source: ${path}`)
  }
}
const output = `delg-live-server-${manifest.version}.delg-plugin`
for (const name of await readdir(root)) if (/^delg-live-server-.+\.delg-plugin(?:\.tmp)?$/.test(name)) await rm(join(root, name), { force: true })
const temporary = join(root, `${output}.tmp`)
await writeFile(temporary, packageBytes)
await rename(temporary, join(root, output))
console.log(`Created ${output}`)
console.log(`SHA-256 ${createHash('sha256').update(packageBytes).digest('hex').toUpperCase()}`)
