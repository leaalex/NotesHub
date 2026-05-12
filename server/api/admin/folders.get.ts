import { asc } from 'drizzle-orm'
import { folders } from '../../database/schema'
import { db } from '../../utils/db'
import { requireAdminSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  return await db
    .select()
    .from(folders)
    .orderBy(asc(folders.userId), asc(folders.position), asc(folders.name))
})
