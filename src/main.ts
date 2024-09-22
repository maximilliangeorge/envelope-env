import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { defineCommand, renderUsage } from 'citty'
import { version } from '../package.json'
import { createConsola } from 'consola'
import child_process from 'child_process'

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

  if (fs.existsSync(commonEnvPath)) {
    if (opts?.silent !== true)
      log.info(`reading common environment variables from ${commonEnvPath}`)
    envVars += fs.readFileSync(commonEnvPath, 'utf-8')
  }

  if (fs.existsSync(envEnvPath)) {
    if (opts?.silent !== true)
      log.info(`reading environment variables from ${envEnvPath}`)
    envVars += '\n' + fs.readFileSync(envEnvPath, 'utf-8')
  }

  validateEnvString(envVars)

  return dotenv.parse(envVars)
}

/**
 * Get the environment details for the given environment
 * @param env - The environment name
 */

function getEnvDetails(env: string) {
  const compiledEnv = getCompiledEnv(env)

  return Object.entries(compiledEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

/**
 * Apply the environment variables to the current process
 * @param env - The environment name
 */

function applyEnv(env: string) {
  const compiledEnv = getCompiledEnv(env)

  Object.entries(compiledEnv).forEach(([key, value]) => {
    process.env[key] = value
  })
}

/**
 * Prints the environment variables as `export $var` to the current shell
 * @param env - The environment name
 */

function loadEnv(env: string) {
  const compiledEnv = getCompiledEnv(env, {
    silent: true
  })

  Object.entries(compiledEnv).forEach(([key, value]) => {
    console.log(`export ${key}=${value}`)
  })
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
    use: defineCommand({
      meta: {
        name: 'use',
        description: 'use an environment'
      },
      args: {
        environment: {
          type: 'positional',
          description: 'the environment name'
        }
      },
      async run({ args }) {
        try {
          applyEnv(args.environment as string)
          log.success(`Using environment: ${args.environment}`)
        } catch (error) {
          log.error(error)
        }
      }
    }),
    load: defineCommand({
      meta: {
        name: 'load',
        description: 'load environment variables'
      },
      args: {
        environment: {
          type: 'positional',
          description: 'the environment name'
        }
      },
      async run({ args }) {
        loadEnv(args.environment as string)
      }
    }),
    get: defineCommand({
      meta: {
        name: 'get',
        description: 'print environment details'
      },
      args: {
        environment: {
          type: 'positional',
          description: 'the environment name',
          required: false
        }
      },
      async run({ args }) {
        let env = args.environment || process.env.ENVELOPE_ENV

        if (env === undefined) {
          const usage = await renderUsage(this)
          return log.info(usage)
        }

        try {
          log.info(`compiling environment variables for ${args.environment}`)
          const details = getEnvDetails(args.environment as string)
          log.success(
            `successfully compiled environment variables for ${args.environment}:`
          )
          log.log(details)
        } catch (error) {
          log.error(error)
        }
      }
    }),
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'list all dev environment variables'
      },
      run() {
        console.log('Listing all dev environment variables')
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
