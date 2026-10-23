// The IDE starts these three servers from the manifest's languageServers
// entries. The plugin registers them again with the SchemaStore setting
// applied, restarts them when it changes, and explains what to install when
// one cannot start.

const SCHEMA_STORE = 'https://json.schemastore.org/'

// Well-known JSON files and their schemas. YAML gets the same coverage from
// yaml-language-server's own SchemaStore support.
export const JSON_SCHEMAS = [
  { fileMatch: ['package.json'], url: SCHEMA_STORE + 'package.json' },
  { fileMatch: ['tsconfig.json', 'tsconfig.*.json'], url: SCHEMA_STORE + 'tsconfig.json' },
  { fileMatch: ['jsconfig.json', 'jsconfig.*.json'], url: SCHEMA_STORE + 'jsconfig.json' },
  { fileMatch: ['.eslintrc', '.eslintrc.json'], url: SCHEMA_STORE + 'eslintrc.json' },
  { fileMatch: ['.prettierrc', '.prettierrc.json'], url: SCHEMA_STORE + 'prettierrc.json' },
  { fileMatch: ['.babelrc', '.babelrc.json', 'babel.config.json'], url: SCHEMA_STORE + 'babelrc.json' },
  { fileMatch: ['lerna.json'], url: SCHEMA_STORE + 'lerna.json' },
  { fileMatch: ['renovate.json', '.renovaterc', '.renovaterc.json'], url: SCHEMA_STORE + 'renovate.json' },
  { fileMatch: ['nest-cli.json', '.nest-cli.json'], url: SCHEMA_STORE + 'nest-cli.json' },
  { fileMatch: ['appsettings.json', 'appsettings.*.json'], url: SCHEMA_STORE + 'appsettings.json' },
  { fileMatch: ['composer.json'], url: 'https://getcomposer.org/schema.json' },
  { fileMatch: ['vercel.json'], url: 'https://openapi.vercel.sh/vercel.json' },
  { fileMatch: ['.swcrc'], url: 'https://swc.rs/schema.json' },
  { fileMatch: ['turbo.json'], url: 'https://turbo.build/schema.json' }
]

const HELP = 'YAML, JSON and TOML support runs on Node.js and downloads its language servers from npm the first time they start. Install Node.js 18 or newer from nodejs.org if you have not, check your internet connection, then run "Config Files: Restart Language Servers".'

export function serverSpecs(delg) {
  const schemaStore = delg.workspace.getConfiguration('delg.config-language.schemaStore') !== false
  return [
    {
      id: 'delg.config-language.yaml',
      languages: ['yaml'],
      command: '',
      entrypoint: 'servers/yaml-language-server.mjs',
      args: ['--stdio'],
      configuration: {
        yaml: {
          validate: true,
          hover: true,
          completion: true,
          format: { enable: true },
          schemaStore: { enable: schemaStore, url: 'https://www.schemastore.org/api/json/catalog.json' }
        },
        redhat: { telemetry: { enabled: false } }
      }
    },
    {
      id: 'delg.config-language.json',
      languages: ['json', 'jsonc'],
      command: '',
      entrypoint: 'servers/json-language-server.mjs',
      args: ['--stdio'],
      configuration: {
        provideFormatter: true,
        json: {
          validate: { enable: true },
          format: { enable: true },
          schemas: schemaStore ? JSON_SCHEMAS : []
        }
      }
    },
    {
      id: 'delg.config-language.toml',
      languages: ['toml'],
      command: '',
      entrypoint: 'servers/toml-language-server.mjs',
      args: [],
      configuration: {
        configurationSection: 'evenBetterToml',
        // Taplo's schema catalog cannot be read from its WebAssembly build,
        // so TOML gets syntax checks, formatting and outline without schemas.
        evenBetterToml: { schema: { enabled: false }, formatter: {} }
      }
    }
  ]
}

export default function activate(delg) {
  const quiet = (promise) => { Promise.resolve(promise).catch(() => undefined) }
  let handles = []
  let warned = false
  let disposed = false

  const failed = (status) => {
    if ((status === 'error' || status === 'paused') && !warned) {
      warned = true
      quiet(delg.ui.showWarningMessage(HELP))
    }
    if (status === 'running') warned = false
  }

  const register = async () => {
    if (disposed) return
    for (const handle of handles) handle.dispose()
    handles = []
    for (const spec of serverSpecs(delg)) {
      try {
        const handle = await delg.languageServers.register(spec)
        if (disposed) {
          handle.dispose()
          continue
        }
        handle.onDidChangeStatus(failed)
        handles.push(handle)
      } catch (error) {
        quiet(delg.ui.setStatus('Config files: ' + String((error && error.message) || error).slice(0, 200)))
        failed('error')
      }
    }
  }
  let queue = Promise.resolve()
  const restart = () => (queue = queue.then(register))

  delg.registerCommand('delg.config-language.restart', 'Config Files: Restart Language Servers', () => restart())
  delg.registerCommand('delg.config-language.setupHelp', 'Config Files: Show Setup Help', () => quiet(delg.ui.showInformationMessage(HELP)))
  delg.workspace.onDidChangeConfiguration((key) => {
    if (typeof key === 'string' && key.startsWith('delg.config-language.')) void restart()
  })
  void restart()

  return () => {
    disposed = true
    for (const handle of handles) handle.dispose()
  }
}
