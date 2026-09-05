# DELG Go Language

This optional plugin adds project-wide Go language intelligence through the
official `gopls` server. The IDE starts it lazily for folders containing
`go.mod` or `go.work`, and uses the Go toolchain already installed on the
machine. It works offline after installation.

Install Go and make sure `gopls` is on the Go toolchain path. If it is missing,
the IDE reports the command and project marker needed to finish setup. The
plugin does not run arbitrary plugin processes: the IDE owns the server and
its LSP transport.

License: `LICENSE-gopls.txt` contains the upstream license notice that belongs
with the server dependency.
