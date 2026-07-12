# Material File Icons

Source repository: [DELG-Code-IDE-Plugins](https://github.com/DELG-Software/DELG-Code-IDE-Plugins)

A DELG IDE plugin that adds real Material Design SVG icons to the explorer and
a handful of workspace utility commands. It uses Google's filled Material
Icons path data in a 24×24 viewBox, with a readable Material color palette for
**120+ file extensions** spanning languages, web frameworks, config formats,
shell scripts, data files, images, fonts, audio, video, archives, and
build/infra tooling.

The embedded Material Icons are Apache-2.0 licensed; see the
[upstream icon set](https://github.com/material-icons/material-icons).

## What it does

### Explorer icons

Each registered file extension gets an official Material icon paired with a
Material Design color. Formats without a brand-specific Material glyph use a
generic official symbol such as `code` or `description` rather
than inventing a logo. For example:

| Extension | Material icon | Color | Category |
|-----------|-------|-------|----------|
| `.py` | code | #3776AB | Python |
| `.ts` | code | #3178C6 | TypeScript |
| `.vue` | code | #42B883 | Vue |
| `.svelte` | code | #FF3E00 | Svelte |
| `.env` | settings | #82AAFF | Config |
| `.sh` | terminal | #4EAA25 | Shell |
| `.graphql` | schema | #E91E63 | Data |
| `.dockerfile` | build | #2496ED | Infra |

The default explorer only colors ~15 extensions.  This plugin fills in the
rest so every file in your tree has a visual identity.

### Status bar

The bottom status bar shows the language of the currently active editor tab
(e.g. "TypeScript", "Rust", "YAML") so you always know what you're editing.

### Commands

| Command | Description |
|---------|-------------|
| Copy Active File Path | Copies the absolute path of the current file to your clipboard |
| Copy Active Relative Path | Copies the workspace-relative path |
| Duplicate Active File | Creates a copy of the current file and opens it |
| Show Registered File Icons | Prints every registered extension and its color |

## Install locally

Open the DELG IDE command palette (`Ctrl+Shift+P`) and choose **Developer
Plugins: Manage Local Plugins**.  Enable Developer Mode and link this folder
(`examples/material-file-icons/`).  The IDE loads the plugin immediately and
will reload it when you edit the source.

To build the distributable `.delg-plugin` package (for marketplace upload):

    node examples/material-file-icons/build.mjs

## Certification level

This plugin only uses capabilities available at **Trusted UI** level:

- Explorer icon registration
- Status bar items
- Command palette commands
- Workspace reads (for the duplicate-file command)

It does not require Full Host access and is safe to run from the marketplace.
