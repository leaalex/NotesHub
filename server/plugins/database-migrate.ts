import { join } from 'node:path'
import { cwd } from 'node:process'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { ensureSqliteParentDir, resolveDatabaseUrl } from '../utils/database-url'

export default defineNitroPlugin(async () => {
  const url = resolveDatabaseUrl()
  ensureSqliteParentDir(url)
  const folder = process.env.DRIZZLE_MIGRATIONS_PATH ?? join(cwd(), 'server/database/migrations')

  const client = createClient({ url })
  const db = drizzle(client)

  try {
    await migrate(db, { migrationsFolder: folder })
  }
  catch (e) {
    console.error('[db] migrate failed', e)
    throw e
  }
})
