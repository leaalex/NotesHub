import { and, eq } from 'drizzle-orm'
import { notes } from '../../database/schema'
import { db } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Missing token' })

  const [row] = await db
    .select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
      updatedAt: notes.updatedAt,
      shareExpiresAt: notes.shareExpiresAt,
      shareEnabled: notes.shareEnabled,
    })
    .from(notes)
    .where(and(eq(notes.shareToken, token), eq(notes.shareEnabled, true)))

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  if (row.shareExpiresAt && row.shareExpiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 404, statusMessage: 'Link expired' })
  }

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    updatedAt: row.updatedAt,
  }
})
