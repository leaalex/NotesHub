import { and, desc, eq } from 'drizzle-orm'
import { files, taskFiles, tasks } from '../../../../database/schema'
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
      id: files.id,
      originalName: files.originalName,
      title: files.title,
      mimeType: files.mimeType,
      size: files.size,
    })
    .from(taskFiles)
    .innerJoin(files, eq(taskFiles.fileId, files.id))
    .where(and(eq(taskFiles.taskId, taskId), eq(files.userId, session.user.id)))
    .orderBy(desc(files.updatedAt))

  return linked
})
