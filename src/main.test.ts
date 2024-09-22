import { main, log } from './main'
import { runMain } from 'citty'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'

const infoSpy = vi.spyOn(log, 'info').mockImplementation((...args) => {
  console.log(...args)
})

const logSpy = vi.spyOn(log, 'log').mockImplementation((...args) => {
  console.log(...args)
})

describe('when called with no arguments', async () => {
  it('should log welcome message, available commands and version', async () => {
    await runMain(main, {
      rawArgs: []
    })

    expect(infoSpy.mock.calls[0][0]).toContain('📨')
  })
})

describe('when getting an environment', async () => {
  afterEach(() => infoSpy.mockRestore())

  it('should log welcome message, available commands and version', async () => {
    await runMain(main, {
      rawArgs: ['get']
    })

    expect(infoSpy.mock.calls[0][0]).toContain('USAGE')
  })

  it('should print the environment details', async () => {
    await runMain(main, {
      rawArgs: ['get', 'dev']
    })

    expect(logSpy.mock.calls[1][0]).toMatchInlineSnapshot(`
      "COMMON=COMMON
      HELLO=DEV"
    `)
  })
})

describe('when using an environment', async () => {
  afterEach(() => infoSpy.mockRestore())

  beforeAll(async () => {
    await runMain(main, {
      rawArgs: ['use', 'dev']
    })
  })

  it('should set the environment directory', async () => {
    expect(process.env.ENVELOPE_ENV).toBe('dev')
    expect(process.env.ENVELOPE_DIR?.endsWith('/envelope/config/dev')).toBe(
      true
    )
  })

  it('should store environment variables', async () => {
    expect(process.env.HELLO).toBe('DEV')
    expect(process.env.COMMON).toBe('COMMON')
  })
})
