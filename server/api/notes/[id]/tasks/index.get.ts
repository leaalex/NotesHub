import { and, asc, eq } from 'drizzle-orm'
import { noteTasks, notes, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const noteId = getRouterParam(event, 'id')
  if (!noteId)
    throw createError({ statusCode: 400, statusMessage: 'Missing note id' })

  const [noteRow] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)))

  if (!noteRow)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const linked = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
    })
    .from(noteTasks)
    .innerJoin(tasks, eq(noteTasks.taskId, tasks.id))
    .where(and(eq(noteTasks.noteId, noteId), eq(tasks.userId, session.user.id)))
    .orderBy(asc(tasks.title))

  return linked
})
