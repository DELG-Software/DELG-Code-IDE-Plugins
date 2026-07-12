import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, zipSync } from '../../ide/node_modules/fflate/esm/index.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const manifest = await readFile(join(root, 'manifest.json'), 'utf8')
const entry = await readFile(join(root, 'src', 'plugin.js'), 'utf8')
await mkdir(join(root, 'dist'), { recursive: true })
await writeFile(join(root, 'dist', 'plugin.js'), entry)
const packageBytes = zipSync({
  'manifest.json': strToU8(manifest),
  'dist/plugin.js': strToU8(entry)
}, { level: 6 })

const output = join(root, 'material-file-icons-1.1.0.delg-plugin')
await writeFile(output, packageBytes)
console.log('Created ' + output)
