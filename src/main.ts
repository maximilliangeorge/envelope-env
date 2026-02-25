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
 * Throws if both directory-mode subdirectories and flat-mode .env.* files are
 * present in the same env directory, since the two layouts are incompatible.
 */

function assertSingleEnvMode(rootEnvDir: string) {
  const entries = fs.readdirSync(rootEnvDir, { withFileTypes: true })
  const hasSubdirs = entries.some(
    (e) => e.isDirectory() && e.name !== 'node_modules'
  )
  const hasFlatFiles = entries.some(
    (e) => e.isFile() && /^\.env\../.test(e.name)
  )

  if (hasSubdirs && hasFlatFiles) {
    throw new Error(
      `Incompatible environment modes detected in '${rootEnvDir}': ` +
        `found both subdirectories (directory mode) and .env.* files (flat mode). ` +
        `Use one layout or the other, not both.`
    )
  }
}

/**
 * Compile the environment variables
 * TODO: perhaps needs to harmonise with merge options
 */

async function getCompiledEnv(env: string, opts?: { silent: boolean }) {
  const rootEnvDir = getRootEnvDir()
  assertSingleEnvMode(rootEnvDir)

  const envSubDir = path.join(rootEnvDir, env)
  const flatEnvFile = path.join(rootEnvDir, `.env.${env}`)

  const isDirectoryMode =
    fs.existsSync(envSubDir) && fs.statSync(envSubDir).isDirectory()
  const isFlatMode = !isDirectoryMode && fs.existsSync(flatEnvFile)

  if (!isDirectoryMode && !isFlatMode) {
    throw new Error(
      `Could not find environment '${env}': no directory '${envSubDir}' or file '${flatEnvFile}'`
    )
  }

  const envDir = isDirectoryMode ? envSubDir : rootEnvDir

  let envVars = ''
  envVars += `ENVELOPE_ENV=${env}\n`
  envVars += `ENVELOPE_DIR=${envDir}\n`

  const envFiles = [
    { path: path.join(rootEnvDir, '.env'), name: 'common' },
    {
      path: isDirectoryMode ? path.join(envSubDir, '.env') : flatEnvFile,
      name: env
    }
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
          assertSingleEnvMode(rootEnvDir)
          const entries = fs.readdirSync(rootEnvDir, { withFileTypes: true })
          const environments = [
            ...entries
              .filter((e) => e.isDirectory() && e.name !== 'node_modules')
              .map((e) => e.name),
            ...entries
              .filter((e) => e.isFile() && /^\.env\../.test(e.name))
              .map((e) => e.name.slice(5))
          ]

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
