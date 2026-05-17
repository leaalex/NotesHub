import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { ContactFieldKind, ContactKind } from '../../../shared/contact-types'
import {
  contacts,
  contactFieldTemplates,
  contactFieldValues,
} from '../../database/schema'
import { db } from '../../utils/db'
import { ensureContactFieldTemplatesSeed } from '../../utils/contact-template-seed'
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
  await ensureContactFieldTemplatesSeed(db, session.user.id)

  const body = await readBody<{
    contactType?: string
    label?: string
    fieldType?: string
    position?: number
  }>(event)

  const ct = body.contactType === 'organization'
    ? 'organization'
    : body.contactType === 'person'
      ? 'person'
      : ''

  if (ct !== 'person' && ct !== 'organization')
    throw createError({ statusCode: 400, statusMessage: 'Invalid contact type' })

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
        maxPos: sql<number>`coalesce(max(${contactFieldTemplates.position}), -1)`.mapWith(Number),
      })
      .from(contactFieldTemplates)
      .where(and(
        eq(contactFieldTemplates.userId, session.user.id),
        eq(contactFieldTemplates.contactType, ct as ContactKind),
      ))

    position = maxPos + 1
  }

  const tplId = randomUUID()
  await db.insert(contactFieldTemplates).values({
    id: tplId,
    userId: session.user.id,
    contactType: ct as ContactKind,
    label,
    fieldType: ft,
    position,
  })

  const userContacts = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(
      eq(contacts.userId, session.user.id),
      eq(contacts.type, ct as ContactKind),
    ))

  if (userContacts.length > 0) {
    await db.insert(contactFieldValues).values(
      userContacts.map(row => ({
        id: randomUUID(),
        contactId: row.id,
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
    .from(contactFieldTemplates)
    .where(eq(contactFieldTemplates.id, tplId))

  return row
})
