import { createHash } from 'node:crypto'
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { strToU8, unzipSync, zipSync } from 'fflate'

const root = dirname(fileURLToPath(import.meta.url))
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
if (
  manifest.entry.startsWith('/') ||
  manifest.entry.includes('\\') ||
  manifest.entry === '..' ||
  manifest.entry.startsWith('../') ||
  manifest.entry.includes('/../')
) {
  throw new Error(`manifest.json entry path is unsafe: ${manifest.entry}`)
}

const entryBytes = await readFile(join(root, manifest.entry))
const manifestBytes = strToU8(manifestText)
const packageBytes = zipSync({
  'manifest.json': manifestBytes,
  [manifest.entry]: entryBytes
}, { level: 6, mtime: new Date(1980, 0, 1, 0, 0, 0, 0) })

// Verify the archive before replacing any previously built package.
const embedded = unzipSync(packageBytes)
const embeddedNames = Object.keys(embedded).sort()
const expectedNames = ['manifest.json', manifest.entry].sort()
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
if (!Buffer.from(embedded[manifest.entry]).equals(entryBytes)) {
  throw new Error(`embedded ${manifest.entry} bytes do not match the source file`)
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
console.log(`Verified ${manifest.id}@${manifest.version}: manifest.json + ${manifest.entry}`)
console.log(`SHA-256 ${digest}`)
