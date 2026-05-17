import { and, eq } from 'drizzle-orm'
import { noteTasks, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const taskId = getRouterParam(event, 'id')
  const noteId = getRouterParam(event, 'noteId')
  if (!taskId || !noteId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [taskRow] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))

  if (!taskRow)
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  await db
    .delete(noteTasks)
    .where(and(eq(noteTasks.taskId, taskId), eq(noteTasks.noteId, noteId)))

  setResponseStatus(event, 204)
  return null
})
