# DELG Web Forge

A practical web-development toolkit for DELG Code IDE. Type `!` in HTML for an automatic document suggestion, start any HTML or JSX element with `<` for the complete tag catalog, or type an abbreviation below and press `Ctrl+Space`.

Version 0.6.0 targets DELG IDE 0.17.2 and newer. Its marketplace listing
includes a compact plugin icon and a gallery preview under `media/`.

Open the **Web Forge** sidebar for a searchable, clickable snippet guide, or run **Web Forge: Show Snippet Guide** from the command palette. Clicking a leaf inserts its snippet into the active editor. The guide command is also available from the editor context menu and with `Ctrl+Alt+W` (`Cmd+Alt+W` on macOS).

Plugin settings provide a global switch plus separate HTML, CSS, JavaScript, and framework switches. Automatic tag discovery, HTML quote style, and tabs/two-space/four-space indentation are configurable independently.

## HTML and Vue templates

- `!`, `html:5`, `link:css`, `script:src`, `meta:vp`
- `div.card`, `main#app`, `.container`
- `ul>li*3`, `header+main+footer`
- `div>span+em`, `div>span^p`, `(header>nav)+main`
- `button.primary[type=button]{Save}`
- `ul>.item$*3`, `(li.item$>a{Item $})*3`
- `picture`, `details`, `form:get`, `form:post`

Plain words are not expanded as made-up tags. Native HTML elements, hyphenated
custom elements, attributes, text, grouping, climb-up, numbering, implicit contextual tags, and structural expressions are supported. HTML inside `<template>`, JavaScript inside `<script>`, and CSS inside `<style>` are detected in HTML and Vue files.

## CSS, SCSS, and Less

- Layout: `df`, `dg`, `center`, `gridauto`
- Positioning: `posa`, `posr`, `posf`
- Sizing and spacing: `m`, `mx`, `p`, `w100`, `h100`, `minfull`
- Styling: `c`, `bgc`, `fz`, `fw`, `br`, `shadow`, `transition`, `truncate`
- Structures: `media`, `keyframes`, `vars`
- Dynamic spacing: `m10`, `mx10-20`, `p5p`
- Dynamic sizing: `w50p`, `minh100vh`, `fz16`, `gap8`
- Dynamic colors: `bg#1a2b3c`, `c#fff`

## JavaScript and TypeScript

- Logging/imports: `clg`, `cle`, `imp`, `imd`, `exp`
- Functions/control flow: `fn`, `afn`, `trycatch`, `forof`
- Data/network: `fetch`, `map`, `filter`, `reduce`, `promise`, `debounce`
- TypeScript: `interface`, `type`, `enum`, `guard`, `generic`

## React (`.jsx` and `.tsx`)

- Components: `rfc`, `rafc`
- Hooks: `usestate`, `useeffect`, `usememo`, `usecallback`

`rfc` emits JavaScript-safe output in `.jsx` and typed props in `.tsx`. HTML abbreviations emit JSX-safe `className`, `htmlFor`, and self-closing void elements. Hook completions add or merge the required React named import when the document context is available.

## Vue (`.vue`)

- Component: `vbase`
- Composition API: `vref`, `vcomputed`, `vwatch`, `vonmounted`
- Component contracts: `vdefineprops`, `vdefineemits`

Vue completions distinguish `<template>`, `<script>`, and `<style>` regions. Composition API completions add or merge their Vue imports inside the active `<script>` block.

## Your own snippets

Run **Web Forge: Edit Custom Snippets** to open `.delg/snippets.json` in the
project (it is created with two examples the first time). Commit it to share
the snippets with your team. Changes apply as soon as the file is saved.

```json
{
  "snippets": {
    "card": {
      "description": "A card with a title",
      "languages": ["html", "vue", "jsx", "tsx"],
      "body": ["<div class=\"card\">", "\t<h2>${1:Title}</h2>", "\t$0", "</div>"]
    },
    "todo": { "body": "// TODO(${1:name}): $0" }
  }
}
```

- Names use letters, digits, `-` and `_`, and expand with `Ctrl+Space` like the
  built-in abbreviations. A snippet with the same name as a built-in one
  replaces it.
- `body` is text or a list of lines. `$1`, `${1:default}` and `$0` mark tab
  stops.
- `languages` is optional (all languages when left out) and may list `html`,
  `css`, `scss`, `less`, `javascript`, `typescript`, `vue`, `jsx` and `tsx`.
  In Vue and HTML files, the `<style>` and `<script>` blocks also count as
  `css` and `javascript` (or `typescript`).
- Mistakes in the file are shown as a warning, and the other snippets keep
  working.

## Local development

1. Build and run the IDE.
2. Open **Developer Plugins: Manage Local Plugins** from the command palette.
3. Enable Developer Mode.
4. Link the `delg-web-forge` folder from this repository.

## Build

Run `npm install` once inside `delg-web-forge`, then run `npm run build`. The
self-contained build runs the complete test suite first, validates matching
package and manifest versions, verifies the embedded archive bytes, and removes
older Web Forge packages so the folder contains only the artifact matching the
current manifest version.

The package uses the schema-v2 sandboxed completion API. Its declared
capabilities are reviewed at install time and sensitive operations receive a
separate first-use approval; it does not require the deprecated `full-host`
runtime. The package itself is not a certificate and does not prove publisher
identity: marketplace installation also verifies the download SHA-256 and a
server-issued certificate whose publisher ID matches the manifest. Developer-
mode folder links remain local development plugins and do not use the signed
marketplace certificate flow.

The packaged manifest anchors version 0.5.1 to source commit
`d932a99c468e518fabe1d7e2ff65abd3ac1f172a` for marketplace provenance.
