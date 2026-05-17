import { and, eq } from 'drizzle-orm'
import { files, taskFiles, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const fileId = getRouterParam(event, 'id')
  const taskId = getRouterParam(event, 'taskId')
  if (!fileId || !taskId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [fileRow] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, session.user.id)))

  if (!fileRow)
    throw createError({ statusCode: 404, statusMessage: 'File not found' })

  const [taskRow] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))

  if (!taskRow)
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  await db.insert(taskFiles).values({ taskId, fileId }).onConflictDoNothing()

  setResponseStatus(event, 204)
  return null
})
