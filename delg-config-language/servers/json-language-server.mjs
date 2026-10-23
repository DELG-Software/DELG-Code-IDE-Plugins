import { createRequire } from 'node:module'
import process from 'node:process'

// The IDE downloads the vscode-json-languageserver pinned in package-lock.json
// into ../node_modules before the first start, then runs this file on Node.js.
const require = createRequire(import.meta.url)
try {
  require('../node_modules/vscode-json-languageserver/out/node/jsonServerMain.js')
} catch (error) {
  process.stderr.write(`JSON support could not load its language server. Run "Config Files: Restart Language Servers" (${String(error)})\n`)
  process.exitCode = 1
}
