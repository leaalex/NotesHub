import { and, asc, eq } from 'drizzle-orm'
import { fileFieldValues, files, taskFiles, tasks } from '../../database/schema'
import { db } from '../../utils/db'
import { toFileDto } from '../../utils/file-dto'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, session.user.id)))

  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const fields = await db
    .select()
    .from(fileFieldValues)
    .where(eq(fileFieldValues.fileId, id))
    .orderBy(asc(fileFieldValues.position), asc(fileFieldValues.id))

  const linkedTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      shareEnabled: tasks.shareEnabled,
      shareToken: tasks.shareToken,
    })
    .from(taskFiles)
    .innerJoin(tasks, eq(taskFiles.taskId, tasks.id))
    .where(and(eq(taskFiles.fileId, id), eq(tasks.userId, session.user.id)))
    .orderBy(tasks.title)

  const config = useRuntimeConfig()
  return {
    ...toFileDto(row, config.public.siteUrl as string),
    fields,
    linkedTasks,
  }
})
