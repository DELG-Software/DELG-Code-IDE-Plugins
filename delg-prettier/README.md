# DELG Prettier

DELG Prettier adds the Prettier document formatter to the IDE. It runs in the
plugin sandbox and ships a self-contained, readable bundle; it does not need a
Node.js installation or a project `node_modules` folder at runtime.

## Supported files

- JavaScript: `.js`, `.jsx`, `.mjs`, `.cjs`
- TypeScript: `.ts`, `.tsx`
- JSON: `.json`, `.jsonc`, `.json5`
- HTML and Vue: `.html`, `.htm`, `.vue`
- CSS: `.css`, `.scss`, `.less`
- YAML: `.yaml`, `.yml`
- Markdown: `.md`, `.markdown`, `.mdx`
- GraphQL: `.graphql`, `.gql`

Other extensions are left unchanged. Formatting uses Prettier 3.9.10 core
parsers bundled with the plugin.

## Project configuration

The formatter searches up to 32 parent folders from the file's folder toward
the workspace root and uses the first supported configuration it finds. It reads strict JSON from a
`prettier` object in `package.json`, `.prettierrc`, or `.prettierrc.json`.
Common Prettier options such as `semi`, `singleQuote`, `tabWidth`, and
`printWidth` are applied. Within one folder, `package.json#prettier` takes
precedence over `.prettierrc`, which takes precedence over `.prettierrc.json`.
Unsupported options, top-level `parser`, non-empty `overrides`, or external
plugins leave the document unchanged and report an error in plugin status.

The plugin requires DELG Code IDE `0.39.0` or newer.

In the updated development engine, **Settings → Editor → Formatters** lets you
choose DELG Prettier or the language server separately for each language.
Automatic mode selects one plugin formatter before the language server.
Ignored files remain unchanged; an empty Prettier result does not invoke a
different formatter. Documents larger than the plugin context limit are
skipped when a plugin formatter is selected.

This sandbox build does not load JavaScript, TypeScript, YAML, TOML, or JSON5
configuration files; `.editorconfig`; `overrides`; or external Prettier
plugins. If a supported JSON config asks for overrides or external plugins,
the formatter leaves the document unchanged and reports the limitation in the
plugin status. It never evaluates project configuration code.

The workspace-root `.prettierignore` and `.gitignore` are applied with
comments, negated patterns, `*`, `**`, `?`, character classes, and directory
patterns. Nested ignore files are not read. `node_modules` is always skipped.

## Limits and errors

The IDE sends at most 1 MiB of document text to a language provider and limits
each formatting edit to 1 MiB. DELG Prettier returns no edit when the input
reaches the context limit or formatted output exceeds the edit limit, so the
IDE cannot apply a truncated result. Syntax or supported-config errors also
return no edit and update the plugin status; they do not count as provider
failures.

## Development

```sh
npm ci
npm test
npm run build
```

`npm run build` bundles Prettier with esbuild without minification, runs the
tests, and creates `delg-prettier-0.1.0.delg-plugin`. The archive contains only
the manifest, runtime bundle, this README, and the complete Prettier and
bundled-dependency license notices.

The manifest's `source.commit` currently points at the repository base commit
used for this draft. Update it to the full commit containing this plugin and
rebuild the archive before publishing.
