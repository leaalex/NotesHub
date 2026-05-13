import { and, desc, eq } from 'drizzle-orm'
import { contactFiles, contacts, files } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { toFileDto } from '../../../../utils/file-dto'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const contactId = getRouterParam(event, 'id')
  if (!contactId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, session.user.id)))

  if (!contact)
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })

  const rows = await db
    .select({ file: files })
    .from(contactFiles)
    .innerJoin(files, eq(contactFiles.fileId, files.id))
    .where(and(eq(contactFiles.contactId, contactId), eq(files.userId, session.user.id)))
    .orderBy(desc(contactFiles.createdAt))

  const config = useRuntimeConfig()
  return rows.map(row => toFileDto(row.file, config.public.siteUrl as string))
})
