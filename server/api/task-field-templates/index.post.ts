import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { ContactFieldKind } from '../../../shared/contact-types'
import { taskFieldTemplates, taskFieldValues, tasks } from '../../database/schema'
import { db } from '../../utils/db'
import { ensureTaskFieldTemplatesSeed } from '../../utils/task-template-seed'
import { requireUserSession } from '../../utils/session'

const FIELD_TYPES: ContactFieldKind[] = [
  'text',
  'email',
  'phone',
  'url',
  'date',
  'longtext',
]

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  await ensureTaskFieldTemplatesSeed(db, session.user.id)

  const body = await readBody<{
    label?: string
    fieldType?: string
    position?: number
  }>(event)

  const label = (body.label ?? '').trim()
  if (!label)
    throw createError({ statusCode: 400, statusMessage: 'Label is required' })

  const ft = (body.fieldType ?? 'text') as ContactFieldKind
  if (!FIELD_TYPES.includes(ft))
    throw createError({ statusCode: 400, statusMessage: 'Invalid field type' })

  let position = body.position ?? 0
  if (body.position === undefined) {
    const [{ maxPos }] = await db
      .select({
        maxPos: sql<number>`coalesce(max(${taskFieldTemplates.position}), -1)`.mapWith(Number),
      })
      .from(taskFieldTemplates)
      .where(eq(taskFieldTemplates.userId, session.user.id))

    position = maxPos + 1
  }

  const tplId = randomUUID()
  await db.insert(taskFieldTemplates).values({
    id: tplId,
    userId: session.user.id,
    label,
    fieldType: ft,
    position,
  })

  const userTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.userId, session.user.id))

  if (userTasks.length > 0) {
    await db.insert(taskFieldValues).values(
      userTasks.map(row => ({
        id: randomUUID(),
        taskId: row.id,
        templateId: tplId,
        label,
        fieldType: ft,
        value: '',
        position,
      })),
    )
  }

  const [row] = await db
    .select()
    .from(taskFieldTemplates)
    .where(eq(taskFieldTemplates.id, tplId))

  return row
})
