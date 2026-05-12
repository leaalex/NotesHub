import { and, eq } from 'drizzle-orm'
import { notes } from '../../../database/schema'
import { db } from '../../../utils/db'
import { requireUserSession } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  await db
    .update(notes)
    .set({
      shareEnabled: false,
      shareToken: null,
      shareExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, id))

  return { ok: true }
})
