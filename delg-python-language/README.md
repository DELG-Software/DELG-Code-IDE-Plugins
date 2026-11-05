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

## Debugging

Use an IDE build with the debugger plugin API and allow the plugin's debugging
permission. Install debugpy in the workspace `.venv` or `venv`, or in the
Python installation on PATH. The debugger uses that interpreter for launch.

With no selected launch configuration, open a Python file, set a gutter
breakpoint, and press F5. To save a launch or attach configuration, use
`delg.python-language.debugpy` as its type.

```json
{
  "version": 1,
  "configurations": [
    {
      "name": "Launch Python file",
      "type": "delg.python-language.debugpy",
      "request": "launch",
      "program": "${file}",
      "console": "debugConsole"
    },
    {
      "name": "Attach to local Python",
      "type": "delg.python-language.debugpy",
      "request": "attach",
      "address": "127.0.0.1",
      "port": 5678
    }
  ]
}
```

For attach, start the target with
`python -m debugpy --listen 127.0.0.1:5678 --wait-for-client app.py`.
Stopping an attach session detaches from the target. Unloading the plugin
ends its session and closes any adapter process the IDE started.
