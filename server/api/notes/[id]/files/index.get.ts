import { and, desc, eq } from 'drizzle-orm'
import { files, noteFiles, notes } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { toFileDto } from '../../../../utils/file-dto'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const noteId = getRouterParam(event, 'id')
  if (!noteId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [note] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)))

  if (!note)
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })

  const rows = await db
    .select({ file: files })
    .from(noteFiles)
    .innerJoin(files, eq(noteFiles.fileId, files.id))
    .where(and(eq(noteFiles.noteId, noteId), eq(files.userId, session.user.id)))
    .orderBy(desc(noteFiles.createdAt))

  const config = useRuntimeConfig()
  return rows.map(row => toFileDto(row.file, config.public.siteUrl as string))
})
