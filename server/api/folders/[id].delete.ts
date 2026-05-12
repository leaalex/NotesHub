import { and, eq } from 'drizzle-orm'
import { folders, notes } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [existing] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, session.user.id)))

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const children = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.parentId, id), eq(folders.userId, session.user.id)))

  if (children.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Folder is not empty (move or delete nested folders first)',
    })
  }

  const notesInFolder = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.folderId, id), eq(notes.userId, session.user.id)))

  if (notesInFolder.length > 0) {
    await db
      .update(notes)
      .set({ folderId: null, updatedAt: new Date() })
      .where(and(eq(notes.folderId, id), eq(notes.userId, session.user.id)))
  }

  await db.delete(folders).where(eq(folders.id, id))
  return { ok: true }
})
