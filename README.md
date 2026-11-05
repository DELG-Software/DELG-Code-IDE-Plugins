# Official [DELG Code](https://code.delg.dev) IDE Plugins

First-party plugins built against the current DELG IDE plugin contract.

| Plugin | Purpose | Certification |
| --- | --- | --- |
| [Material File Icons](./material-file-icons/) | Material Design SVG icons and an in-IDE icon catalog. | Trusted UI |
| [DELG Web Forge](./delg-web-forge/) | Web-development abbreviations and sandboxed Monaco completion snippets. | Trusted UI |
| [DELG Live Server](./delg-live-server/) | Loopback static server with browser live reload. | Verified |
| [DELG Go Language](./delg-go-language/) | Optional Go language intelligence through the installed `gopls` toolchain. | Trusted UI |
| [DELG Vue Language](./delg-vue-language/) | Optional Vue, TypeScript, and JavaScript intelligence with Vue's TypeScript plugin. | Trusted UI |
| [DELG Python Language](./delg-python-language/) | Optional Python intelligence through a packaged Pyright entrypoint and project environments. | Trusted UI |
| [DELG Rust Language](./delg-rust-language/) | Optional Rust intelligence through the installed `rust-analyzer`. | Trusted UI |
| [DELG C/C++ Language](./delg-cpp-language/) | Optional C and C++ intelligence through the installed `clangd`. | Trusted UI |
| [DELG Mercurial](./delg-mercurial/) | Read-only Mercurial working-copy status in Source Control. | Trusted UI |
| [DELG Config Files](./delg-config-language/) | YAML, JSON and TOML checking, completion and formatting, with SchemaStore schemas. | Trusted UI |
| [DELG Prettier](./delg-prettier/) | Prettier formatting through sandboxed editor providers. | Requires Trusted UI |
| [DELG ESLint](./delg-eslint/) | Project ESLint diagnostics and code fixes. | Requires Trusted UI |
| [DELG Test Runner](./delg-test-runner/) | Individual Vitest, pytest and Go cases, selected runs, durations and failure output; npm script fallback. | Requires Verified and a testing-controller engine build |

Published plugin folders contain their manifest, runtime entry point, build
script, documentation, and versioned `.delg-plugin` archive. The Test Runner is
a source-only draft until an engine build with the testing-controller API is
available. Compatibility is declared with `engines.delgIde`; there is no
separate plugin API version.

The source manifests declare schema-v2 lazy activation for the forthcoming
DELG Code IDE 0.39.0 engine. A 0.39.0 version number alone does not guarantee
an engine build has shipped this feature. Existing release archives are
unchanged; build new archives only when preparing those plugin releases.

See the [current plugin development documentation](https://code.delg.dev/plugins/docs)
for manifest rules, runtime APIs, certification levels, and publishing steps.
