import { and, asc, eq } from 'drizzle-orm'
import {
  contactTasks,
  contacts,
  files,
  noteTasks,
  notes,
  taskFieldValues,
  taskFiles,
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

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)))

  if (!task)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const fields = await db
    .select()
    .from(taskFieldValues)
    .where(eq(taskFieldValues.taskId, id))
    .orderBy(asc(taskFieldValues.position), asc(taskFieldValues.id))

  const linkedNotes = await db
    .select({
      id: notes.id,
      title: notes.title,
      shareEnabled: notes.shareEnabled,
      shareToken: notes.shareToken,
    })
    .from(noteTasks)
    .innerJoin(notes, eq(noteTasks.noteId, notes.id))
    .where(and(eq(noteTasks.taskId, id), eq(notes.userId, session.user.id)))
    .orderBy(notes.updatedAt)

  const linkedContacts = await db
    .select({
      id: contacts.id,
      displayName: contacts.displayName,
      type: contacts.type,
      shareEnabled: contacts.shareEnabled,
      shareToken: contacts.shareToken,
    })
    .from(contactTasks)
    .innerJoin(contacts, eq(contactTasks.contactId, contacts.id))
    .where(and(eq(contactTasks.taskId, id), eq(contacts.userId, session.user.id)))
    .orderBy(contacts.displayName)

  const linkedFileRows = await db
    .select({ file: files })
    .from(taskFiles)
    .innerJoin(files, eq(taskFiles.fileId, files.id))
    .where(and(eq(taskFiles.taskId, id), eq(files.userId, session.user.id)))
    .orderBy(files.updatedAt)

  const children = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueAt: tasks.dueAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(and(eq(tasks.parentId, id), eq(tasks.userId, session.user.id)))
    .orderBy(asc(tasks.position), asc(tasks.title))

  const config = useRuntimeConfig()
  return {
    ...task,
    fields,
    linkedNotes,
    linkedContacts,
    linkedFiles: linkedFileRows.map(x => toFileDto(x.file, config.public.siteUrl as string)),
    children,
  }
})
