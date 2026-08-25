import { createHash } from 'node:crypto'
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { strToU8, unzipSync, zipSync } from 'fflate'

const root = dirname(fileURLToPath(import.meta.url))
const MAX_MEDIA_BYTES = 2 * 1024 * 1024
const MAX_MEDIA_FILES = 6
const MEDIA_EXTENSION = /\.(png|jpe?g|gif|webp)$/i

function packagePath(value, field) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new Error(`${field} must be a non-empty relative path`)
  }
  if (isAbsolute(value) || value.startsWith('/') || value.includes('\\')) {
    throw new Error(`${field} must use a relative forward-slash path`)
  }
  const segments = value.split('/')
  if (!segments.every((segment) => segment && segment !== '.' && segment !== '..')) {
    throw new Error(`${field} must not contain empty, current, or parent segments`)
  }
  return value
}
const tests = spawnSync(process.execPath, ['--test', join(root, 'plugin.test.mjs')], { stdio: 'inherit' })
if (tests.status !== 0) throw new Error('Web Forge tests failed; package was not built')
const manifestPath = join(root, 'manifest.json')
const manifestText = await readFile(manifestPath, 'utf8')
const manifest = JSON.parse(manifestText)
const packageMetadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

for (const field of ['id', 'version', 'entry']) {
  if (typeof manifest[field] !== 'string' || !manifest[field].trim()) {
    throw new Error(`manifest.json must contain a non-empty ${field}`)
  }
}
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
  throw new Error(`manifest.json version is not valid semver: ${manifest.version}`)
}
if (packageMetadata.version !== manifest.version) {
  throw new Error(`package.json version ${packageMetadata.version} does not match manifest.json ${manifest.version}`)
}
if (manifest.source !== undefined) {
  if (!manifest.source || typeof manifest.source !== 'object' || Array.isArray(manifest.source)) {
    throw new Error('manifest.json source must be an object')
  }
  const repository = typeof manifest.source.repository === 'string' ? manifest.source.repository.trim() : ''
  const commit = typeof manifest.source.commit === 'string' ? manifest.source.commit.trim() : ''
  if (!repository || !commit) {
    throw new Error('manifest.json source.repository and source.commit must be provided together')
  }
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(repository)) {
    throw new Error('manifest.json source.repository must be an HTTPS GitHub repository URL')
  }
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(commit)) {
    throw new Error('manifest.json source.commit must be a full 40- or 64-character hexadecimal commit id')
  }
}
const entry = packagePath(manifest.entry, 'manifest.json entry')
const media = []
if (manifest.icon !== undefined) media.push(packagePath(manifest.icon, 'manifest.json icon'))
if (manifest.images !== undefined) {
  if (!Array.isArray(manifest.images) || manifest.images.length > 5) {
    throw new Error('manifest.json images must be an array with at most five paths')
  }
  manifest.images.forEach((path, index) => media.push(packagePath(path, `manifest.json images[${index}]`)))
}
if (media.length > MAX_MEDIA_FILES || !media.every((path) => MEDIA_EXTENSION.test(path))) {
  throw new Error('manifest media must contain at most one icon and five PNG, JPEG, GIF, or WebP images')
}
if (new Set(['manifest.json', entry, ...media]).size !== media.length + 2) {
  throw new Error('manifest entry and media paths must be unique')
}

const entryBytes = await readFile(join(root, ...entry.split('/')))
const manifestBytes = strToU8(manifestText)
const archiveFiles = {
  'manifest.json': manifestBytes,
  [entry]: entryBytes
}
for (const path of media) {
  const bytes = await readFile(join(root, ...path.split('/')))
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new Error(`${path} exceeds the 2 MB media limit`)
  archiveFiles[path] = bytes
}
const packageBytes = zipSync(archiveFiles, { level: 6, mtime: new Date(1980, 0, 1, 0, 0, 0, 0) })

// Verify the archive before replacing any previously built package.
const embedded = unzipSync(packageBytes)
const embeddedNames = Object.keys(embedded).sort()
const expectedNames = ['manifest.json', entry, ...media].sort()
if (embeddedNames.join('\n') !== expectedNames.join('\n')) {
  throw new Error(`package contains unexpected files: ${embeddedNames.join(', ')}`)
}
const embeddedManifest = JSON.parse(new TextDecoder().decode(embedded['manifest.json']))
if (
  embeddedManifest.id !== manifest.id ||
  embeddedManifest.version !== manifest.version ||
  embeddedManifest.entry !== manifest.entry
) {
  throw new Error('embedded manifest id, version, or entry does not match manifest.json')
}
if (!Buffer.from(embedded[entry]).equals(entryBytes)) {
  throw new Error(`embedded ${entry} bytes do not match the source file`)
}
for (const path of media) {
  if (!Buffer.from(embedded[path]).equals(archiveFiles[path])) {
    throw new Error(`embedded ${path} bytes do not match the source file`)
  }
}

const artifactPattern = /^delg-web-forge-.+\.delg-plugin(?:\.tmp)?$/
const outputName = `delg-web-forge-${manifest.version}.delg-plugin`
const output = join(root, outputName)
const temporary = `${output}.tmp`

// A successful build leaves exactly one versioned artifact, so an old package
// can never be mistaken for the package described by the current manifest.
for (const name of await readdir(root)) {
  if (artifactPattern.test(name)) await rm(join(root, name), { force: true })
}
await writeFile(temporary, packageBytes)
await rename(temporary, output)

const digest = createHash('sha256').update(packageBytes).digest('hex').toUpperCase()
console.log(`Created ${outputName}`)
console.log(`Verified ${manifest.id}@${manifest.version}: ${expectedNames.join(', ')}`)
console.log(`SHA-256 ${digest}`)
