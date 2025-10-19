import { fs, vol } from 'memfs'
import { main, log } from '../src/main'
import { beforeEach, expect, it, vi } from 'vitest'
import { runMain } from 'citty'

const cwd = vi.fn()

vi.mock('node:fs', () => ({
  default: fs
}))

const logSpy = vi.spyOn(log, 'info').mockImplementation(() => {})
const cwdSpy = vi.spyOn(process, 'cwd').mockImplementation(() => '/')

beforeEach(() => {
  vol.reset()
  fs.mkdirSync('/env')
  fs.mkdirSync('/env/develop')
  fs.mkdirSync('/env/main')
  logSpy.mockClear()
  cwdSpy.mockClear()
})

it('`envelope list` should list available environments', async () => {
  fs.mkdirSync('/env/staging')

  await runMain(main, {
    rawArgs: ['list']
  })

  expect(logSpy.mock.calls[0][0]).toMatchInlineSnapshot(
    `"Available environments: develop, main, staging"`
  )
})

it('`envelope use` should compile a .env file', async () => {
  fs.writeFileSync('/env/.env', 'FOO=FOO')
  fs.writeFileSync('/env/develop/.env', 'FOO=BAR')

  await runMain(main, {
    rawArgs: ['use', 'develop']
  })

  const env = fs.readFileSync('/.env', 'utf-8')

  expect(env).toMatchInlineSnapshot(`
    "ENVELOPE_ENV=develop
    ENVELOPE_DIR=/env/develop
    FOO=BAR"
  `)
})

it('`envelope use` should compile the .env file into the root directory, even when called from a child directory', async () => {
  cwdSpy.mockReturnValue('/child')

  fs.writeFileSync('/env/.env', 'FOO=FOO')
  fs.writeFileSync('/env/develop/.env', 'FOO=BAR')
  fs.mkdirSync('/child')

  await runMain(main, {
    rawArgs: ['use', 'develop']
  })

  const exists_1 = fs.existsSync('./.env')
  expect(exists_1).toBe(false)

  const exists_2 = fs.existsSync('/.env')
  expect(exists_2).toBe(true)

  const env = fs.readFileSync('/.env', 'utf-8')
  expect(env).toMatchInlineSnapshot(`
    "ENVELOPE_ENV=develop
    ENVELOPE_DIR=/env/develop
    FOO=BAR"
  `)
})

it('`envelope current` should return the name of the current environment', async () => {
  await runMain(main, {
    rawArgs: ['use', 'develop']
  })

  await runMain(main, {
    rawArgs: ['current']
  })

  expect(logSpy.mock.calls[1][0]).toMatchInlineSnapshot(
    `"The current environment is: develop"`
  )
})

it.todo('`envelope get` should return the current env vars if no argument')
