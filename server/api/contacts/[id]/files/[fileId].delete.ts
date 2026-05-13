import { and, eq } from 'drizzle-orm'
import { contactFiles, contacts } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const contactId = getRouterParam(event, 'id')
  const fileId = getRouterParam(event, 'fileId')
  if (!contactId || !fileId)
    throw createError({ statusCode: 400, statusMessage: 'Missing ids' })

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, session.user.id)))
  if (!contact)
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })

  await db
    .delete(contactFiles)
    .where(and(eq(contactFiles.contactId, contactId), eq(contactFiles.fileId, fileId)))

  setResponseStatus(event, 204)
  return null
})
