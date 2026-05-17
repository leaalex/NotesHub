import { and, eq } from 'drizzle-orm'
import { tasks } from '../../../database/schema'
import { db } from '../../../utils/db'
import { requireUserSession } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)))

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  await db
    .update(tasks)
    .set({
      shareEnabled: false,
      shareToken: null,
      shareExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))

  return { ok: true }
})
