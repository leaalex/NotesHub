import { and, eq } from 'drizzle-orm'
import { contactTasks, contacts, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const taskId = getRouterParam(event, 'id')
  const contactId = getRouterParam(event, 'contactId')
  if (!taskId || !contactId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [taskRow] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))

  if (!taskRow)
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  const [contactRow] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, session.user.id)))

  if (!contactRow)
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })

  await db.insert(contactTasks).values({ contactId, taskId }).onConflictDoNothing()

  setResponseStatus(event, 204)
  return null
})
