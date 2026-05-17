import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { afterEach, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = resolve(__dirname, '../server/database/migrations')

describe('drizzle migrations', () => {
  let dir: string | undefined

  afterEach(() => {
    if (dir)
      rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('applies bundled migrations to a fresh SQLite file', async () => {
    dir = mkdtempSync(join(tmpdir(), 'notes-migrate-'))
    const dbPath = join(dir, 'test.sqlite')
    const url = `file:${dbPath}`
    const client = createClient({ url })
    const db = drizzle(client)
    await migrate(db, { migrationsFolder })

    const { rows } = await client.execute({
      sql: 'SELECT name FROM sqlite_master WHERE type = ? ORDER BY name',
      args: ['table'],
    })
    const names = rows.map((row: Record<string, unknown>) => row.name as string)
    expect(names).toContain('user')
    expect(names).toContain('notes')
    expect(names).toContain('folders')
    expect(names).toContain('tasks')
    expect(names).toContain('note_tasks')
    expect(names).toContain('task_field_templates')
    expect(names).toContain('addresses')
    expect(names).toContain('contact_addresses')
  })
})
