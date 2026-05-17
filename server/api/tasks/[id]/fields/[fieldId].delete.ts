import { and, eq } from 'drizzle-orm'
import { taskFieldValues, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const tid = getRouterParam(event, 'id')
  const fieldId = getRouterParam(event, 'fieldId')
  if (!tid || !fieldId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, tid), eq(tasks.userId, session.user.id)))

  if (!task)
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  const [existing] = await db
    .select({ id: taskFieldValues.id })
    .from(taskFieldValues)
    .where(and(eq(taskFieldValues.id, fieldId), eq(taskFieldValues.taskId, tid)))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Field not found' })

  await db
    .delete(taskFieldValues)
    .where(and(eq(taskFieldValues.id, fieldId), eq(taskFieldValues.taskId, tid)))

  setResponseStatus(event, 204)
  return null
})
