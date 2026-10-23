# DELG C/C++ Language

This optional plugin adds C and C++ language intelligence through `clangd`:
completion, hover, go to definition, references, diagnostics, clang-tidy
checks, code actions, rename and formatting. It uses the clangd already
installed on the machine and works offline.

## Requirements

clangd 15 or newer, which comes with LLVM:

- Windows: `winget install LLVM.LLVM`
- macOS: `brew install llvm`, or the Xcode command line tools
- Linux: the `clangd` package from your distribution

Make sure clangd is on PATH. If it is missing, a warning says how to install
it.

clangd needs to know how each file is compiled. For CMake projects, generate
`compile_commands.json`:

```sh
cmake -B build -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
```

clangd finds it in the project root or a `build` folder. Other projects can use
a `compile_flags.txt` or `.clangd` file. Without any of them, files are
checked with default flags.

## Using it

- The status bar shows the server's state. Click it to restart the server or
  read the setup help.
- **C/C++: Restart Language Server** and **C/C++: Show Setup Help** are in the
  command palette.
- Settings: **clang-tidy** checks (on by default, configured by the project's
  `.clang-tidy`), **header insertion** (`iwyu` or `never`) and the
  **compile commands folder**. Changing any of them restarts the server.

The plugin does not run processes itself: the IDE owns the server and its LSP
transport.
