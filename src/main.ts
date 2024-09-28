import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { defineCommand, renderUsage } from 'citty'
import { version } from '../package.json'
import { createConsola } from 'consola'

export const log = createConsola({
  level: 3,
  fancy: true
})

/**
 * Get the config directory inside the current working directory
 * @returns The absolute path to the config directory
 */

function getConfDir() {
  let currentDir = process.cwd()
  while (true) {
    const configDir = path.join(currentDir, 'config')
    if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
      return configDir
    }
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      throw new Error('Could not find config directory')
    }
    currentDir = parentDir
  }
}

/**
 * Get the environment directory for the given environment
 * @param env - The environment name
 * @returns The environment directory
 */

function getEnvDir(env: string) {
  const confDir = getConfDir()

  const envDir = path.join(confDir, env)
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
 */

function getCompiledEnv(env: string, opts?: { silent: boolean }) {
  const envDir = getEnvDir(env)
  const confDir = getConfDir()
  const commonEnvPath = path.join(confDir, '.env')
  const envEnvPath = path.join(envDir, '.env')

  let envVars = ''
  envVars += `ENVELOPE_ENV=${env}\n`
  envVars += `ENVELOPE_DIR=${envDir}\n`

  // Add error handling for file read operations
  try {
    if (fs.existsSync(commonEnvPath)) {
      if (opts?.silent !== true)
        log.info(`Reading common environment variables from ${commonEnvPath}`)
      envVars += fs.readFileSync(commonEnvPath, 'utf-8')
    }

    if (fs.existsSync(envEnvPath)) {
      if (opts?.silent !== true)
        log.info(`Reading environment variables from ${envEnvPath}`)
      envVars += '\n' + fs.readFileSync(envEnvPath, 'utf-8')
    }
  } catch (error) {
    throw new Error(`Error reading environment files: ${error.message}`)
  }

  validateEnvString(envVars)

  return dotenv.parse(envVars)
}

/**
 * Get the .env for the given environment
 * @param env - The environment name
 */

function compileDotEnv(env: string, silent: boolean) {
  const compiledEnv = getCompiledEnv(env, {
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
          const env = compileDotEnv(args.environment as string, silent)
          log.box(env)
        } catch (error) {
          log.error(`Error in 'get' command: ${error.message}`)
          process.exit(1)
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
          if (!silent)
            log.info(`Compiling environment variables for ${args.environment}`)
          const env = compileDotEnv(args.environment as string, silent)
          if (!silent)
            log.success(
              `Compiled environment variables for ${
                args.environment
              }: to ${process.cwd()}/.env`
            )
          fs.writeFileSync(path.join(process.cwd(), '.env'), env, 'utf-8')
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
          const confDir = getConfDir()
          const environments = fs
            .readdirSync(confDir, { withFileTypes: true })
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
