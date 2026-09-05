# DELG Python Language

This optional plugin adds Pyright completion, hover, signature help,
definitions, references, symbols, diagnostics, code actions, formatting, and
rename. The IDE uses the configured interpreter first, then detects a
workspace `.venv` or `venv` when auto-detection is enabled.

Pyright and its license are pinned in the release artifact. The IDE launches
the packaged entrypoint with its Node-compatible utility process and reports a
direct reinstall/setup message when a dependency or interpreter is missing.
