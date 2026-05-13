import { and, eq } from 'drizzle-orm'
import { files, noteFiles, notes } from '../../database/schema'
import { db } from '../../utils/db'
import { toFileDto } from '../../utils/file-dto'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [row] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const linkedFiles = await db
    .select({ file: files })
    .from(noteFiles)
    .innerJoin(files, eq(noteFiles.fileId, files.id))
    .where(and(eq(noteFiles.noteId, id), eq(files.userId, session.user.id)))

  const config = useRuntimeConfig()
  return {
    ...row,
    linkedFiles: linkedFiles.map(x => toFileDto(x.file, config.public.siteUrl as string)),
  }
})
