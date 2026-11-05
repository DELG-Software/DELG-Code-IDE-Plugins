import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { unzipSync } from 'fflate'

const root = dirname(fileURLToPath(import.meta.url))
const archivePath = process.env.DELG_PRETTIER_ARCHIVE || join(root, 'delg-prettier-0.1.0.delg-plugin')
const archiveBytes = await readFile(archivePath)
const archive = unzipSync(archiveBytes)
const archiveModuleUrl = `data:text/javascript;base64,${Buffer.from(archive['plugin.js']).toString('base64')}`
const plugin = await import(archiveModuleUrl)

function harness(files = {}) {
  const entries = new Map(Object.entries(files))
  const statuses = []
  let provider
  const delg = {
    workspace: {
      root: 'C:/workspace',
      async readFile(path) {
        if (!entries.has(path)) throw new Error('not found')
        return entries.get(path)
      }
    },
    ui: {
      registerDocumentFormattingEditProvider(languages, provide) {
        provider = { languages: new Set(languages), provide }
        return () => { provider = undefined }
      },
      setStatus(message) { statuses.push(message) }
    }
  }
  plugin.default(delg)
  return {
    statuses,
    format(path, text) {
      assert.ok(provider, 'formatter provider registered')
      return provider.provide({ path, language: 'plaintext', version: 1, text })
    }
  }
}

test('the archived manifest and runtime entry match the package metadata and allowlist', async () => {
  const manifest = JSON.parse(new TextDecoder().decode(archive['manifest.json']))
  const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const sourceManifest = await readFile(join(root, 'manifest.json'))
  const sourceBundle = await readFile(join(root, manifest.entry))
  const longestLine = Math.max(...sourceBundle.toString('utf8').split('\n').map((line) => line.length))

  assert.equal(manifest.id, 'delg.prettier')
  assert.equal(manifest.version, metadata.version)
  assert.equal(manifest.entry, 'plugin.js')
  assert.deepEqual(Object.keys(archive).sort(), ['LICENSES.txt', 'README.md', 'THIRD-PARTY-NOTICES.md', 'manifest.json', 'plugin.js'])
  assert.deepEqual(archive['manifest.json'], new Uint8Array(sourceManifest))
  assert.deepEqual(archive['plugin.js'], new Uint8Array(sourceBundle))
  assert.ok(archive['README.md'].byteLength > 0)
  assert.match(new TextDecoder().decode(archive['LICENSES.txt']), /Prettier 3\.9\.10[\s\S]*License: MIT/)
  assert.match(new TextDecoder().decode(archive['THIRD-PARTY-NOTICES.md']), /License|Copyright/)
  assert.ok(longestLine <= 1000, `bundle should remain scanner-readable (longest line ${longestLine})`)
  assert.match(new TextDecoder().decode(archive['plugin.js']), /parserByExtension/)
})

test('the archived plugin registers a formatter and formats JavaScript', async () => {
  const api = harness()
  const edits = await api.format('src/app.js', 'const answer={text:"ok",count:2}')

  assert.equal(edits.length, 1)
  assert.deepEqual(edits[0].range, { startLine: 1, startColumn: 1, endLine: 1, endColumn: 33 })
  assert.match(edits[0].text, /const answer = \{ text: "ok", count: 2 \};/)
})

test('all bundled parser families format an input from the extracted archive', async () => {
  const api = harness()
  const samples = [
    ['src/app.ts', 'type User={name:string;age:number};'],
    ['src/data.json', '{"name":"Ada","age":3}'],
    ['src/data.jsonc', '{// user\n"name":"Ada"}'],
    ['src/data.json5', "{name:'Ada',age:3}"],
    ['src/index.html', '<main><h1>Hello</h1></main>'],
    ['src/Panel.vue', '<template><div>{{value}}</div></template><script setup>const value="ok"</script>'],
    ['src/site.css', 'a{color:red;margin:0}'],
    ['src/site.scss', '$color:red;.card{color:$color}'],
    ['src/site.less', '@color: red;.card{color:@color}'],
    ['src/workflow.yaml', 'name: build\non: [push]\njobs: {build: {runs-on: ubuntu-latest}}'],
    ['src/README.md', '# Title\n\nHello   world'],
    ['src/README.mdx', '# Title\n\nHello   world'],
    ['src/schema.graphql', 'type Query{hello:String!}'],
    ['src/schema.gql', 'type Query{hello:String!}']
  ]

  for (const [path, source] of samples) {
    const edits = await api.format(path, source)
    assert.equal(edits.length, 1, `${path} should use its bundled parser`)
    assert.notEqual(edits[0].text, source, `${path} should be formatted`)
  }
})

test('nearest supported JSON config controls formatting', async () => {
  const api = harness({
    'package.json': JSON.stringify({ prettier: { semi: true, singleQuote: false } }),
    'src/.prettierrc.json': JSON.stringify({ semi: false, singleQuote: true, tabWidth: 4 })
  })
  const edits = await api.format('src/app.js', 'const item={label:"ready"}')

  assert.equal(edits.length, 1)
  assert.match(edits[0].text, /label: 'ready'/)
  assert.doesNotMatch(edits[0].text, /;\s*$/)
})

test('root ignore files, node_modules, directory rules and negation are respected', async () => {
  const api = harness({
    '.gitignore': '*.generated.js\nnode_modules/\n/only-root.js\n\\!literal.js\nsrc/reincluded.js\n',
    '.prettierignore': 'dist/\n!dist/\ndist/*\n!dist/keep.js\nignored-dir/\n!ignored-dir/keep.js\n!src/reincluded.js\n'
  })

  assert.deepEqual(await api.format('dist/output.js', 'const x={a:1}'), [])
  assert.deepEqual(await api.format('src/file.generated.js', 'const x={a:1}'), [])
  assert.deepEqual(await api.format('node_modules/pkg/index.js', 'const x={a:1}'), [])
  assert.equal((await api.format('dist/keep.js', 'const x={a:1}')).length, 1)
  assert.deepEqual(await api.format('only-root.js', 'const x={a:1}'), [])
  assert.equal((await api.format('src/only-root.js', 'const x={a:1}')).length, 1)
  assert.deepEqual(await api.format('src/!literal.js', 'const x={a:1}'), [])
  assert.deepEqual(await api.format('ignored-dir/keep.js', 'const x={a:1}'), [])
  assert.equal((await api.format('src/reincluded.js', 'const x={a:1}')).length, 1)
})

test('unsupported overrides and syntax errors leave the provider healthy', async () => {
  const api = harness({
    '.prettierrc': JSON.stringify({ overrides: [{ files: '*.js', options: { semi: false } }] })
  })
  assert.deepEqual(await api.format('src/a.js', 'const x={a:1}'), [])
  assert.match(api.statuses.at(-1), /could not format/)

  const syntax = harness()
  assert.deepEqual(await syntax.format('src/b.js', 'const = ;'), [])
  assert.match(syntax.statuses.at(-1), /could not format/)
  assert.equal((await syntax.format('src/b.js', 'const x={a:1}')).length, 1)
})

test('documents at the IDE context limit are skipped before formatting', async () => {
  const api = harness()
  const result = await api.format('src/big.js', 'x'.repeat(1024 * 1024))
  assert.deepEqual(result, [])
  assert.match(api.statuses.at(-1), /1 MiB/)
})
