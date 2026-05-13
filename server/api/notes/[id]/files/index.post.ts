import { and, eq } from 'drizzle-orm'
import { files, noteFiles, notes } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const noteId = getRouterParam(event, 'id')
  if (!noteId)
    throw createError({ statusCode: 400, statusMessage: 'Missing note id' })

  const body = await readBody<{ fileId?: string }>(event).catch(() => ({}))
  if (!body.fileId)
    throw createError({ statusCode: 400, statusMessage: 'fileId is required' })

  const [note] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)))
  if (!note)
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })

  const [file] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, body.fileId), eq(files.userId, session.user.id)))
  if (!file)
    throw createError({ statusCode: 404, statusMessage: 'File not found' })

  await db.insert(noteFiles).values({
    noteId,
    fileId: body.fileId,
  }).onConflictDoNothing()

  setResponseStatus(event, 204)
  return null
})
