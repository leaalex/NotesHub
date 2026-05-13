import { and, eq } from 'drizzle-orm'
import { noteContacts, notes } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const noteId = getRouterParam(event, 'id')
  const contactId = getRouterParam(event, 'contactId')
  if (!noteId || !contactId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [noteRow] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)))

  if (!noteRow)
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })

  await db
    .delete(noteContacts)
    .where(and(
      eq(noteContacts.noteId, noteId),
      eq(noteContacts.contactId, contactId),
    ))

  setResponseStatus(event, 204)
  return null
})
