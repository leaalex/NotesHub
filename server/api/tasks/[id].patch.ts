import { and, eq } from 'drizzle-orm'
import { folders, tasks } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

const STATUSES = new Set(['todo', 'in_progress', 'done', 'cancelled'])
const PRIORITIES = new Set(['low', 'normal', 'high'])

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    title?: string
    description?: string
    folderId?: string | null
    parentId?: string | null
    status?: string
    priority?: string
    dueAt?: number | null
    completedAt?: number | null
    position?: number
  }>(event)

  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  if (body.folderId !== undefined && body.folderId !== null) {
    const [f] = await db.select().from(folders).where(eq(folders.id, body.folderId))
    if (!f || f.userId !== session.user.id)
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder' })
  }

  if (body.parentId !== undefined && body.parentId !== null) {
    if (body.parentId === id)
      throw createError({ statusCode: 400, statusMessage: 'Task cannot be its own parent' })
    const [p] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, body.parentId), eq(tasks.userId, session.user.id)))
    if (!p)
      throw createError({ statusCode: 400, statusMessage: 'Invalid parent task' })
  }

  if (body.status !== undefined && !STATUSES.has(body.status))
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  if (body.priority !== undefined && !PRIORITIES.has(body.priority))
    throw createError({ statusCode: 400, statusMessage: 'Invalid priority' })

  const nextStatus = body.status !== undefined ? body.status : existing.status
  const now = new Date()

  let completedAt = existing.completedAt
  if (body.completedAt !== undefined) {
    completedAt = body.completedAt != null ? new Date(body.completedAt) : null
  }
  else if (body.status !== undefined) {
    if (nextStatus === 'done' && !existing.completedAt)
      completedAt = now
    else if (nextStatus !== 'done')
      completedAt = null
  }

  await db
    .update(tasks)
    .set({
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description.trim() } : {}),
      ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
      ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.dueAt !== undefined
        ? { dueAt: body.dueAt != null ? new Date(body.dueAt) : null }
        : {}),
      ...(body.completedAt !== undefined || body.status !== undefined
        ? { completedAt }
        : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
      updatedAt: now,
    })
    .where(eq(tasks.id, id))

  const [row] = await db.select().from(tasks).where(eq(tasks.id, id))
  return row
})
