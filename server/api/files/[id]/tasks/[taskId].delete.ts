import { and, eq } from 'drizzle-orm'
import { files, taskFiles } from '../../../../database/schema'
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

  await db
    .delete(taskFiles)
    .where(and(eq(taskFiles.fileId, fileId), eq(taskFiles.taskId, taskId)))

  setResponseStatus(event, 204)
  return null
})
