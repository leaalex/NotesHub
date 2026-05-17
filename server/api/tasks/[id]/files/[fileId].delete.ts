import { and, eq } from 'drizzle-orm'
import { taskFiles, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const taskId = getRouterParam(event, 'id')
  const fileId = getRouterParam(event, 'fileId')
  if (!taskId || !fileId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [taskRow] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))

  if (!taskRow)
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  await db
    .delete(taskFiles)
    .where(and(eq(taskFiles.taskId, taskId), eq(taskFiles.fileId, fileId)))

  setResponseStatus(event, 204)
  return null
})
