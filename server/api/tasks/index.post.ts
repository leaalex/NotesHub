import { randomUUID } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import {
  folders,
  taskFieldTemplates,
  taskFieldValues,
  tasks,
} from '../../database/schema'
import { db } from '../../utils/db'
import { ensureTaskFieldTemplatesSeed } from '../../utils/task-template-seed'
import { requireUserSession } from '../../utils/session'

const STATUSES = new Set(['todo', 'in_progress', 'done', 'cancelled'])
const PRIORITIES = new Set(['low', 'normal', 'high'])

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  await ensureTaskFieldTemplatesSeed(db, session.user.id)

  const body = await readBody<{
    title?: string
    description?: string
    folderId?: string | null
    parentId?: string | null
    status?: string
    priority?: string
    dueAt?: number | null
    position?: number
  }>(event).catch(() => ({}))

  if (body.folderId) {
    const [f] = await db.select().from(folders).where(eq(folders.id, body.folderId))
    if (!f || f.userId !== session.user.id)
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder' })
  }

  if (body.parentId) {
    const [p] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, body.parentId), eq(tasks.userId, session.user.id)))
    if (!p)
      throw createError({ statusCode: 400, statusMessage: 'Invalid parent task' })
  }

  const status = body.status ?? 'todo'
  const priority = body.priority ?? 'normal'
  if (!STATUSES.has(status))
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  if (!PRIORITIES.has(priority))
    throw createError({ statusCode: 400, statusMessage: 'Invalid priority' })

  const id = randomUUID()
  const now = new Date()

  const templates = await db
    .select()
    .from(taskFieldTemplates)
    .where(eq(taskFieldTemplates.userId, session.user.id))
    .orderBy(asc(taskFieldTemplates.position))

  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id,
      userId: session.user.id,
      folderId: body.folderId ?? null,
      parentId: body.parentId ?? null,
      title: (body.title ?? '').trim(),
      description: (body.description ?? '').trim(),
      status,
      priority,
      dueAt: body.dueAt != null ? new Date(body.dueAt) : null,
      completedAt: status === 'done' ? now : null,
      position: body.position ?? 0,
      shareEnabled: false,
      createdAt: now,
      updatedAt: now,
    })

    if (templates.length > 0) {
      await tx.insert(taskFieldValues).values(
        templates.map(t => ({
          id: randomUUID(),
          taskId: id,
          templateId: t.id,
          label: t.label,
          fieldType: t.fieldType,
          value: '',
          position: t.position,
        })),
      )
    }
  })

  const [row] = await db.select().from(tasks).where(eq(tasks.id, id))
  return row
})
