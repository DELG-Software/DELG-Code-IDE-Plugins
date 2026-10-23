# DELG Rust Language

This optional plugin adds project-wide Rust language intelligence through
`rust-analyzer`: completion, hover, go to definition, references, inlay
hints, diagnostics from `cargo check` or `cargo clippy`, code actions, rename
and formatting. The IDE starts it for folders containing `Cargo.toml` or
`rust-project.json`, and uses the Rust toolchain already installed on the
machine.

## Requirements

Rust from [rustup.rs](https://rustup.rs) and the rust-analyzer component:

```sh
rustup component add rust-analyzer
```

Make sure your Cargo `bin` folder is on PATH. If `rust-analyzer` is missing,
a warning says how to install it.

## Using it

- The status bar shows the server's state. Click it to restart the server or
  read the setup help.
- **Rust: Restart Language Server** and **Rust: Show Setup Help** are in the
  command palette.
- Settings: **check command** (`check`, or `clippy` for extra lints) and **all
  features** (analyze with every Cargo feature enabled). Changing either
  restarts the server.

The plugin does not run processes itself: the IDE owns the server and its LSP
transport.
