import { createRequire } from 'node:module'
import process from 'node:process'

// The IDE downloads the yaml-language-server pinned in package-lock.json into
// ../node_modules before the first start, then runs this file on Node.js.
const require = createRequire(import.meta.url)
try {
  process.env.YAML_LANGUAGE_SERVER_VERSION = require('../node_modules/yaml-language-server/package.json').version
  require('../node_modules/yaml-language-server/out/server/src/server.js')
} catch (error) {
  process.stderr.write(`YAML support could not load its language server. Run "Config Files: Restart Language Servers" (${String(error)})\n`)
  process.exitCode = 1
}
