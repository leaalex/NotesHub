import { and, eq } from 'drizzle-orm'
import type { ContactFieldKind } from '../../../shared/contact-types'
import { taskFieldTemplates, taskFieldValues } from '../../database/schema'
import { db } from '../../utils/db'
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
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    label?: string
    fieldType?: string
    position?: number
  }>(event)

  const [existing] = await db
    .select()
    .from(taskFieldTemplates)
    .where(and(
      eq(taskFieldTemplates.id, id),
      eq(taskFieldTemplates.userId, session.user.id),
    ))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  if (body.fieldType !== undefined) {
    const ft = body.fieldType as ContactFieldKind
    if (!FIELD_TYPES.includes(ft))
      throw createError({ statusCode: 400, statusMessage: 'Invalid field type' })
  }

  const nextLabel = body.label !== undefined ? body.label.trim() : existing.label
  const nextFt = body.fieldType !== undefined ? body.fieldType : existing.fieldType
  const nextPos = body.position !== undefined ? body.position : existing.position

  await db
    .update(taskFieldTemplates)
    .set({
      label: nextLabel,
      fieldType: nextFt,
      position: nextPos,
    })
    .where(eq(taskFieldTemplates.id, id))

  await db
    .update(taskFieldValues)
    .set({
      label: nextLabel,
      fieldType: nextFt,
      position: nextPos,
    })
    .where(eq(taskFieldValues.templateId, id))

  const [row] = await db
    .select()
    .from(taskFieldTemplates)
    .where(eq(taskFieldTemplates.id, id))

  return row
})
