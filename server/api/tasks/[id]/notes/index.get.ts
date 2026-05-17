import { and, desc, eq } from 'drizzle-orm'
import { noteTasks, notes, tasks } from '../../../../database/schema'
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
      id: notes.id,
      title: notes.title,
    })
    .from(noteTasks)
    .innerJoin(notes, eq(noteTasks.noteId, notes.id))
    .where(and(eq(noteTasks.taskId, taskId), eq(notes.userId, session.user.id)))
    .orderBy(desc(notes.updatedAt))

  return linked
})
