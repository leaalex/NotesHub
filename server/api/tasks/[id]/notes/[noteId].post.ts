import { and, eq } from 'drizzle-orm'
import { noteTasks, notes, tasks } from '../../../../database/schema'
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

  const [noteRow] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)))

  if (!noteRow)
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })

  await db.insert(noteTasks).values({ noteId, taskId }).onConflictDoNothing()

  setResponseStatus(event, 204)
  return null
})
