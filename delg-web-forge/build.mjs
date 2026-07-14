import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, zipSync } from '../../DELG-Code/ide/node_modules/fflate/esm/index.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const manifest = await readFile(join(root, 'manifest.json'), 'utf8')
const manifestData = JSON.parse(manifest)
const entry = await readFile(join(root, 'plugin.js'), 'utf8')

const packageBytes = zipSync({
  'manifest.json': strToU8(manifest),
  'plugin.js': strToU8(entry)
}, { level: 6 })

const output = join(root, `delg-web-forge-${manifestData.version}.delg-plugin`)
await writeFile(output, packageBytes)
console.log('Created ' + output)
