// The IDE resolves this entrypoint from its immutable plugin-package folder.
// The extracted CommonJS server reads --stdio from process.argv and owns LSP.
import { createRequire } from 'node:module'

createRequire(import.meta.url)('../node_modules/vscode-langservers-extracted/bin/vscode-eslint-language-server')
