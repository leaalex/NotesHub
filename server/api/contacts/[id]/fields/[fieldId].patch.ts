import { and, eq } from 'drizzle-orm'
import type { ContactFieldKind } from '../../../../../shared/contact-types'
import { contactFieldValues, contacts } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

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
  const cid = getRouterParam(event, 'id')
  const fieldId = getRouterParam(event, 'fieldId')
  if (!cid || !fieldId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    label?: string
    fieldType?: string
    value?: string
    position?: number
  }>(event)

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, cid), eq(contacts.userId, session.user.id)))

  if (!contact)
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })

  const [existing] = await db
    .select()
    .from(contactFieldValues)
    .where(and(eq(contactFieldValues.id, fieldId), eq(contactFieldValues.contactId, cid)))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Field not found' })

  if (body.fieldType !== undefined) {
    const ft = body.fieldType as ContactFieldKind
    if (!FIELD_TYPES.includes(ft))
      throw createError({ statusCode: 400, statusMessage: 'Invalid field type' })
  }

  await db
    .update(contactFieldValues)
    .set({
      ...(body.label !== undefined ? { label: body.label.trim() } : {}),
      ...(body.fieldType !== undefined ? { fieldType: body.fieldType } : {}),
      ...(body.value !== undefined ? { value: body.value } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
    })
    .where(eq(contactFieldValues.id, fieldId))

  const [row] = await db
    .select()
    .from(contactFieldValues)
    .where(eq(contactFieldValues.id, fieldId))

  return row
})
