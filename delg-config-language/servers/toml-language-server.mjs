import fs from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Taplo's TOML language server ships to npm as WebAssembly (@taplo/lsp)
// without a command line, so this file connects it to stdio: LSP messages are
// framed with Content-Length headers in both directions, and Taplo gets the
// file and environment access it asks for.

let TaploLsp
try {
  // A CommonJS module: its exports arrive as the default export.
  const taplo = await import('../node_modules/@taplo/lsp/dist/index.js')
  TaploLsp = taplo.TaploLsp || taplo.default.TaploLsp
} catch (error) {
  process.stderr.write(`TOML support could not load its language server. Run "Config Files: Restart Language Servers" (${String(error)})\n`)
  process.exit(1)
}

const write = (stream) => async (bytes) => {
  stream.write(bytes)
  return bytes.length
}

const environment = {
  now: () => new Date(),
  envVar: (name) => process.env[name],
  envVars: () => Object.entries(process.env),
  stdErrAtty: () => false,
  stdin: async () => new Uint8Array(),
  stdout: write(process.stderr),
  stderr: write(process.stderr),
  // fs.globSync exists from Node.js 22; without it Taplo's include patterns
  // simply match nothing.
  glob: (pattern) => {
    try {
      return typeof fs.globSync === 'function' ? fs.globSync(pattern) : []
    } catch {
      return []
    }
  },
  readFile: (file) => readFile(file),
  writeFile: (file, bytes) => writeFile(file, bytes),
  // Taplo also passes schema and virtual URLs here; only file: URLs are paths.
  urlToFilePath: (url) => (String(url).startsWith('file:') ? fileURLToPath(url) : String(url)),
  isAbsolute: (file) => path.isAbsolute(file),
  cwd: () => process.cwd(),
  findConfigFile: (from) => {
    for (const name of ['.taplo.toml', 'taplo.toml']) {
      const candidate = path.join(from, name)
      if (fs.existsSync(candidate)) return candidate
    }
    return undefined
  },
  fetch: { fetch: globalThis.fetch, Headers: globalThis.Headers, Request: globalThis.Request, Response: globalThis.Response }
}

function sendToClient(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8')
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`)
  process.stdout.write(body)
}

const lsp = await TaploLsp.initialize(environment, { onMessage: sendToClient })

let buffer = Buffer.alloc(0)
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk])
  for (;;) {
    const end = buffer.indexOf('\r\n\r\n')
    if (end < 0) return
    const match = /content-length:\s*(\d+)/i.exec(buffer.subarray(0, end).toString('ascii'))
    if (!match) {
      buffer = buffer.subarray(end + 4)
      continue
    }
    const length = Number(match[1])
    if (buffer.length < end + 4 + length) return
    const body = buffer.subarray(end + 4, end + 4 + length).toString('utf8')
    buffer = buffer.subarray(end + 4 + length)
    let message
    try {
      message = JSON.parse(body)
    } catch {
      continue
    }
    if (message.method === 'exit') process.exit(0)
    lsp.send(message)
  }
})
process.stdin.on('end', () => process.exit(0))
