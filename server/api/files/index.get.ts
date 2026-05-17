import { and, desc, eq, isNull, like, or } from 'drizzle-orm'
import { files } from '../../database/schema'
import { db } from '../../utils/db'
import { toFileDto } from '../../utils/file-dto'
import { requireUserSession } from '../../utils/session'

function sanitizeLikeTerm(raw: string): string {
  return raw.trim().replace(/[%_]/g, '')
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const query = getQuery(event)
  const folderId = query.folderId
  const q = typeof query.q === 'string' ? query.q : ''
  const term = sanitizeLikeTerm(q)

  const where =
    term.length > 0
      ? and(
          eq(files.userId, session.user.id),
          or(
            like(files.originalName, `%${term}%`),
            like(files.title, `%${term}%`),
          ),
        )
      : folderId === 'unfiled'
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
