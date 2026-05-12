import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SQLITE_DATABASE_URL,
  ensureSqliteParentDir,
  resolveDatabaseUrl,
} from '../server/utils/database-url'

describe('resolveDatabaseUrl', () => {
  it('prefers DATABASE_URL over NUXT_DATABASE_URL', () => {
    const a = process.env.DATABASE_URL
    const b = process.env.NUXT_DATABASE_URL
    try {
      process.env.DATABASE_URL = 'file:/a/a.sqlite'
      process.env.NUXT_DATABASE_URL = 'file:/b/b.sqlite'
      expect(resolveDatabaseUrl()).toBe('file:/a/a.sqlite')
    }
    finally {
      process.env.DATABASE_URL = a
      process.env.NUXT_DATABASE_URL = b
    }
  })

  it('uses NUXT_DATABASE_URL when DATABASE_URL is unset', () => {
    const a = process.env.DATABASE_URL
    const b = process.env.NUXT_DATABASE_URL
    try {
      delete process.env.DATABASE_URL
      process.env.NUXT_DATABASE_URL = 'file:/only/nuxt.sqlite'
      expect(resolveDatabaseUrl()).toBe('file:/only/nuxt.sqlite')
    }
    finally {
      if (a === undefined)
        delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = a
      process.env.NUXT_DATABASE_URL = b
    }
  })

  it('defaults when both unset', () => {
    const a = process.env.DATABASE_URL
    const b = process.env.NUXT_DATABASE_URL
    try {
      delete process.env.DATABASE_URL
      delete process.env.NUXT_DATABASE_URL
      expect(resolveDatabaseUrl()).toBe(DEFAULT_SQLITE_DATABASE_URL)
    }
    finally {
      if (a !== undefined)
        process.env.DATABASE_URL = a
      if (b !== undefined)
        process.env.NUXT_DATABASE_URL = b
    }
  })
})

describe('ensureSqliteParentDir', () => {
  let dir: string
  afterEach(() => {
    if (dir)
      rmSync(dir, { recursive: true, force: true })
    dir = ''
  })

  it('creates parent directories for on-disk file URLs', () => {
    dir = mkdtempSync(join(tmpdir(), 'notes-ensure-'))
    const nested = join(dir, 'nested', 'deep')
    const url = `file:${join(nested, 'db.sqlite')}`
    ensureSqliteParentDir(url)
    expect(existsSync(nested)).toBe(true)
  })

  it('does nothing for :memory: URLs', () => {
    ensureSqliteParentDir('file::memory:?cache=shared')
    // no throw
    expect(true).toBe(true)
  })
})
