import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '../database/schema'
import { ensureSqliteParentDir, resolveDatabaseUrl } from './database-url'

const resolvedUrl = resolveDatabaseUrl()
ensureSqliteParentDir(resolvedUrl)

const client = createClient({
  url: resolvedUrl,
})

export const db = drizzle(client, { schema })
