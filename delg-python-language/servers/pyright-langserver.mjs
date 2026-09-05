import process from 'node:process'

try {
  // Pyright publishes a ready-to-run stdio server. Importing the bundled file
  // keeps the launch inside the IDE-managed Node utility process and avoids a
  // global `pyright`/npm installation.
  await import(new URL('../node_modules/pyright/dist/pyright-langserver.js', import.meta.url))
} catch (error) {
  process.stderr.write(`Python language support needs its pinned Pyright dependency. Reinstall the DELG Python Language plugin (${String(error)})\n`)
  process.exitCode = 1
}
