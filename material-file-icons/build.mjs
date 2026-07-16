import { createHash, randomUUID } from 'node:crypto'
import { access, copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { unzipSync, zipSync } from '../../DELG-Code/ide/node_modules/fflate/esm/index.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const MAX_MEDIA_BYTES = 2 * 1024 * 1024
const MAX_PACKAGE_BYTES = 25 * 1024 * 1024
const MAX_EXPANDED_BYTES = 100 * 1024 * 1024
const MAX_FILES = 500
const MEDIA_EXTENSION = /\.(png|jpe?g|gif|webp)$/i
const STRICT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
// fflate encodes DOS local time and rejects dates whose local year is before
// 1980, so construct the epoch in local time instead of parsing a UTC string.
const FIXED_ZIP_DATE = new Date(1980, 0, 1, 0, 0, 0, 0)

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function safePackagePath(value, field) {
  invariant(typeof value === 'string' && value.length > 0 && value === value.trim(), `${field} must be a non-empty relative path`)
  invariant(!isAbsolute(value) && !value.startsWith('/') && !value.includes('\\'), `${field} must use a relative forward-slash path`)
  invariant(/^[a-z0-9._/-]+$/i.test(value), `${field} contains unsupported path characters`)
  const segments = value.split('/')
  invariant(segments.every((segment) => segment && segment !== '.' && segment !== '..'), `${field} must not contain empty, current, or parent segments`)
  return value
}

function semverTuple(value, field) {
  const match = STRICT_SEMVER.exec(value)
  invariant(match, `${field} must be strict semantic version syntax`)
  return match.slice(1, 4).map(Number)
}

function compareTuple(a, b) {
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

function validateContributions(manifest) {
  const contributes = object(manifest.contributes) || {}
  const capabilities = new Set(manifest.capabilities)
  // Views, menus, and keybindings are declarative surfaces, not certification
  // capabilities. Commands and status bar items do exercise gated host APIs.
  const pairs = [['commands', 'commands'], ['statusBarItems', 'status-bar']]
  for (const [field, capability] of pairs) {
    if (contributes[field] !== undefined) {
      invariant(Array.isArray(contributes[field]) && contributes[field].length > 0, `contributes.${field} must be a non-empty array when present`)
      invariant(capabilities.has(capability), `contributes.${field} requires the ${capability} capability`)
    }
  }
  const commands = new Set((contributes.commands || []).map((item) => item?.command))
  invariant(commands.size === (contributes.commands || []).length && [...commands].every((id) => typeof id === 'string' && id.startsWith(`${manifest.id}.`)), 'contributed command IDs must be unique and owned by the plugin')
  for (const field of ['menus', 'keybindings']) {
    invariant((contributes[field] || []).every((item) => commands.has(item?.command)), `contributes.${field} must reference contributed commands`)
  }
  invariant((contributes.views || []).every((item) => typeof item?.id === 'string' && item.id.startsWith(`${manifest.id}.`)), 'contributed view IDs must be owned by the plugin')
  invariant((contributes.statusBarItems || []).every((item) => typeof item?.id === 'string' && item.id.startsWith(`${manifest.id}.`)), 'contributed status bar IDs must be owned by the plugin')

  // These APIs are used directly by this plugin even though they are not all contributions.
  for (const required of ['commands', 'explorer-icons', 'status', 'status-bar']) {
    invariant(capabilities.has(required), `material-file-icons requires the ${required} capability`)
  }
}

export function validateManifest(manifest) {
  invariant(object(manifest), 'manifest.json must contain an object')
  invariant(manifest.schemaVersion === 1, 'schemaVersion must be 1')
  invariant(typeof manifest.id === 'string' && /^[a-z0-9][a-z0-9.-]*$/i.test(manifest.id), 'id must be a valid plugin ID')
  invariant(typeof manifest.publisherId === 'string' && manifest.publisherId.trim().length > 0, 'publisherId is required')
  invariant(object(manifest.publisher), 'publisher profile is required')
  invariant(typeof manifest.publisher.displayName === 'string' && manifest.publisher.displayName.trim().length > 0, 'publisher.displayName is required')
  invariant(typeof manifest.publisher.description === 'string' && manifest.publisher.description.trim().length > 0, 'publisher.description is required')
  invariant(typeof manifest.name === 'string' && manifest.name.trim().length > 0, 'name is required')
  semverTuple(manifest.version, 'version')

  const entry = safePackagePath(manifest.entry, 'entry')
  invariant(entry.endsWith('.js') || entry.endsWith('.mjs'), 'entry must be a JavaScript module')
  invariant(!entry.split('/').includes('node_modules') && !/\.(node|wasm)$/i.test(entry), 'native modules, WebAssembly, and node_modules are not allowed')

  invariant(object(manifest.engines) && typeof manifest.engines.delgIde === 'string', 'engines.delgIde is required')
  const engineMatch = /^>=(.+)$/.exec(manifest.engines.delgIde)
  invariant(engineMatch, 'engines.delgIde must be a >= semantic version range')
  invariant(compareTuple(semverTuple(engineMatch[1], 'engines.delgIde'), [0, 3, 0]) >= 0, 'engines.delgIde must require >=0.3.0 or newer')

  invariant(Array.isArray(manifest.capabilities) && manifest.capabilities.length > 0, 'capabilities must be a non-empty array')
  invariant(new Set(manifest.capabilities).size === manifest.capabilities.length && manifest.capabilities.every((item) => typeof item === 'string' && item.length > 0), 'capabilities must contain unique non-empty strings')
  validateContributions(manifest)

  const hasSource = Object.prototype.hasOwnProperty.call(manifest, 'source')
  if (hasSource) {
    invariant(object(manifest.source), 'source must contain both repository and commit')
    const repository = manifest.source.repository
    const commit = manifest.source.commit
    invariant(typeof repository === 'string' && repository.trim().length > 0 && typeof commit === 'string' && commit.trim().length > 0, 'source.repository and source.commit must be provided together')
    let url
    try { url = new URL(repository) } catch { throw new Error('source.repository must be a valid URL') }
    invariant(url.protocol === 'https:' && url.hostname.toLowerCase() === 'github.com' && url.pathname.split('/').filter(Boolean).length >= 2, 'source.repository must be an HTTPS GitHub repository')
    invariant(/^[0-9a-f]{40}$/i.test(commit), 'source.commit must be an exact 40-hex commit SHA')
  }

  const media = []
  if (manifest.icon !== undefined) media.push(safePackagePath(manifest.icon, 'icon'))
  if (manifest.images !== undefined) {
    invariant(Array.isArray(manifest.images) && manifest.images.length <= 5, 'images must contain at most five paths')
    manifest.images.forEach((path, index) => media.push(safePackagePath(path, `images[${index}]`)))
  }
  invariant(media.every((path) => MEDIA_EXTENSION.test(path)), 'icon and images must be PNG, JPEG, GIF, or WebP files')
  invariant(new Set([entry, ...media, 'manifest.json']).size === media.length + 2, 'entry and media paths must be unique')
  return { entry, media }
}

function zipEntry(bytes) {
  return [new Uint8Array(bytes), { mtime: FIXED_ZIP_DATE }]
}

function equalBytes(actual, expected) {
  return actual.byteLength === expected.byteLength && actual.every((value, index) => value === expected[index])
}

export async function buildPlugin(buildRoot = root, { cleanStale = true } = {}) {
  const manifestBytes = await readFile(join(buildRoot, 'manifest.json'))
  let manifest
  try { manifest = JSON.parse(manifestBytes.toString('utf8')) } catch { throw new Error('manifest.json must be valid JSON') }
  const { entry, media } = validateManifest(manifest)
  const sourcePath = join(buildRoot, 'src', 'plugin.js')
  const entryBytes = await readFile(sourcePath)
  const files = new Map([['manifest.json', manifestBytes], [entry, entryBytes]])
  for (const path of media) {
    const bytes = await readFile(join(buildRoot, ...path.split('/')))
    invariant(bytes.byteLength <= MAX_MEDIA_BYTES, `${path} exceeds the 2 MB media limit`)
    files.set(path, bytes)
  }
  invariant(files.size <= MAX_FILES, `package exceeds the ${MAX_FILES}-file limit`)
  invariant([...files.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0) <= MAX_EXPANDED_BYTES, 'package exceeds the 100 MB expanded-size limit')

  await mkdir(dirname(join(buildRoot, ...entry.split('/'))), { recursive: true })
  await copyFile(sourcePath, join(buildRoot, ...entry.split('/')))
  const archiveInput = Object.fromEntries([...files].map(([path, bytes]) => [path, zipEntry(bytes)]))
  const packageBytes = zipSync(archiveInput, { level: 6 })
  invariant(packageBytes.byteLength <= MAX_PACKAGE_BYTES, 'package exceeds the 25 MB compressed-size limit')

  const unpacked = unzipSync(packageBytes)
  invariant(JSON.stringify(Object.keys(unpacked).sort()) === JSON.stringify([...files.keys()].sort()), 'package verification found an unexpected file set')
  for (const [path, expected] of files) invariant(equalBytes(unpacked[path], expected), `package verification failed for ${path}`)
  const embedded = JSON.parse(new TextDecoder().decode(unpacked['manifest.json']))
  invariant(embedded.id === manifest.id && embedded.publisherId === manifest.publisherId && embedded.version === manifest.version && embedded.entry === entry, 'embedded manifest identity, publisher, version, or entry changed')

  const outputName = `material-file-icons-${manifest.version}.delg-plugin`
  const output = join(buildRoot, outputName)
  const temporary = join(buildRoot, `.${outputName}.${randomUUID()}.tmp`)
  const backup = join(buildRoot, `.${outputName}.${randomUUID()}.bak`)
  await writeFile(temporary, packageBytes, { flag: 'wx' })
  let hadOutput = false
  try {
    try { await access(output); hadOutput = true; await rename(output, backup) } catch (error) { if (error.code !== 'ENOENT') throw error }
    await rename(temporary, output)
    if (hadOutput) await rm(backup, { force: true })
  } catch (error) {
    await rm(temporary, { force: true })
    if (hadOutput) { try { await rename(backup, output) } catch {} }
    throw error
  }

  if (cleanStale) {
    for (const name of await readdir(buildRoot)) {
      if (/^material-file-icons-.+\.delg-plugin$/.test(name) && name !== outputName) await rm(join(buildRoot, name))
    }
  }
  const sha256 = createHash('sha256').update(packageBytes).digest('hex')
  return { output, outputName, sha256, files: [...files.keys()] }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await buildPlugin()
  console.log(`Created ${result.output}`)
  console.log(`SHA-256 ${result.sha256}`)
}
