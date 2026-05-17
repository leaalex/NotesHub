import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { addresses, contactAddresses, contacts } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

const ROLES = new Set(['shipping', 'billing', 'production', 'other'])

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const contactId = getRouterParam(event, 'id')
  if (!contactId)
    throw createError({ statusCode: 400, statusMessage: 'Missing contact id' })

  const body = await readBody<{
    addressId?: string
    role?: string
    isPrimary?: boolean
  }>(event).catch(() => ({}))

  if (!body.addressId)
    throw createError({ statusCode: 400, statusMessage: 'addressId is required' })

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, session.user.id)))

  if (!contact)
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })

  const [addr] = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(and(eq(addresses.id, body.addressId), eq(addresses.userId, session.user.id)))

  if (!addr)
    throw createError({ statusCode: 404, statusMessage: 'Address not found' })

  const role = body.role && ROLES.has(body.role) ? body.role : 'other'
  const isPrimary = Boolean(body.isPrimary)

  const [dupe] = await db
    .select({ id: contactAddresses.id })
    .from(contactAddresses)
    .where(and(
      eq(contactAddresses.contactId, contactId),
      eq(contactAddresses.addressId, body.addressId),
    ))

  if (dupe)
    throw createError({ statusCode: 409, statusMessage: 'Address already linked' })

  await db.transaction(async (tx) => {
    if (isPrimary) {
      await tx
        .update(contactAddresses)
        .set({ isPrimary: false })
        .where(eq(contactAddresses.contactId, contactId))
    }

    await tx.insert(contactAddresses).values({
      id: randomUUID(),
      contactId,
      addressId: body.addressId,
      role,
      isPrimary,
    })
  })

  setResponseStatus(event, 204)
  return null
})
