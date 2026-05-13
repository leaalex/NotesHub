import { and, eq } from 'drizzle-orm'
import { contactFieldValues, contacts } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const cid = getRouterParam(event, 'id')
  const fieldId = getRouterParam(event, 'fieldId')
  if (!cid || !fieldId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, cid), eq(contacts.userId, session.user.id)))

  if (!contact)
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })

  const [existing] = await db
    .select({ id: contactFieldValues.id })
    .from(contactFieldValues)
    .where(and(eq(contactFieldValues.id, fieldId), eq(contactFieldValues.contactId, cid)))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Field not found' })

  await db
    .delete(contactFieldValues)
    .where(and(eq(contactFieldValues.id, fieldId), eq(contactFieldValues.contactId, cid)))

  setResponseStatus(event, 204)
  return null
})
