import { and, eq } from 'drizzle-orm'
import type { ContactFieldKind } from '../../../../../shared/contact-types'
import { taskFieldValues, tasks } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

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
  const tid = getRouterParam(event, 'id')
  const fieldId = getRouterParam(event, 'fieldId')
  if (!tid || !fieldId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    label?: string
    fieldType?: string
    value?: string
    position?: number
  }>(event)

  const [taskRow] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, tid), eq(tasks.userId, session.user.id)))

  if (!taskRow)
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  const [existing] = await db
    .select()
    .from(taskFieldValues)
    .where(and(eq(taskFieldValues.id, fieldId), eq(taskFieldValues.taskId, tid)))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Field not found' })

  if (body.fieldType !== undefined) {
    const ft = body.fieldType as ContactFieldKind
    if (!FIELD_TYPES.includes(ft))
      throw createError({ statusCode: 400, statusMessage: 'Invalid field type' })
  }

  await db
    .update(taskFieldValues)
    .set({
      ...(body.label !== undefined ? { label: body.label.trim() } : {}),
      ...(body.fieldType !== undefined ? { fieldType: body.fieldType } : {}),
      ...(body.value !== undefined ? { value: body.value } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
    })
    .where(eq(taskFieldValues.id, fieldId))

  await db
    .update(tasks)
    .set({ updatedAt: new Date() })
    .where(eq(tasks.id, tid))

  const [row] = await db
    .select()
    .from(taskFieldValues)
    .where(eq(taskFieldValues.id, fieldId))

  return row
})
