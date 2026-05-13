import { and, eq } from 'drizzle-orm'
import type { ContactKind } from '../../../shared/contact-types'
import { contacts, folders } from '../../database/schema'
import { db } from '../../utils/db'
import { computeContactDisplayName } from '../../utils/contact-display-name'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    type?: string
    firstName?: string
    lastName?: string
    orgName?: string
    note?: string
    folderId?: string | null
  }>(event)

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, session.user.id)))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  if (body.folderId !== undefined && body.folderId !== null) {
    const [f] = await db.select().from(folders).where(eq(folders.id, body.folderId))
    if (!f || f.userId !== session.user.id)
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder' })
  }

  const nextType = (body.type === 'organization'
    ? 'organization'
    : body.type === 'person'
      ? 'person'
      : existing.type) as ContactKind

  const firstName = body.firstName !== undefined ? body.firstName.trim() : existing.firstName ?? ''
  const lastName = body.lastName !== undefined ? body.lastName.trim() : existing.lastName ?? ''
  const orgName = body.orgName !== undefined ? body.orgName.trim() : existing.orgName ?? ''
  const note = body.note !== undefined ? body.note.trim() : existing.note ?? ''

  const displayName = computeContactDisplayName({
    type: nextType,
    firstName,
    lastName,
    orgName,
  })

  await db
    .update(contacts)
    .set({
      ...(body.type !== undefined ? { type: nextType } : {}),
      firstName,
      lastName,
      orgName,
      note,
      displayName,
      ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id))

  const [row] = await db.select().from(contacts).where(eq(contacts.id, id))
  return row
})
