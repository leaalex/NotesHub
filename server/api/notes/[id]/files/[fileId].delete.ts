import { and, eq } from 'drizzle-orm'
import { noteFiles, notes } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const noteId = getRouterParam(event, 'id')
  const fileId = getRouterParam(event, 'fileId')
  if (!noteId || !fileId)
    throw createError({ statusCode: 400, statusMessage: 'Missing ids' })

  const [note] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)))
  if (!note)
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })

  await db
    .delete(noteFiles)
    .where(and(eq(noteFiles.noteId, noteId), eq(noteFiles.fileId, fileId)))

  setResponseStatus(event, 204)
  return null
})
