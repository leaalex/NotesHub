import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { ContactFieldKind } from '../../../../shared/contact-types'
import {
  taskFieldTemplates,
  taskFieldValues,
  tasks,
} from '../../../database/schema'
import { db } from '../../../utils/db'
import { requireUserSession } from '../../../utils/session'

const FIELD_TYPES: ContactFieldKind[] = [
  'text',
  'email',
  'phone',
  'url',
  'date',
  'address',
  'longtext',
]

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing task id' })

  const body = await readBody<{
    label?: string
    fieldType?: string
    value?: string
    templateId?: string | null
  }>(event)

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)))

  if (!task)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  let label: string
  let ft: ContactFieldKind
  let tplId: string | null = null

  if (body.templateId) {
    const [tpl] = await db
      .select()
      .from(taskFieldTemplates)
      .where(and(
        eq(taskFieldTemplates.id, body.templateId),
        eq(taskFieldTemplates.userId, session.user.id),
      ))

    if (!tpl)
      throw createError({ statusCode: 400, statusMessage: 'Invalid template' })

    const [dup] = await db
      .select({ id: taskFieldValues.id })
      .from(taskFieldValues)
      .where(and(
        eq(taskFieldValues.taskId, id),
        eq(taskFieldValues.templateId, tpl.id),
      ))

    if (dup)
      throw createError({ statusCode: 409, statusMessage: 'Field already linked' })

    label = tpl.label
    ft = tpl.fieldType as ContactFieldKind
    tplId = tpl.id
  }
  else {
    label = (body.label ?? '').trim()
    if (!label)
      throw createError({ statusCode: 400, statusMessage: 'Label is required' })

    ft = (body.fieldType ?? 'text') as ContactFieldKind
    if (!FIELD_TYPES.includes(ft))
      throw createError({ statusCode: 400, statusMessage: 'Invalid field type' })
  }

  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${taskFieldValues.position}), -1)`.mapWith(Number) })
    .from(taskFieldValues)
    .where(eq(taskFieldValues.taskId, id))

  const fid = randomUUID()
  await db.insert(taskFieldValues).values({
    id: fid,
    taskId: id,
    templateId: tplId,
    label,
    fieldType: ft,
    value: body.value ?? '',
    position: maxPos + 1,
  })

  const [row] = await db
    .select()
    .from(taskFieldValues)
    .where(eq(taskFieldValues.id, fid))

  return row
})
