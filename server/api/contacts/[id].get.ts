import { and, asc, eq } from 'drizzle-orm'
import {
  contactFiles,
  contactFieldValues,
  contactTasks,
  contacts,
  files,
  noteContacts,
  notes,
  tasks,
} from '../../database/schema'
import { db } from '../../utils/db'
import { toFileDto } from '../../utils/file-dto'
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

  const linkedFiles = await db
    .select({ file: files })
    .from(contactFiles)
    .innerJoin(files, eq(contactFiles.fileId, files.id))
    .where(and(eq(contactFiles.contactId, id), eq(files.userId, session.user.id)))
    .orderBy(files.updatedAt)

  const linkedTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
    })
    .from(contactTasks)
    .innerJoin(tasks, eq(contactTasks.taskId, tasks.id))
    .where(and(eq(contactTasks.contactId, id), eq(tasks.userId, session.user.id)))
    .orderBy(tasks.title)

  const config = useRuntimeConfig()
  return {
    ...contact,
    fields,
    linkedNotes,
    linkedFiles: linkedFiles.map(x => toFileDto(x.file, config.public.siteUrl as string)),
    linkedTasks,
  }
})
