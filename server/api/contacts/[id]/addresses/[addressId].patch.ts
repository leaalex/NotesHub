import { and, eq } from 'drizzle-orm'
import { addresses, contactAddresses, contacts } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

const ROLES = new Set(['shipping', 'billing', 'production', 'other'])

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const contactId = getRouterParam(event, 'id')
  const addressId = getRouterParam(event, 'addressId')
  if (!contactId || !addressId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    role?: string
    isPrimary?: boolean
  }>(event)

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, session.user.id)))

  if (!contact)
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })

  const [addr] = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, session.user.id)))

  if (!addr)
    throw createError({ statusCode: 404, statusMessage: 'Address not found' })

  const [link] = await db
    .select()
    .from(contactAddresses)
    .where(and(
      eq(contactAddresses.contactId, contactId),
      eq(contactAddresses.addressId, addressId),
    ))

  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Link not found' })

  const role = body.role !== undefined
    ? (ROLES.has(body.role) ? body.role : 'other')
    : link.role
  const isPrimary = body.isPrimary !== undefined ? Boolean(body.isPrimary) : link.isPrimary

  await db.transaction(async (tx) => {
    if (isPrimary) {
      await tx
        .update(contactAddresses)
        .set({ isPrimary: false })
        .where(eq(contactAddresses.contactId, contactId))
    }

    await tx
      .update(contactAddresses)
      .set({
        role,
        isPrimary,
      })
      .where(and(
        eq(contactAddresses.contactId, contactId),
        eq(contactAddresses.addressId, addressId),
      ))
  })

  setResponseStatus(event, 204)
  return null
})
