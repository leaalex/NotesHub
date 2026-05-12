import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const DEFAULT_SQLITE_DATABASE_URL = 'file:./data/dev.sqlite'

/** Same resolution everywhere (db client, migrations, drizzle-kit). */
export function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL ?? DEFAULT_SQLITE_DATABASE_URL
}

/** Create parent directory for on-disk SQLite files; skip :memory: and Turso URLs. */
export function ensureSqliteParentDir(url: string): void {
  if (!url.startsWith('file:') || url.includes(':memory:'))
    return
  const path = url.slice('file:'.length)
  const dir = dirname(path)
  if (!dir || dir === '.')
    return
  if (!existsSync(dir))
    mkdirSync(dir, { recursive: true })
}
