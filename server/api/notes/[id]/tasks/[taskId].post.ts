import { and, eq } from 'drizzle-orm'
import { noteTasks, notes, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const noteId = getRouterParam(event, 'id')
  const taskId = getRouterParam(event, 'taskId')
  if (!noteId || !taskId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [noteRow] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)))

  if (!noteRow)
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })

  const [taskRow] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))

  if (!taskRow)
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  await db.insert(noteTasks).values({ noteId, taskId }).onConflictDoNothing()

  setResponseStatus(event, 204)
  return null
})
