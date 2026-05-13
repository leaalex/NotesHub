import { and, eq } from 'drizzle-orm'
import { contactFiles, contacts, files } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const contactId = getRouterParam(event, 'id')
  if (!contactId)
    throw createError({ statusCode: 400, statusMessage: 'Missing contact id' })

  const body = await readBody<{ fileId?: string }>(event).catch(() => ({}))
  if (!body.fileId)
    throw createError({ statusCode: 400, statusMessage: 'fileId is required' })

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, session.user.id)))
  if (!contact)
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })

  const [file] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, body.fileId), eq(files.userId, session.user.id)))
  if (!file)
    throw createError({ statusCode: 404, statusMessage: 'File not found' })

  await db.insert(contactFiles).values({
    contactId,
    fileId: body.fileId,
  }).onConflictDoNothing()

  setResponseStatus(event, 204)
  return null
})
