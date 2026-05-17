import { and, desc, eq, isNull } from 'drizzle-orm'
import { tasks } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

const STATUSES = new Set(['todo', 'in_progress', 'done', 'cancelled'])
const PRIORITIES = new Set(['low', 'normal', 'high'])

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const q = getQuery(event)
  const folderId = typeof q.folderId === 'string' ? q.folderId : undefined
  const status = typeof q.status === 'string' ? q.status : undefined
  const priority = typeof q.priority === 'string' ? q.priority : undefined
  const parentId = typeof q.parentId === 'string' ? q.parentId : undefined

  const parts = [eq(tasks.userId, session.user.id)]

  if (folderId === 'unfiled')
    parts.push(isNull(tasks.folderId))
  else if (folderId && folderId !== 'all')
    parts.push(eq(tasks.folderId, folderId))

  if (status) {
    if (!STATUSES.has(status))
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    parts.push(eq(tasks.status, status))
  }

  if (priority) {
    if (!PRIORITIES.has(priority))
      throw createError({ statusCode: 400, statusMessage: 'Invalid priority' })
    parts.push(eq(tasks.priority, priority))
  }

  if (parentId === 'root')
    parts.push(isNull(tasks.parentId))
  else if (parentId)
    parts.push(eq(tasks.parentId, parentId))

  return await db
    .select({
      id: tasks.id,
      folderId: tasks.folderId,
      parentId: tasks.parentId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      updatedAt: tasks.updatedAt,
      shareEnabled: tasks.shareEnabled,
    })
    .from(tasks)
    .where(and(...parts))
    .orderBy(desc(tasks.updatedAt))
})
