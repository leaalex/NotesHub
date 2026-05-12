import { asc } from 'drizzle-orm'
import { notes } from '../../database/schema'
import { db } from '../../utils/db'
import { requireAdminSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  return await db
    .select({
      id: notes.id,
      userId: notes.userId,
      folderId: notes.folderId,
      title: notes.title,
      excerpt: notes.excerpt,
      shareEnabled: notes.shareEnabled,
      shareToken: notes.shareToken,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .orderBy(asc(notes.updatedAt))
})
