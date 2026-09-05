// The package is installed into the plugin artifact at release time. Keeping
// this tiny entrypoint in the signed archive lets the IDE launch it with its
// own Node-compatible utility process instead of relying on global npm.
import process from 'node:process'

try {
  // The package's official CLI wires Vue's TypeScript plugin and the stdio
  // transport together. Importing it from the signed artifact keeps all
  // dependencies offline and inside the IDE-managed Node utility process.
  await import(new URL('../node_modules/@vue/language-server/bin/vue-language-server.js', import.meta.url))
} catch (error) {
  process.stderr.write(`Vue language support needs its pinned server dependencies. Reinstall the DELG Vue Language plugin (${String(error)})\n`)
  process.exitCode = 1
}
