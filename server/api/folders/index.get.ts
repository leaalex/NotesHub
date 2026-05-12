import { and, asc, eq } from 'drizzle-orm'
import { folders } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const uid = session.user.id

  return await db
    .select()
    .from(folders)
    .where(eq(folders.userId, uid))
    .orderBy(asc(folders.position), asc(folders.name))
})
