import { and, asc, eq } from 'drizzle-orm'
import { addresses, contactAddresses, contacts } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const contactId = getRouterParam(event, 'id')
  if (!contactId)
    throw createError({ statusCode: 400, statusMessage: 'Missing contact id' })

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, session.user.id)))

  if (!contact)
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })

  const rows = await db
    .select({
      linkId: contactAddresses.id,
      addressId: addresses.id,
      label: addresses.label,
      line1: addresses.line1,
      city: addresses.city,
      countryCode: addresses.countryCode,
      role: contactAddresses.role,
      isPrimary: contactAddresses.isPrimary,
    })
    .from(contactAddresses)
    .innerJoin(addresses, eq(contactAddresses.addressId, addresses.id))
    .where(and(eq(contactAddresses.contactId, contactId), eq(addresses.userId, session.user.id)))
    .orderBy(asc(addresses.label), asc(addresses.city))

  return rows
})
