import { and, asc, eq } from 'drizzle-orm'
import {
  contactFieldValues,
  contacts,
  noteContacts,
  notes,
} from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, session.user.id)))

  if (!contact)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const fields = await db
    .select()
    .from(contactFieldValues)
    .where(eq(contactFieldValues.contactId, id))
    .orderBy(asc(contactFieldValues.position), asc(contactFieldValues.id))

  const linkedNotes = await db
    .select({
      id: notes.id,
      title: notes.title,
    })
    .from(noteContacts)
    .innerJoin(notes, eq(noteContacts.noteId, notes.id))
    .where(and(
      eq(noteContacts.contactId, id),
      eq(notes.userId, session.user.id),
    ))
    .orderBy(notes.updatedAt)

  return {
    ...contact,
    fields,
    linkedNotes,
  }
})
