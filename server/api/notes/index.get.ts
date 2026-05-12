import { and, desc, eq, isNull } from 'drizzle-orm'
import { notes } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const q = getQuery(event)
  const folderId = q.folderId as string | undefined

  const base = eq(notes.userId, session.user.id)

  if (folderId === 'unfiled') {
    return await db
      .select({
        id: notes.id,
        folderId: notes.folderId,
        title: notes.title,
        excerpt: notes.excerpt,
        updatedAt: notes.updatedAt,
        shareEnabled: notes.shareEnabled,
      })
      .from(notes)
      .where(and(base, isNull(notes.folderId)))
      .orderBy(desc(notes.updatedAt))
  }

  if (folderId && folderId !== 'all') {
    return await db
      .select({
        id: notes.id,
        folderId: notes.folderId,
        title: notes.title,
        excerpt: notes.excerpt,
        updatedAt: notes.updatedAt,
        shareEnabled: notes.shareEnabled,
      })
      .from(notes)
      .where(and(base, eq(notes.folderId, folderId)))
      .orderBy(desc(notes.updatedAt))
  }

  return await db
    .select({
      id: notes.id,
      folderId: notes.folderId,
      title: notes.title,
      excerpt: notes.excerpt,
      updatedAt: notes.updatedAt,
      shareEnabled: notes.shareEnabled,
    })
    .from(notes)
    .where(base)
    .orderBy(desc(notes.updatedAt))
})
