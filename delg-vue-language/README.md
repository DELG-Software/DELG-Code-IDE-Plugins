# DELG Vue Language

This optional plugin provides Vue, TypeScript, and JavaScript completion,
hover, signature help, definitions, references, symbols, diagnostics, code
actions, formatting, and rename. Vue Language Tools and the TypeScript plugin
share one IDE-managed server so a symbol can be renamed across `.vue` and
`.ts` files, including files that are not currently open.

## Requirements

- Node.js 18 or newer, which runs the server.
- An internet connection the first time the server starts. The IDE then
  downloads the exact packages pinned in `package-lock.json` from npm, checks
  each one against the lockfile's hash, and keeps them, so later starts work
  offline. No global npm installation is needed.

## Using it

- The status bar shows the server's state. Click it to restart the server or
  read the setup help.
- **Vue: Restart Language Server** and **Vue: Show Setup Help** are in the
  command palette.

If the server cannot start, a warning explains what to install or check.
Upstream license notices ship in `LICENSES.txt`.
