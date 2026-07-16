# Official [DELG Code](https://code.delg.dev) IDE Plugins

First-party plugins built against the current DELG IDE plugin contract.

| Plugin | Purpose | Certification |
| --- | --- | --- |
| [Material File Icons](./material-file-icons/) | Material Design SVG icons and an in-IDE icon catalog. | Trusted UI |
| [DELG Web Forge](./delg-web-forge/) | Web-development abbreviations and Monaco completion snippets. | Full Host |

The source folder for each plugin contains its manifest, runtime entry point,
build script, documentation, and versioned `.delg-plugin` archive. Compatibility
is declared with `engines.delgIde`; there is no separate plugin API version.

See the [current plugin development documentation](https://code.delg.dev/plugins/docs)
for manifest rules, runtime APIs, certification levels, and publishing steps.
