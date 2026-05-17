import { and, eq } from 'drizzle-orm'
import { addresses, contactAddresses, contacts } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const contactId = getRouterParam(event, 'id')
  const addressId = getRouterParam(event, 'addressId')
  if (!contactId || !addressId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

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

  await db
    .delete(contactAddresses)
    .where(and(
      eq(contactAddresses.contactId, contactId),
      eq(contactAddresses.addressId, addressId),
    ))

  setResponseStatus(event, 204)
  return null
})
