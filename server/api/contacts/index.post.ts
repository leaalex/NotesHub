import { randomUUID } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import type { ContactKind } from '../../../shared/contact-types'
import {
  contactFieldTemplates,
  contactFieldValues,
  contacts,
  folders,
} from '../../database/schema'
import { db } from '../../utils/db'
import { computeContactDisplayName } from '../../utils/contact-display-name'
import { ensureContactFieldTemplatesSeed } from '../../utils/contact-template-seed'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  await ensureContactFieldTemplatesSeed(db, session.user.id)

  const body = await readBody<{
    type?: string
    firstName?: string
    lastName?: string
    orgName?: string
    note?: string
    folderId?: string | null
  }>(event)

  const kind: ContactKind
    = body.type === 'organization' ? 'organization' : 'person'

  if (body.folderId) {
    const [f] = await db.select().from(folders).where(eq(folders.id, body.folderId))
    if (!f || f.userId !== session.user.id)
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder' })
  }

  const firstName = (body.firstName ?? '').trim()
  const lastName = (body.lastName ?? '').trim()
  const orgName = (body.orgName ?? '').trim()
  const note = (body.note ?? '').trim()
  const displayName = computeContactDisplayName({
    type: kind,
    firstName,
    lastName,
    orgName,
  })

  const id = randomUUID()
  const now = new Date()

  await db.insert(contacts).values({
    id,
    userId: session.user.id,
    folderId: body.folderId ?? null,
    type: kind,
    firstName,
    lastName,
    orgName,
    displayName,
    note,
    createdAt: now,
    updatedAt: now,
  })

  const templates = await db
    .select()
    .from(contactFieldTemplates)
    .where(and(
      eq(contactFieldTemplates.userId, session.user.id),
      eq(contactFieldTemplates.contactType, kind),
    ))
    .orderBy(asc(contactFieldTemplates.position))

  if (templates.length > 0) {
    await db.insert(contactFieldValues).values(
      templates.map(t => ({
        id: randomUUID(),
        contactId: id,
        templateId: t.id,
        label: t.label,
        fieldType: t.fieldType,
        value: '',
        position: t.position,
      })),
    )
  }

  const [row] = await db.select().from(contacts).where(eq(contacts.id, id))
  return row
})