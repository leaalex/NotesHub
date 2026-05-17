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
} from '../../../database/schema'
import { db } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token)
    throw createError({ statusCode: 400, statusMessage: 'Missing token' })

  const [row] = await db
    .select({
      id: tasks.id,
      userId: tasks.userId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      updatedAt: tasks.updatedAt,
      shareExpiresAt: tasks.shareExpiresAt,
      shareEnabled: tasks.shareEnabled,
    })
    .from(tasks)
    .where(and(eq(tasks.shareToken, token), eq(tasks.shareEnabled, true)))

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  if (row.shareExpiresAt && row.shareExpiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 404, statusMessage: 'Link expired' })
  }

  const fieldRows = await db
    .select({
      label: taskFieldValues.label,
      fieldType: taskFieldValues.fieldType,
      value: taskFieldValues.value,
      position: taskFieldValues.position,
    })
    .from(taskFieldValues)
    .where(eq(taskFieldValues.taskId, row.id))
    .orderBy(asc(taskFieldValues.position), asc(taskFieldValues.id))

  const linkedNoteRows = await db
    .select({
      title: notes.title,
      shareEnabled: notes.shareEnabled,
      shareToken: notes.shareToken,
    })
    .from(noteTasks)
    .innerJoin(notes, eq(noteTasks.noteId, notes.id))
    .where(and(eq(noteTasks.taskId, row.id), eq(notes.userId, row.userId)))
    .orderBy(notes.updatedAt)

  const linkedContactRows = await db
    .select({
      displayName: contacts.displayName,
      shareEnabled: contacts.shareEnabled,
      shareToken: contacts.shareToken,
    })
    .from(contactTasks)
    .innerJoin(contacts, eq(contactTasks.contactId, contacts.id))
    .where(and(eq(contactTasks.taskId, row.id), eq(contacts.userId, row.userId)))
    .orderBy(contacts.displayName)

  const linkedFileRows = await db
    .select({
      originalName: files.originalName,
      mimeType: files.mimeType,
      size: files.size,
      shareEnabled: files.shareEnabled,
      shareToken: files.shareToken,
    })
    .from(taskFiles)
    .innerJoin(files, eq(taskFiles.fileId, files.id))
    .where(and(eq(taskFiles.taskId, row.id), eq(files.userId, row.userId)))
    .orderBy(files.updatedAt)

  const config = useRuntimeConfig()
  const base = (config.public.siteUrl as string).replace(/\/$/, '')

  return {
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueAt: row.dueAt,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt,
    fields: fieldRows,
    linkedNotes: linkedNoteRows.map(n => ({
      title: n.title || 'Untitled',
      shareUrl: n.shareEnabled && n.shareToken ? `${base}/share/${n.shareToken}` : null,
    })),
    linkedContacts: linkedContactRows.map(c => ({
      displayName: c.displayName,
      shareUrl: c.shareEnabled && c.shareToken ? `${base}/share/contact/${c.shareToken}` : null,
    })),
    linkedFiles: linkedFileRows.map(f => ({
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      shareUrl: f.shareEnabled && f.shareToken ? `${base}/share/file/${f.shareToken}` : null,
    })),
  }
})
