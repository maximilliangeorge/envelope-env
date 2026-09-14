import { fs, vol } from 'memfs'
import { main, log } from '../src/main'
import { beforeEach, expect, it, vi } from 'vitest'
import { runMain } from 'citty'

const cwd = vi.fn()

vi.mock('node:fs', () => ({
  default: fs
}))

const spawnSync = vi.hoisted(() => vi.fn(() => ({ status: 0 })))

vi.mock('node:child_process', () => ({ spawnSync }))

const logSpy = vi.spyOn(log, 'info').mockImplementation(() => {})
const cwdSpy = vi.spyOn(process, 'cwd').mockImplementation(() => '/')

beforeEach(() => {
  vol.reset()
  fs.mkdirSync('/env')
  fs.mkdirSync('/env/develop')
  fs.mkdirSync('/env/main')
  logSpy.mockClear()
  cwdSpy.mockClear()
  spawnSync.mockClear()
  spawnSync.mockImplementation(() => ({ status: 0 }))
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

it('`envelope use` should run common and environment hooks in order around the write', async () => {
  fs.writeFileSync('/env/develop/.env', 'FOO=BAR')
  fs.writeFileSync('/env/pre', 'echo common pre')
  fs.writeFileSync('/env/post', 'echo common post')
  fs.writeFileSync('/env/develop/pre', 'echo develop pre')
  fs.writeFileSync('/env/develop/post', 'echo develop post')
  fs.writeFileSync('/env/main/pre', 'echo main pre')

  const envExistedAtCall: boolean[] = []
  spawnSync.mockImplementation(() => {
    envExistedAtCall.push(fs.existsSync('/.env'))
    return { status: 0 }
  })

  await runMain(main, { rawArgs: ['use', 'develop'] })

  expect(spawnSync.mock.calls.map((c) => c[1])).toEqual([
    ['/env/pre'],
    ['/env/develop/pre'],
    ['/env/post'],
    ['/env/develop/post']
  ])
  expect(envExistedAtCall).toEqual([false, false, true, true])

  const opts = spawnSync.mock.calls[0][2]
  expect(opts.cwd).toBe('/')
  expect(opts.env.FOO).toBe('BAR')
  expect(opts.env.ENVELOPE_ENV).toBe('develop')
  expect(opts.env.ENVELOPE_PREVIOUS_ENV).toBeUndefined()
})

it('`envelope use` should expose the previous environment to hooks', async () => {
  fs.writeFileSync('/env/post', 'echo post')

  await runMain(main, { rawArgs: ['use', 'main'] })
  await runMain(main, { rawArgs: ['use', 'develop'] })

  expect(spawnSync.mock.calls[0][2].env.ENVELOPE_PREVIOUS_ENV).toBeUndefined()
  expect(spawnSync.mock.calls[1][2].env.ENVELOPE_PREVIOUS_ENV).toBe('main')
})

it('`envelope use` should abort the write when a pre hook fails', async () => {
  fs.writeFileSync('/env/develop/pre', 'exit 1')

  const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => {})
  const exitSpy = vi
    .spyOn(process, 'exit')
    .mockImplementation(() => undefined as never)
  spawnSync.mockImplementation(() => ({ status: 1 }))

  await runMain(main, { rawArgs: ['use', 'develop'] })

  expect(fs.existsSync('/.env')).toBe(false)
  expect(exitSpy).toHaveBeenCalledWith(1)
  expect(errorSpy.mock.calls[0][0]).toMatch(/exited with status 1/)

  errorSpy.mockRestore()
  exitSpy.mockRestore()
})

it('`envelope use` should keep the written .env when a post hook fails', async () => {
  fs.writeFileSync('/env/develop/post', 'exit 1')

  const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => {})
  const exitSpy = vi
    .spyOn(process, 'exit')
    .mockImplementation(() => undefined as never)
  spawnSync.mockImplementation(() => ({ status: 1 }))

  await runMain(main, { rawArgs: ['use', 'develop'] })

  expect(fs.existsSync('/.env')).toBe(true)
  expect(exitSpy).toHaveBeenCalledWith(1)
  expect(errorSpy.mock.calls[0][0]).toMatch(/post hook failed/)

  errorSpy.mockRestore()
  exitSpy.mockRestore()
})

it('`envelope use --no-hooks` should skip hooks', async () => {
  fs.writeFileSync('/env/pre', 'echo pre')
  fs.writeFileSync('/env/develop/post', 'echo post')

  await runMain(main, { rawArgs: ['use', 'develop', '--no-hooks'] })

  expect(spawnSync).not.toHaveBeenCalled()
  expect(fs.existsSync('/.env')).toBe(true)
})

it.todo('`envelope get` should return the current env vars if no argument')
