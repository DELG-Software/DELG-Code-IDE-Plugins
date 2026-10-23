# DELG Config Files

This optional plugin adds checking, completion, hover, outline and formatting
for YAML, JSON (including JSON with comments) and TOML files.

- **YAML** runs Red Hat's yaml-language-server. GitHub workflows,
  docker-compose files, Kubernetes manifests and other well-known files are
  checked against their SchemaStore.org schemas.
- **JSON** runs the JSON language server from VS Code, with schemas for
  `package.json`, `tsconfig.json`, `.eslintrc`, `.prettierrc`, `turbo.json`,
  `composer.json` and more. A `$schema` property in the file also works.
- **TOML** runs Taplo for syntax checks, formatting and outline. Schemas are
  not available for TOML yet.

## Requirements

- Node.js 18 or newer, which runs the three servers.
- An internet connection the first time a server starts. The IDE then
  downloads the exact releases pinned in `package-lock.json` from npm, checks
  them against the lockfile's hashes, and keeps them, so later starts work
  offline. Schemas are downloaded when a matching file is opened.

## Settings

- **delg.config-language.schemaStore** (default on): check well-known files
  against SchemaStore.org schemas. Turn it off to keep checks offline; syntax
  checks and formatting still work.

## Commands

- **Config Files: Restart Language Servers**
- **Config Files: Show Setup Help**

If a server cannot start, a warning explains what to install or check. The
licenses of the bundled servers and their dependencies are in `LICENSES.txt`.
