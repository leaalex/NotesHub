import { and, asc, eq } from 'drizzle-orm'
import { contactTasks, contacts, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const contactId = getRouterParam(event, 'id')
  if (!contactId)
    throw createError({ statusCode: 400, statusMessage: 'Missing contact id' })

  const [contactRow] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, session.user.id)))

  if (!contactRow)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const linked = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
    })
    .from(contactTasks)
    .innerJoin(tasks, eq(contactTasks.taskId, tasks.id))
    .where(and(eq(contactTasks.contactId, contactId), eq(tasks.userId, session.user.id)))
    .orderBy(asc(tasks.title))

  return linked
})
