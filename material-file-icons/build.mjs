import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, zipSync } from '../../DELG-Code/ide/node_modules/fflate/esm/index.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const manifest = await readFile(join(root, 'manifest.json'), 'utf8')
const manifestData = JSON.parse(manifest)
const entry = await readFile(join(root, 'src', 'plugin.js'), 'utf8')
const icon = await readFile(join(root, 'media', 'icon.png'))
const overview = await readFile(join(root, 'media', 'overview.png'))
await mkdir(join(root, 'dist'), { recursive: true })
await writeFile(join(root, 'dist', 'plugin.js'), entry)
const packageBytes = zipSync({
  'manifest.json': strToU8(manifest),
  'dist/plugin.js': strToU8(entry),
  'media/icon.png': new Uint8Array(icon),
  'media/overview.png': new Uint8Array(overview)
}, { level: 6 })

const output = join(root, `material-file-icons-${manifestData.version}.delg-plugin`)
await writeFile(output, packageBytes)
console.log('Created ' + output)
