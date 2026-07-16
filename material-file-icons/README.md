# Material File Icons

Source repository: [DELG-Code-IDE-Plugins](https://github.com/DELG-Software/DELG-Code-IDE-Plugins)

A sandboxed Trusted UI plugin for DELG Code IDE 0.3.0 and newer. It registers
Material Design SVG Explorer icons for more than 120 file extensions.

## Features

- Material-style filled SVG Explorer icons with a readable color palette.
- Coverage for languages, web frameworks, configuration, shell scripts,
  documents, data, media, archives, and infrastructure files.
- A static status-bar item showing the number of icons registered.
- **Material File Icons: Show Summary**, available from the command palette,
  editor context menu, and `Ctrl+Alt+I` (`Cmd+Alt+I` on macOS).

Example registrations:

| Extension | Material icon | Color | Category |
|-----------|---------------|-------|----------|
| `.py` | code | `#3776AB` | Languages |
| `.ts` | code | `#3178C6` | Web frameworks and assets |
| `.vue` | code | `#42B883` | Web frameworks and assets |
| `.env` | settings | `#82AAFF` | Configuration |
| `.sh` | terminal | `#4EAA25` | Shells and scripts |
| `.graphql` | schema | `#E91E63` | Documents and data |
| `.dockerfile` | build | `#2496ED` | Archives and infrastructure |

## Trusted UI runtime

Version 1.2.0 targets `engines.delgIde >=0.3.0` and uses only documented
plugin APIs and manifest contributions:

- `delg.ui.registerExplorerIcon` registers the safe 24x24 SVG path and color
  for each extension.
- `delg.ui.registerStatusBarItem`, `delg.ui.setStatus`, and
  `delg.ui.showMessage` report registration status and the command summary.
- `delg.registerCommand` implements the manifest-declared summary command;
  its palette entry, editor-context menu, and keybinding are declarative.

Explorer icons, the status-bar item, menus, and keybinding make
this a Trusted UI release. The plugin does not access the host DOM, clipboard,
active-tab internals, workspace files, network, Git, or Full Host APIs.

All command and status-item IDs are namespaced under
`delg.material-file-icons`. The marketplace icon and gallery image are declared
as `media/icon.png` and `media/overview.png`; both are packaged PNG files under
the 2 MB per-image limit.

## Local development and tests

Build and run DELG Code IDE, open **Developer Plugins: Manage Local Plugins**,
enable Developer Mode, and link this `material-file-icons` folder. Development
mode reads `manifest.json` and `dist/plugin.js`, so rebuild after changing
`src/plugin.js`.

Before publishing, run the standalone plugin tests and build, then the shared
IDE manifest-validator suite and backend package/manifest suite:

```powershell
# From material-file-icons
node --check src/plugin.js
node --test plugin.test.mjs
node build.mjs

# From DELG-Code/ide
npm test -- src/shared/pluginManifest.test.ts

# From DELG-Code/backend
go test ./services -run 'Test(StorePluginArtifact|RequiredPluginCertificationLevel)'
```

Then link the folder in Developer Mode and smoke-test Explorer icons, the
status-bar text, summary command, both menu locations, and the
Windows/Linux and macOS keybindings.

## Package and hash

From this plugin folder, `node build.mjs` copies `src/plugin.js` to
`dist/plugin.js` and creates `material-file-icons-1.2.0.delg-plugin`. The ZIP
archive contains exactly:

```text
manifest.json
dist/plugin.js
media/icon.png
media/overview.png
```

The build uses fixed ZIP timestamps, verifies the archived file set and bytes,
writes the package atomically, and prints the SHA-256 digest. Repeating a build
from identical inputs produces the same bytes and digest. You can independently
check the final archive with:

```powershell
Get-FileHash .\material-file-icons-1.2.0.delg-plugin -Algorithm SHA256
```

The marketplace records and the IDE verifies the SHA-256 of the uploaded
artifact. The archive itself is not a certificate and does not prove publisher
identity.

## License and media

Embedded Google Material Icons path data is Apache-2.0 licensed; see the
[upstream Material Icons repository](https://github.com/material-icons/material-icons).
The custom marketplace artwork in `media/icon.png` and `media/overview.png` is
included in the release archive and referenced by package-relative manifest
paths. This repository currently has no top-level license file defining the
terms for the plugin source or custom artwork; add or confirm those terms before
publishing.

## 1.2.0 release-candidate status

Version 1.2.0 is a local release candidate with uncommitted redesign changes.
For that reason, `manifest.json` intentionally has no `source` block yet: using
the current `HEAD`, a branch name, or a placeholder such as `local` would claim
false provenance.

Publish only after committing the exact source used to build the final archive.
After that commit, add `source.repository` with the canonical repository URL and
`source.commit` with that exact commit SHA, rebuild the archive, rerun the checks
above, and provide the same repository and commit on the publish page. Do not
reuse a hash or provenance value from an earlier build.
