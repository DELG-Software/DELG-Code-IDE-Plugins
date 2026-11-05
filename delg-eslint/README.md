# DELG ESLint

This optional plugin runs the ESLint language server for JavaScript, JSX,
TypeScript, and TSX files. It reports the diagnostics produced by the ESLint
configuration and plugins installed in the opened project.

## Requirements

- DELG Code IDE 0.39.0 or newer, including pull diagnostics and supplemental language-server support.
- Node.js 18 or newer.
- ESLint installed in the workspace, for example `npm install --save-dev eslint@9`.
- An ESLint configuration (`eslint.config.*` for flat config or `.eslintrc*`
  for legacy config).
- The first start downloads the exact server packages pinned in the bundled
  lockfile from npm. The IDE verifies each package against its lockfile hash
  and keeps the packages for later offline starts.

This plugin bundles `vscode-langservers-extracted` 4.10.0, whose ESLint server
supports ESLint 6 through 9, including flat config. ESLint 10 is not supported
by this server version. The project ESLint version and its configuration stay
under the project's control; the plugin does not install or change them.
TypeScript and JSX linting use the project's configured ESLint parsers and plugins.

## Using it

- The status bar shows the language server state. Click it to restart the
  server or open setup help.
- **ESLint: Restart Language Server** and **ESLint: Show Setup Help** are in
  the command palette.
- Diagnostics run while editing. Use the editor's **Fix all fixable ESLint
  problems** source action where available.

The updated development engine also supports individual quick fixes that use
`workspace/executeCommand`. It binds each action to the exact language-server
process that returned it and validates server-requested edits before
acknowledging them. Older engine builds retain edit-based fix-all support.
This plugin is marked supplemental so it can add lint
diagnostics alongside the IDE's built-in JavaScript and TypeScript features;
coexisting with other language servers requires an IDE build that fans requests
out to multiple matching servers.

For startup failures, open the Plugins sidebar's **Language servers** section
to inspect the diagnostic and output, open this plugin's setup help, or restart
only the ESLint server. These controls require the updated development engine.

Upstream third-party license notices ship in `LICENSES.txt`.

## Building

Run `npm ci`, `npm test`, and `npm run build` in this folder. The archive has
an explicit allowlist: manifest, runtime plugin, server entrypoint, dependency
metadata and lockfile, README, and license notices. Dependencies are hydrated
by the IDE from the integrity-pinned lockfile; `node_modules` is not shipped.

This draft's `source.commit` identifies the repository base. Update it to the
commit containing the plugin and rebuild before marketplace publishing. The
archive still requires publisher signing and Trusted UI certification.
