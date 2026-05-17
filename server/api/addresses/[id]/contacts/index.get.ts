import { and, eq } from 'drizzle-orm'
import { addresses, contactAddresses, contacts } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [addr] = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.userId, session.user.id)))

  if (!addr)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const rows = await db
    .select({
      id: contacts.id,
      displayName: contacts.displayName,
      type: contacts.type,
      role: contactAddresses.role,
      isPrimary: contactAddresses.isPrimary,
    })
    .from(contactAddresses)
    .innerJoin(contacts, eq(contactAddresses.contactId, contacts.id))
    .where(and(eq(contactAddresses.addressId, id), eq(contacts.userId, session.user.id)))
    .orderBy(contacts.displayName)

  return rows
})
