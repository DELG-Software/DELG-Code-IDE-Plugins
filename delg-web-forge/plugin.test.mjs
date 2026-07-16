import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import activate from './plugin.js'

const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'))
const packageMetadata = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'))

const COMPLETIONS_ENABLED_KEY = 'delg.web-forge.completions.enabled'
const HTML_ENABLED_KEY = 'delg.web-forge.html.enabled'
const CSS_ENABLED_KEY = 'delg.web-forge.css.enabled'
const AUTO_HTML_TAGS_KEY = 'delg.web-forge.html.autoTags'
const QUOTE_STYLE_KEY = 'delg.web-forge.html.quoteStyle'
const INDENT_STYLE_KEY = 'delg.web-forge.indentStyle'

test('keeps manifest, package metadata, capabilities, and configuration aligned', () => {
  assert.equal(manifest.id, 'delg.web-forge')
  assert.equal(manifest.version, packageMetadata.version)
  assert.equal(manifest.engines.delgIde, '>=0.4.5')
  assert.deepEqual(manifest.capabilities, ['full-host', 'commands', 'editor-completions', 'status'])
  if (manifest.source !== undefined) {
    assert.equal(manifest.source.repository, 'https://github.com/DELG-Software/DELG-Code-IDE-Plugins')
    assert.match(manifest.source.commit, /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/)
  }

  const commandIds = new Set(manifest.contributes.commands.map((command) => command.command))
  assert.ok(commandIds.has('delg.web-forge.about'))
  const snippetGuide = manifest.contributes.views.find((view) => view.id === 'delg.web-forge.snippet-guide')
  assert.match(snippetGuide?.icon || '', /^M[0-9A-Za-z\s.,+\-]+$/)
  for (const entry of [...manifest.contributes.menus, ...manifest.contributes.keybindings]) {
    assert.ok(commandIds.has(entry.command))
  }
  const configurationKeys = manifest.contributes.configuration.map((item) => item.key)
  assert.equal(new Set(configurationKeys).size, configurationKeys.length)
  assert.deepEqual(configurationKeys.sort(), [
    AUTO_HTML_TAGS_KEY,
    COMPLETIONS_ENABLED_KEY,
    CSS_ENABLED_KEY,
    'delg.web-forge.frameworks.enabled',
    HTML_ENABLED_KEY,
    INDENT_STYLE_KEY,
    'delg.web-forge.javascript.enabled',
    QUOTE_STYLE_KEY
  ].sort())
})

function createHarness(initialConfiguration = true) {
  const configuration = new Map([[COMPLETIONS_ENABLED_KEY, initialConfiguration]])
  let configurationListener
  let registeredProvider
  const registeredCommands = new Map()
  let registeredViewItems = []
  const insertedSnippets = []
  let completionDisposeCount = 0
  let configurationDisposeCount = 0

  const delg = {
    registerCommand(id, title, run) { registeredCommands.set(id, { title, run }) },
    workspace: {
      getConfiguration(key) {
        return configuration.get(key)
      },
      onDidChangeConfiguration(listener) {
        configurationListener = listener
        return () => { configurationDisposeCount += 1 }
      }
    },
    ui: {
      setViewItems(_viewId, items) { registeredViewItems = items },
      insertSnippet(snippet) { insertedSnippets.push(snippet) },
      registerCompletionProvider(languages, provide) {
        registeredProvider = { languages: new Set(languages), provide }
        return () => { completionDisposeCount += 1 }
      }
    }
  }

  return {
    activate() {
      return activate(delg)
    },
    complete(context) {
      assert.ok(registeredProvider, 'the plugin must register a completion provider')
      if (!registeredProvider.languages.has(context.language)) return []
      return registeredProvider.provide(context)
    },
    setConfiguration(key, value) {
      if (value === undefined) {
        value = key
        key = COMPLETIONS_ENABLED_KEY
      }
      configuration.set(key, value)
      configurationListener(key)
    },
    runCommand(id) {
      assert.ok(registeredCommands.has(id), `command ${id} must be registered`)
      registeredCommands.get(id).run()
    },
    get viewItems() {
      return registeredViewItems
    },
    get insertedSnippets() {
      return insertedSnippets
    },
    get registeredLanguages() {
      return registeredProvider?.languages
    },
    get disposalCounts() {
      return { completions: completionDisposeCount, configuration: configurationDisposeCount }
    }
  }
}

function context(overrides = {}) {
  return {
    language: 'html',
    path: 'index.html',
    line: 1,
    column: 2,
    linePrefix: '!',
    ...overrides
  }
}

test('registers ! as an HTML5 snippet and replaces exactly the abbreviation', () => {
  const harness = createHarness()
  harness.activate()

  assert.ok(harness.registeredLanguages.has('html'))
  assert.deepEqual(harness.complete(context()), [{
    label: '!',
    detail: 'Web Forge: expand !',
    documentation: 'Expand this Web Forge abbreviation.',
    insertText: `<!DOCTYPE html>
<html lang="en">
<head>
\t<meta charset="UTF-8">
\t<meta name="viewport" content="width=device-width, initial-scale=1.0">
\t<title>\${1:Document}</title>
</head>
<body>
\t$0
</body>
</html>`,
    kind: 'snippet',
    replaceStartColumn: 1
  }])
})

test('calculates the replacement start from Monaco columns after leading text', () => {
  const harness = createHarness()
  harness.activate()

  const [completion] = harness.complete(context({
    column: 6,
    linePrefix: '    !'
  }))

  assert.equal(completion.replaceStartColumn, 5)
})

test('does not treat arbitrary prose as an HTML element abbreviation', () => {
  const harness = createHarness()
  harness.activate()

  assert.deepEqual(harness.complete(context({
    column: 5,
    linePrefix: 'test'
  })), [])
})

test('keeps native tags, custom elements, and structural HTML abbreviations', () => {
  const harness = createHarness()
  harness.activate()

  for (const abbreviation of ['section', 'my-widget', '.container', 'ul>li*3']) {
    assert.equal(harness.complete(context({
      column: abbreviation.length + 1,
      linePrefix: abbreviation
    })).length, 1, `${abbreviation} should remain a completion`)
  }
})

test('expands precedence, climb-up, grouping, attributes, text, numbering, and implicit tags', () => {
  const harness = createHarness()
  harness.activate()

  const expand = (abbreviation) => harness.complete(context({
    column: abbreviation.length + 1,
    linePrefix: abbreviation
  }))[0]?.insertText

  assert.equal(expand('div>span+em'), '<div>\n\t<span>${1}</span>\n\t<em>${2}</em>\n</div>$0')
  assert.equal(expand('div>span^p'), '<div>\n\t<span>${1}</span>\n</div>\n<p>${2}</p>$0')
  assert.equal(expand('(header>nav)+main'), '<header>\n\t<nav>${1}</nav>\n</header>\n<main>${2}</main>$0')
  assert.equal(expand('ul>.item$*3'), '<ul>\n\t<li class="item1">${1}</li>\n\t<li class="item2">${2}</li>\n\t<li class="item3">${3}</li>\n</ul>$0')
  assert.equal(expand('button.primary[type=button]{Save}'), '<button class="primary" type="button">Save</button>$0')
  assert.equal(expand('(li.item$>a{Item $})*2'), '<li class="item1">\n\t<a>Item 1</a>\n</li>\n<li class="item2">\n\t<a>Item 2</a>\n</li>$0')
})

test('seeds HTML element completions after every opening angle bracket', () => {
  const harness = createHarness()
  harness.activate()

  for (const linePrefix of ['<', '<table><', '<table><tbody><tr><']) {
    const completions = harness.complete(context({
      column: linePrefix.length + 1,
      linePrefix
    }))
    const byLabel = new Map(completions.map((completion) => [completion.label, completion]))

    for (const tag of ['table', 'tbody', 'tr', 'th', 'td']) {
      assert.ok(byLabel.has(tag), `${tag} should be suggested after ${linePrefix}`)
    }
    assert.equal(byLabel.get('td').insertText, 'td>${1}</td>$0')
    assert.equal(byLabel.get('td').replaceStartColumn, linePrefix.length + 1)
    assert.equal(completions.length, 112)
    for (const tag of ['summary', 'template', 'textarea', 'ul', 'video', 'wbr']) assert.ok(byLabel.has(tag))
  }

  assert.deepEqual(harness.complete(context({
    language: 'javascript',
    path: 'app.js',
    column: 2,
    linePrefix: '<'
  })), [])
})

test('uses JSX-safe component and element expansions', () => {
  const harness = createHarness()
  harness.activate()

  const [jsxComponent] = harness.complete(context({ language: 'javascript', path: 'Component.jsx', linePrefix: 'rfc', column: 4 }))
  assert.match(jsxComponent.insertText, /export function/)
  assert.doesNotMatch(jsxComponent.insertText, /interface|: .*Props/)

  const [tsxComponent] = harness.complete(context({ language: 'typescript', path: 'Component.tsx', linePrefix: 'rfc', column: 4 }))
  assert.match(tsxComponent.insertText, /interface .*Props/)

  const abbreviation = 'label.field[for=email]>img.icon'
  const [jsxElement] = harness.complete(context({
    language: 'javascript',
    path: 'Component.jsx',
    linePrefix: abbreviation,
    column: abbreviation.length + 1
  }))
  assert.equal(jsxElement.insertText, '<label className="field" htmlFor="email">\n\t<img className="icon" />\n</label>$0')
})

test('adds and merges React and Vue hook imports without duplicating them', () => {
  const harness = createHarness()
  harness.activate()

  const reactPrefix = "import { useEffect } from 'react';\nconst App = () => {\n  usestate"
  const [react] = harness.complete(context({
    language: 'javascript', path: 'App.jsx', linePrefix: '  usestate', column: 11, documentPrefix: reactPrefix
  }))
  assert.equal(react.additionalTextEdits.length, 1)
  assert.equal(react.additionalTextEdits[0].text, ' useEffect, useState ')
  assert.equal(react.additionalTextEdits[0].startLine, 1)

  const existingPrefix = "import { useState } from 'react';\nusestate"
  const [existing] = harness.complete(context({
    language: 'javascript', path: 'App.jsx', linePrefix: 'usestate', column: 9, documentPrefix: existingPrefix
  }))
  assert.equal(existing.additionalTextEdits, undefined)

  const vuePrefix = '<script setup lang="ts">\nvref'
  const [vue] = harness.complete(context({
    language: 'html', path: 'App.vue', linePrefix: 'vref', column: 5, documentPrefix: vuePrefix
  }))
  assert.deepEqual(vue.additionalTextEdits, [{
    startLine: 2, startColumn: 1, endLine: 2, endColumn: 1, text: "import { ref } from 'vue';\n"
  }])

  const [truncated] = harness.complete(context({
    language: 'typescript', path: 'App.tsx', linePrefix: 'useeffect', column: 10,
    documentPrefix: 'useeffect', documentPrefixTruncated: true
  }))
  assert.equal(truncated.additionalTextEdits, undefined)
})

test('does not scan through existing HTML tags for nested or adjacent abbreviations', () => {
  const harness = createHarness()
  harness.activate()

  const nestedPrefix = '<table>tr'
  const [nested] = harness.complete(context({
    column: nestedPrefix.length + 1,
    linePrefix: nestedPrefix
  }))
  assert.equal(nested.label, 'tr')
  assert.equal(nested.insertText, '<tr>${1}</tr>$0')
  assert.equal(nested.replaceStartColumn, 8)

  const siblingPrefix = '<header></header>main'
  const [sibling] = harness.complete(context({
    column: siblingPrefix.length + 1,
    linePrefix: siblingPrefix
  }))
  assert.equal(sibling.label, 'main')
  assert.equal(sibling.replaceStartColumn, 18)
})

test('supports repeated named snippets in every language family', () => {
  const harness = createHarness()
  harness.activate()

  const cases = [
    { language: 'css', path: 'style.css', linePrefix: 'display: block;df', label: 'df' },
    { language: 'scss', path: 'style.scss', linePrefix: '$gap: 1rem;dg', label: 'dg' },
    { language: 'less', path: 'style.less', linePrefix: '@gap: 1rem;center', label: 'center' },
    { language: 'javascript', path: 'app.js', linePrefix: 'const ready = true;clg', label: 'clg' },
    { language: 'typescript', path: 'app.ts', linePrefix: 'type Id = string;interface', label: 'interface' },
    { language: 'javascript', path: 'Component.jsx', linePrefix: 'const ready = true;rafc', label: 'rafc' },
    { language: 'typescript', path: 'Component.tsx', linePrefix: 'type Props = {};rfc', label: 'rfc' },
    { language: 'html', path: 'Component.vue', linePrefix: 'const ready = true;vref', documentPrefix: '<script setup>\nconst ready = true;vref', label: 'vref' }
  ]

  for (const item of cases) {
    const [completion] = harness.complete(context({
      ...item,
      column: item.linePrefix.length + 1
    }))
    assert.equal(completion?.label, item.label, `${item.path} should complete ${item.label}`)
    assert.equal(completion?.replaceStartColumn, item.linePrefix.length - item.label.length + 1)
  }
})

test('uses document context for HTML and Vue script, style, and markup regions', () => {
  const harness = createHarness()
  harness.activate()

  const complete = (overrides) => harness.complete(context({
    ...overrides,
    column: overrides.linePrefix.length + 1
  }))[0]

  assert.equal(complete({
    language: 'html', path: 'Component.vue', linePrefix: 'p10', documentPrefix: '<style scoped>\np10'
  }).insertText, 'padding: 10px;')
  assert.match(complete({
    language: 'html', path: 'Component.vue', linePrefix: 'clg', documentPrefix: '<script setup>\nclg'
  }).insertText, /console\.log/)
  assert.match(complete({
    language: 'html', path: 'Component.vue', linePrefix: 'section', documentPrefix: '<template>\nsection'
  }).insertText, /^<section>/)
  assert.equal(complete({
    language: 'html', path: 'index.html', linePrefix: 'df', documentPrefix: '<style>\ndf'
  }).insertText, 'display: flex;')
  assert.match(complete({
    language: 'html', path: 'index.html', linePrefix: 'clg', documentPrefix: '<script>\nclg'
  }).insertText, /console\.log/)

  assert.deepEqual(harness.complete(context({
    language: 'html', path: 'Component.vue', linePrefix: 'vref', column: 5, documentPrefix: '<template>\nvref'
  })), [])
  assert.deepEqual(harness.complete(context({
    language: 'html', path: 'Component.vue', linePrefix: '<', column: 2, documentPrefix: '<script setup>\nconst x = a <'
  })), [])
})

test('supports dynamic CSS spacing, sizing, and color abbreviations', () => {
  const harness = createHarness()
  harness.activate()

  for (const [abbreviation, insertText] of [
    ['m10', 'margin: 10px;'],
    ['mx10-20', 'margin-inline: 10px 20px;'],
    ['p5p', 'padding: 5%;'],
    ['w50p', 'width: 50%;'],
    ['minh100vh', 'min-height: 100vh;'],
    ['fz16', 'font-size: 16px;'],
    ['gap0', 'gap: 0;'],
    ['bg#1a2b3c', 'background-color: #1a2b3c;'],
    ['c#fff', 'color: #fff;']
  ]) {
    const [completion] = harness.complete(context({
      language: 'css', path: 'style.css', linePrefix: abbreviation, column: abbreviation.length + 1
    }))
    assert.equal(completion?.insertText, insertText, abbreviation)
  }
})

test('applies per-language toggles and formatting preferences', () => {
  const harness = createHarness()
  harness.activate()

  harness.setConfiguration(HTML_ENABLED_KEY, false)
  assert.deepEqual(harness.complete(context({ linePrefix: 'div', column: 4 })), [])
  harness.setConfiguration(HTML_ENABLED_KEY, true)
  harness.setConfiguration(AUTO_HTML_TAGS_KEY, false)
  assert.deepEqual(harness.complete(context({ linePrefix: '<', column: 2 })), [])

  harness.setConfiguration(CSS_ENABLED_KEY, false)
  assert.deepEqual(harness.complete(context({ language: 'css', path: 'style.css', linePrefix: 'df', column: 3 })), [])

  harness.setConfiguration(QUOTE_STYLE_KEY, 'single')
  harness.setConfiguration(INDENT_STYLE_KEY, 'spaces-2')
  const abbreviation = 'div.card>span'
  const [completion] = harness.complete(context({ linePrefix: abbreviation, column: abbreviation.length + 1 }))
  assert.equal(completion.insertText, "<div class='card'>\n  <span>${1}</span>\n</div>$0")
})

test('makes every snippet-guide leaf clickable and inserts through the editor API', () => {
  const harness = createHarness()
  harness.activate()

  const leaves = harness.viewItems.flatMap((group) => group.children || [])
  assert.ok(leaves.length > 50)
  assert.ok(leaves.every((item) => item.command && item.description === 'Click to insert'))

  const document = leaves.find((item) => item.label === '!')
  const flex = leaves.find((item) => item.label === 'df')
  harness.runCommand(document.command)
  harness.runCommand(flex.command)
  assert.match(harness.insertedSnippets[0], /<!DOCTYPE html>/)
  assert.equal(harness.insertedSnippets[1], 'display: flex;')
})

test('recognizes named snippets after operators without matching members or selectors', () => {
  const harness = createHarness()
  harness.activate()

  for (const item of [
    { language: 'javascript', path: 'app.js', linePrefix: 'const log = () =>clg', label: 'clg' },
    { language: 'typescript', path: 'Component.tsx', linePrefix: 'const view = () =>rafc', label: 'rafc' },
    { language: 'html', path: 'Component.vue', linePrefix: 'watch(source, () =>vref', documentPrefix: '<script setup>\nwatch(source, () =>vref', label: 'vref' }
  ]) {
    const [completion] = harness.complete(context({
      ...item,
      column: item.linePrefix.length + 1
    }))
    assert.equal(completion?.label, item.label)
    assert.equal(completion?.replaceStartColumn, item.linePrefix.length - item.label.length + 1)
  }

  for (const item of [
    { language: 'javascript', path: 'app.js', linePrefix: 'console.clg' },
    { language: 'css', path: 'style.css', linePrefix: '.df' },
    { language: 'scss', path: 'style.scss', linePrefix: '#center' },
    { language: 'less', path: 'style.less', linePrefix: 'display:df' }
  ]) {
    assert.deepEqual(harness.complete(context({
      ...item,
      column: item.linePrefix.length + 1
    })), [])
  }
})

test('keeps language-specific snippet sets isolated', () => {
  const harness = createHarness()
  harness.activate()

  for (const item of [
    { language: 'css', path: 'style.css', abbreviation: 'clg' },
    { language: 'javascript', path: 'app.js', abbreviation: 'df' },
    { language: 'typescript', path: 'app.ts', abbreviation: 'vref' },
    { language: 'html', path: 'index.html', abbreviation: 'rafc' }
  ]) {
    assert.deepEqual(harness.complete(context({
      language: item.language,
      path: item.path,
      column: item.abbreviation.length + 1,
      linePrefix: item.abbreviation
    })), [])
  }
})

test('returns no completion for a wrong language or while disabled', () => {
  const harness = createHarness(false)
  harness.activate()

  assert.deepEqual(harness.complete(context()), [])
  assert.deepEqual(harness.complete(context({ language: 'plaintext', path: 'notes.txt' })), [])

  harness.setConfiguration(true)
  assert.equal(harness.complete(context()).length, 1)

  harness.setConfiguration(false)
  assert.deepEqual(harness.complete(context()), [])
})

test('cleanup disposes the provider and configuration listener exactly once', () => {
  const harness = createHarness()
  const dispose = harness.activate()

  dispose()
  dispose()

  assert.deepEqual(harness.disposalCounts, { completions: 1, configuration: 1 })
})
