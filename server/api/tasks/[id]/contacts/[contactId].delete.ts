import { and, eq } from 'drizzle-orm'
import { contactTasks, tasks } from '../../../../database/schema'
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

  await db
    .delete(contactTasks)
    .where(and(eq(contactTasks.taskId, taskId), eq(contactTasks.contactId, contactId)))

  setResponseStatus(event, 204)
  return null
})
