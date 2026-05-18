import { and, eq } from 'drizzle-orm'
import {
  contactFiles,
  contacts,
  files,
  noteFiles,
  notes,
  taskFiles,
  tasks,
} from '../../../../database/schema'
import { db } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token)
    throw createError({ statusCode: 400, statusMessage: 'Missing token' })

  const [row] = await db
    .select({
      id: files.id,
      userId: files.userId,
      originalName: files.originalName,
      title: files.title,
      description: files.description,
      mimeType: files.mimeType,
      size: files.size,
      updatedAt: files.updatedAt,
      shareExpiresAt: files.shareExpiresAt,
      shareEnabled: files.shareEnabled,
      shareIncludeLinks: files.shareIncludeLinks,
    })
    .from(files)
    .where(and(eq(files.shareToken, token), eq(files.shareEnabled, true)))

  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  if (row.shareExpiresAt && row.shareExpiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 404, statusMessage: 'Link expired' })
  }

  const includeLinks = row.shareIncludeLinks ?? true

  const linkedNoteRows = includeLinks
    ? await db
        .select({
          title: notes.title,
          shareEnabled: notes.shareEnabled,
          shareToken: notes.shareToken,
        })
        .from(noteFiles)
        .innerJoin(notes, eq(noteFiles.noteId, notes.id))
        .where(and(eq(noteFiles.fileId, row.id), eq(notes.userId, row.userId)))
        .orderBy(notes.updatedAt)
    : []

  const linkedContactRows = includeLinks
    ? await db
        .select({
          displayName: contacts.displayName,
          shareEnabled: contacts.shareEnabled,
          shareToken: contacts.shareToken,
        })
        .from(contactFiles)
        .innerJoin(contacts, eq(contactFiles.contactId, contacts.id))
        .where(and(eq(contactFiles.fileId, row.id), eq(contacts.userId, row.userId)))
        .orderBy(contacts.displayName)
    : []

  const linkedTaskRows = includeLinks
    ? await db
        .select({
          title: tasks.title,
          shareEnabled: tasks.shareEnabled,
          shareToken: tasks.shareToken,
        })
        .from(taskFiles)
        .innerJoin(tasks, eq(taskFiles.taskId, tasks.id))
        .where(and(eq(taskFiles.fileId, row.id), eq(tasks.userId, row.userId)))
        .orderBy(tasks.updatedAt)
    : []

  const config = useRuntimeConfig()
  const base = (config.public.siteUrl as string).replace(/\/$/, '')

  return {
    originalName: row.originalName,
    title: row.title,
    description: row.description,
    mimeType: row.mimeType,
    size: row.size,
    updatedAt: row.updatedAt,
    downloadUrl: `${base}/api/share/file/${encodeURIComponent(token)}/download`,
    linkedNotes: linkedNoteRows.map(n => ({
      title: n.title || 'Untitled',
      shareUrl: n.shareEnabled && n.shareToken ? `${base}/share/${n.shareToken}` : null,
    })),
    linkedContacts: linkedContactRows.map(c => ({
      displayName: c.displayName,
      shareUrl: c.shareEnabled && c.shareToken ? `${base}/share/contact/${c.shareToken}` : null,
    })),
    linkedTasks: linkedTaskRows.map(t => ({
      title: t.title || 'Untitled',
      shareUrl: t.shareEnabled && t.shareToken ? `${base}/share/task/${t.shareToken}` : null,
    })),
  }
})
