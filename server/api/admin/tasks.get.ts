import { asc } from 'drizzle-orm'
import { tasks } from '../../database/schema'
import { db } from '../../utils/db'
import { requireAdminSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  return await db
    .select({
      id: tasks.id,
      userId: tasks.userId,
      folderId: tasks.folderId,
      parentId: tasks.parentId,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      shareEnabled: tasks.shareEnabled,
      shareToken: tasks.shareToken,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .orderBy(asc(tasks.updatedAt))
})
