import { and, eq } from 'drizzle-orm'
import type { ContactFieldKind } from '../../../shared/contact-types'
import { contactFieldTemplates, contactFieldValues } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

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
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    label?: string
    fieldType?: string
    position?: number
  }>(event)

  const [existing] = await db
    .select()
    .from(contactFieldTemplates)
    .where(and(
      eq(contactFieldTemplates.id, id),
      eq(contactFieldTemplates.userId, session.user.id),
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
    .update(contactFieldTemplates)
    .set({
      label: nextLabel,
      fieldType: nextFt,
      position: nextPos,
    })
    .where(eq(contactFieldTemplates.id, id))

  await db
    .update(contactFieldValues)
    .set({
      label: nextLabel,
      fieldType: nextFt,
      position: nextPos,
    })
    .where(eq(contactFieldValues.templateId, id))

  const [row] = await db
    .select()
    .from(contactFieldTemplates)
    .where(eq(contactFieldTemplates.id, id))

  return row
})
