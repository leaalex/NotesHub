import { and, desc, eq, isNull } from 'drizzle-orm'
import { files } from '../../database/schema'
import { db } from '../../utils/db'
import { toFileDto } from '../../utils/file-dto'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const folderId = getQuery(event).folderId

  const where
    = folderId === 'unfiled'
      ? and(eq(files.userId, session.user.id), isNull(files.folderId))
      : typeof folderId === 'string' && folderId.length
        ? and(eq(files.userId, session.user.id), eq(files.folderId, folderId))
        : eq(files.userId, session.user.id)

  const rows = await db
    .select()
    .from(files)
    .where(where)
    .orderBy(desc(files.updatedAt))

  const config = useRuntimeConfig()
  return rows.map(row => toFileDto(row, config.public.siteUrl as string))
})
