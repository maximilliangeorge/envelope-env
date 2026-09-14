import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import dotenv from 'dotenv'
import { defineCommand, renderUsage } from 'citty'
import { version } from '../package.json'
import { createConsola } from 'consola'

export const log = createConsola({
  level: 3,
  fancy: true
})

/**
 * Get the root directory which contains the config directory
 * @returns The absolute path to the root directory
 */

function getRootDir() {
  let currentDir = process.cwd()
  while (true) {
    const configDir = path.join(currentDir, 'env')
    if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
      return currentDir
    }
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      throw new Error('Could not find env directory')
    }
    currentDir = parentDir
  }
}

/**
 * Get the config directory inside the current working directory
 * @returns The absolute path to the config directory
 */

function getRootEnvDir() {
  const rootDir = getRootDir()
  return path.join(rootDir, 'env')
}

/**
 * Validate the environment string
 * @param envVars - The environment variables string
 */

function validateEnvString(envVars: string) {
  const lines = envVars.split('\n')

  const validLineRegex = /^(\s*#.*|\s*$|[A-Za-z_][A-Za-z0-9_]*\s*=\s*.*)$/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!validLineRegex.test(line)) {
      throw new Error(`invalid .env format at line ${i + 1}: ${line}`)
    }
  }

  return true
}

/**
 * Compile the environment variables
 * TODO: perhaps needs to harmonise with merge options
 */

async function getCompiledEnv(env: string, opts?: { silent: boolean }) {
  const rootEnvDir = getRootEnvDir()
  const envDir = path.join(rootEnvDir, env)

  if (!fs.existsSync(envDir) || !fs.statSync(envDir).isDirectory()) {
    throw new Error(`Could not find environment '${env}': no directory '${envDir}'`)
  }

  let envVars = ''
  envVars += `ENVELOPE_ENV=${env}\n`
  envVars += `ENVELOPE_DIR=${envDir}\n`

  const envFiles = [
    { path: path.join(rootEnvDir, '.env'), name: 'common' },
    { path: path.join(envDir, '.env'), name: env }
  ]

  for (const file of envFiles) {
    if (fs.existsSync(file.path)) {
      if (opts?.silent !== true)
        log.info(`Reading ${file.name} environment variables from ${file.path}`)
      envVars += '\n' + fs.readFileSync(file.path, 'utf-8')
    }
  }

  validateEnvString(envVars)

  return dotenv.parse(envVars)
}

/**
 * Get the .env for the given environment
 * @param env - The environment name
 */

function formatEnv(compiledEnv: Record<string, string>) {
  return Object.entries(compiledEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

async function compileDotEnv(env: string, silent: boolean) {
  return formatEnv(await getCompiledEnv(env, { silent }))
}

/**
 * Read ENVELOPE_ENV from the currently compiled .env, if there is one
 * @param rootDir - The project root directory
 */

function getCurrentEnv(rootDir: string): string | undefined {
  const envFilePath = path.join(rootDir, '.env')
  if (!fs.existsSync(envFilePath)) return undefined
  try {
    return dotenv.parse(fs.readFileSync(envFilePath, 'utf-8')).ENVELOPE_ENV
  } catch {
    return undefined
  }
}

/**
 * Resolve the hook scripts to run for a given stage. Common hooks in `env/`
 * run first, followed by environment-specific hooks in `env/<environment>/`.
 * @param stage - 'pre' or 'post'
 * @param env - The environment name
 */

function getHooks(stage: 'pre' | 'post', env: string) {
  const rootEnvDir = getRootEnvDir()
  return [path.join(rootEnvDir, stage), path.join(rootEnvDir, env, stage)].filter(
    (p) => fs.existsSync(p) && fs.statSync(p).isFile()
  )
}

/**
 * Run a hook script with the compiled environment injected
 * @param hookPath - The absolute path to the hook script
 * @param hookEnv - Environment variables to expose to the script
 * @param rootDir - The working directory for the script
 * @param silent - Suppress the script's stdout
 */

function runHook(
  hookPath: string,
  hookEnv: Record<string, string>,
  rootDir: string,
  silent: boolean
) {
  if (!silent) log.info(`Running hook ${hookPath}`)

  const result = spawnSync('sh', [hookPath], {
    cwd: rootDir,
    stdio: ['inherit', silent ? 'ignore' : 'inherit', 'inherit'],
    env: { ...process.env, ...hookEnv }
  })

  if (result.error) {
    throw new Error(`Hook ${hookPath} could not be run: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error(`Hook ${hookPath} exited with status ${result.status}`)
  }
}

/**
 * The main command
 */

export const main = defineCommand({
  meta: {
    name: 'envelope',
    version,
    description: '📨'
  },
  subCommands: {
    get: defineCommand({
      meta: {
        name: 'get',
        description: 'Print environment variables to console'
      },
      args: {
        silent: {
          type: 'boolean',
          description: 'Do not log status messages',
          alias: ['s']
        },
        environment: {
          type: 'positional',
          description: 'The environment name',
          required: true
        }
      },
      async run({ args }) {
        try {
          const silent = !!args.silent
          const env = await compileDotEnv(args.environment as string, silent)
          log.box(env)
        } catch (error) {
          log.error(`Error in 'get' command: ${error.message}`)
          // process.exit(1)
        }
      }
    }),
    use: defineCommand({
      meta: {
        name: 'use',
        description: 'Compile a .env file for the given environment'
      },
      args: {
        silent: {
          type: 'boolean',
          description: 'Do not log status messages',
          alias: ['s']
        },
        hooks: {
          type: 'boolean',
          description: 'Run pre and post hooks (disable with --no-hooks)',
          default: true
        },
        environment: {
          type: 'positional',
          description: 'The environment name',
          required: true
        }
      },
      async run({ args }) {
        const silent = !!args.silent
        const environment = args.environment as string
        let written = false

        try {
          if (!silent) {
            log.info(`Compiling environment variables for ${environment}`)
          }

          const compiledEnv = await getCompiledEnv(environment, { silent })
          const rootDir = getRootDir()
          const envFilePath = path.join(rootDir, '.env')

          const previousEnv = getCurrentEnv(rootDir)
          const hookEnv = {
            ...compiledEnv,
            ...(previousEnv ? { ENVELOPE_PREVIOUS_ENV: previousEnv } : {})
          }

          if (args.hooks) {
            for (const hook of getHooks('pre', environment)) {
              runHook(hook, hookEnv, rootDir, silent)
            }
          }

          fs.writeFileSync(envFilePath, formatEnv(compiledEnv), 'utf-8')
          written = true

          if (args.hooks) {
            for (const hook of getHooks('post', environment)) {
              runHook(hook, hookEnv, rootDir, silent)
            }
          }

          if (!silent) {
            log.success(
              `Compiled environment variables for ${environment} to ${envFilePath}`
            )
          }
        } catch (error) {
          if (written) {
            log.error(`.env was written for ${environment} but a post hook failed`)
          }
          log.error(error.message)
          process.exit(1)
        }
      }
    }),
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'List all available environments'
      },
      run() {
        try {
          const rootEnvDir = getRootEnvDir()
          const environments = fs
            .readdirSync(rootEnvDir, { withFileTypes: true })
            .filter((e) => e.isDirectory() && e.name !== 'node_modules')
            .map((e) => e.name)

          log.info('Available environments: ' + environments.join(', '))
        } catch (error) {
          log.error(`Error listing environments: ${error.message}`)
          process.exit(1)
        }
      }
    }),
    current: defineCommand({
      meta: {
        name: 'current',
        description: 'Print current environment'
      },
      run() {
        try {
          const rootDir = getRootDir()
          const envFilePath = path.join(rootDir, '.env')

          if (!fs.existsSync(envFilePath)) {
            throw new Error('Oopsie')
          }

          const envString = fs.readFileSync(envFilePath, 'utf-8')

          validateEnvString(envString)

          const parsed = dotenv.parse(envString)

          if (!parsed.ENVELOPE_ENV) {
            throw new Error('Could not parse ENVELOPE_ENV')
          }

          log.info(`The current environment is: ${parsed.ENVELOPE_ENV}`)
        } catch (error) {
          log.error(`Error getting current environment: ${error.message}`)
          process.exit(1)
        }
      }
    })
  },
  args: {
    help: {
      type: 'boolean',
      description: 'show help'
    }
  },
  async run(opts) {
    if (opts.args.help || opts.rawArgs.length === 0) {
      const usage = await renderUsage(this)
      log.info(usage)
      return
    }
  }
})
