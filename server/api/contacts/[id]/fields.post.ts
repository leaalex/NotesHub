import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { ContactFieldKind } from '../../../../shared/contact-types'
import {
  contactFieldTemplates,
  contactFieldValues,
  contacts,
} from '../../../database/schema'
import { db } from '../../../utils/db'
import { requireUserSession } from '../../../utils/session'

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
    throw createError({ statusCode: 400, statusMessage: 'Missing contact id' })

  const body = await readBody<{
    label?: string
    fieldType?: string
    value?: string
    templateId?: string | null
  }>(event)

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, session.user.id)))

  if (!contact)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  let label: string
  let ft: ContactFieldKind
  let tplId: string | null = null

  if (body.templateId) {
    const [tpl] = await db
      .select()
      .from(contactFieldTemplates)
      .where(and(
        eq(contactFieldTemplates.id, body.templateId),
        eq(contactFieldTemplates.userId, session.user.id),
        eq(contactFieldTemplates.contactType, contact.type),
      ))

    if (!tpl)
      throw createError({ statusCode: 400, statusMessage: 'Invalid template' })

    const [dup] = await db
      .select({ id: contactFieldValues.id })
      .from(contactFieldValues)
      .where(and(
        eq(contactFieldValues.contactId, id),
        eq(contactFieldValues.templateId, tpl.id),
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
    .select({ maxPos: sql<number>`coalesce(max(${contactFieldValues.position}), -1)`.mapWith(Number) })
    .from(contactFieldValues)
    .where(eq(contactFieldValues.contactId, id))

  const fid = randomUUID()
  await db.insert(contactFieldValues).values({
    id: fid,
    contactId: id,
    templateId: tplId,
    label,
    fieldType: ft,
    value: body.value ?? '',
    position: maxPos + 1,
  })

  const [row] = await db
    .select()
    .from(contactFieldValues)
    .where(eq(contactFieldValues.id, fid))

  return row
})
