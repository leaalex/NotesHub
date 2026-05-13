import { and, eq } from 'drizzle-orm'
import { contactFieldTemplates } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [existing] = await db
    .select()
    .from(contactFieldTemplates)
    .where(and(
      eq(contactFieldTemplates.id, id),
      eq(contactFieldTemplates.userId, session.user.id),
    ))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  await db.delete(contactFieldTemplates).where(eq(contactFieldTemplates.id, id))

  setResponseStatus(event, 204)
  return null
})
