import { and, eq } from 'drizzle-orm'
import { contacts } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, session.user.id)))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  await db.delete(contacts).where(eq(contacts.id, id))

  setResponseStatus(event, 204)
  return null
})
