import { and, asc, eq } from 'drizzle-orm'
import { contactTasks, contacts, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const taskId = getRouterParam(event, 'id')
  if (!taskId)
    throw createError({ statusCode: 400, statusMessage: 'Missing task id' })

  const [taskRow] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))

  if (!taskRow)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const linked = await db
    .select({
      id: contacts.id,
      displayName: contacts.displayName,
      type: contacts.type,
    })
    .from(contactTasks)
    .innerJoin(contacts, eq(contactTasks.contactId, contacts.id))
    .where(and(eq(contactTasks.taskId, taskId), eq(contacts.userId, session.user.id)))
    .orderBy(asc(contacts.displayName))

  return linked
})
