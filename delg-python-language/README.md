# DELG Python Language

This optional plugin adds Pyright completion, hover, signature help,
definitions, references, symbols, diagnostics, code actions, formatting, and
rename. The IDE uses the configured interpreter first, then detects a
workspace `.venv` or `venv` when auto-detection is enabled.

## Requirements

- Node.js 18 or newer, which runs Pyright.
- An internet connection the first time the server starts. The IDE then
  downloads the exact Pyright release pinned in `package-lock.json` from npm,
  checks it against the lockfile's hash, and keeps it, so later starts work
  offline.

## Using it

- The status bar shows the server's state. Click it to restart the server,
  choose an interpreter or read the setup help.
- **Python: Choose Interpreter** lists the project's `.venv`, `venv` or `env`
  folder, automatic detection, or a path you type. The server restarts with
  the new interpreter.
- **Python: Restart Language Server** and **Python: Show Setup Help** are in
  the command palette.

If the server cannot start, a warning explains what to install or check.
Pyright's license ships in `LICENSE-pyright.txt`.
