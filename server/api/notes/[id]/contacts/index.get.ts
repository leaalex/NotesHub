import { and, asc, eq } from 'drizzle-orm'
import { contacts, noteContacts, notes } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const noteId = getRouterParam(event, 'id')
  if (!noteId)
    throw createError({ statusCode: 400, statusMessage: 'Missing note id' })

  const [noteRow] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)))

  if (!noteRow)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const linked = await db
    .select({
      contactId: contacts.id,
      displayName: contacts.displayName,
      type: contacts.type,
      source: noteContacts.source,
      shareEnabled: contacts.shareEnabled,
      shareToken: contacts.shareToken,
    })
    .from(noteContacts)
    .innerJoin(contacts, eq(noteContacts.contactId, contacts.id))
    .where(and(
      eq(noteContacts.noteId, noteId),
      eq(contacts.userId, session.user.id),
    ))
    .orderBy(asc(contacts.displayName))

  return linked
})
