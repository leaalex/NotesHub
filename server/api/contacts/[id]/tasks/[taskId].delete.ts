import { and, eq } from 'drizzle-orm'
import { contactTasks, contacts } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const contactId = getRouterParam(event, 'id')
  const taskId = getRouterParam(event, 'taskId')
  if (!contactId || !taskId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [contactRow] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, session.user.id)))

  if (!contactRow)
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })

  await db
    .delete(contactTasks)
    .where(and(eq(contactTasks.contactId, contactId), eq(contactTasks.taskId, taskId)))

  setResponseStatus(event, 204)
  return null
})
