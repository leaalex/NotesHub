import { and, asc, eq } from 'drizzle-orm'
import { files, taskFiles, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const fileId = getRouterParam(event, 'id')
  if (!fileId)
    throw createError({ statusCode: 400, statusMessage: 'Missing file id' })

  const [fileRow] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, session.user.id)))

  if (!fileRow)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const linked = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
    })
    .from(taskFiles)
    .innerJoin(tasks, eq(taskFiles.taskId, tasks.id))
    .where(and(eq(taskFiles.fileId, fileId), eq(tasks.userId, session.user.id)))
    .orderBy(asc(tasks.title))

  return linked
})
