# DELG Go Language

This optional plugin adds project-wide Go language intelligence through the
official `gopls` server. The IDE starts it lazily for folders containing
`go.mod` or `go.work`, and uses the Go toolchain already installed on the
machine. It works offline after installation.

## Requirements

Go 1.22 or newer and `gopls`:

```sh
go install golang.org/x/tools/gopls@latest
```

Make sure your Go `bin` folder is on PATH. If `gopls` is missing, a warning
says how to install it.

## Using it

- The status bar shows the server's state. Click it to restart the server or
  read the setup help.
- **Go: Restart Language Server** and **Go: Show Setup Help** are in the
  command palette.
- Settings: **staticcheck** (extra analyses, on by default) and **build tags**
  (comma-separated, for example `integration,linux`). Changing either
  restarts the server.

The plugin does not run processes itself: the IDE owns the server and its LSP
transport. `LICENSE-gopls.txt` contains the upstream license notice that
belongs with the server dependency.

## Debugging

Install Delve and make `dlv` available on PATH:

```sh
go install github.com/go-delve/delve/cmd/dlv@latest
```

With a Go file active and no saved debug configuration selected, press F5 to
debug that file's package. The IDE validates the package directory inside the
open workspace and starts Delve's DAP server on an OS-assigned loopback port.
Saved configurations keep precedence over this F5 default.

For a saved local attach configuration, use an explicit positive process ID:

```json
{
  "version": 1,
  "configurations": [{
    "name": "Attach to Go process",
    "type": "delg.go-language.delve",
    "request": "attach",
    "processId": 1234
  }]
}
```

Stopping or unloading an attach session detaches and leaves the external Go
process running.
