import fs from 'node:fs'
import path from 'node:path'
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
 * Get the environment directory for the given environment
 * @param env - The environment name
 * @returns The environment directory
 */

function getEnvDir(env: string) {
  const rootEnvDir = getRootEnvDir()
  const envDir = path.join(rootEnvDir, env)

  if (fs.existsSync(envDir) && fs.statSync(envDir).isDirectory()) {
    return envDir
  }

  throw new Error(`Could not find directory ${envDir}`)
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
  const envDir = getEnvDir(env)
  const rootEnvDir = getRootEnvDir()

  let envVars = ''
  envVars += `ENVELOPE_ENV=${env}\n`
  envVars += `ENVELOPE_DIR=${envDir}\n`

  // Handle .env files
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

async function compileDotEnv(env: string, silent: boolean) {
  const compiledEnv = await getCompiledEnv(env, {
    silent
  })

  return Object.entries(compiledEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
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
        environment: {
          type: 'positional',
          description: 'The environment name',
          required: true
        }
      },
      async run({ args }) {
        const silent = !!args.silent
        try {
          if (!silent) {
            log.info(`Compiling environment variables for ${args.environment}`)
          }

          const env = await compileDotEnv(args.environment as string, silent)
          const rootDir = getRootDir()

          if (!silent) {
            log.success(
              `Compiled environment variables for ${args.environment}: to ${rootDir}/.env` // TODO: this is not correct
            )
          }

          fs.writeFileSync(path.join(rootDir, '.env'), env, 'utf-8')
        } catch (error) {
          if (!silent) log.error(error)
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
            .filter(
              (dirent) => dirent.isDirectory() && dirent.name !== 'node_modules'
            )
            .map((dirent) => dirent.name)

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
