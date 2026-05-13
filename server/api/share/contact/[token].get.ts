import { and, asc, eq } from 'drizzle-orm'
import {
  contactFieldValues,
  contactFiles,
  contacts,
  files,
  noteContacts,
  notes,
} from '../../../database/schema'
import { db } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token)
    throw createError({ statusCode: 400, statusMessage: 'Missing token' })

  const [row] = await db
    .select({
      id: contacts.id,
      userId: contacts.userId,
      type: contacts.type,
      displayName: contacts.displayName,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      orgName: contacts.orgName,
      note: contacts.note,
      updatedAt: contacts.updatedAt,
      shareExpiresAt: contacts.shareExpiresAt,
      shareEnabled: contacts.shareEnabled,
    })
    .from(contacts)
    .where(and(eq(contacts.shareToken, token), eq(contacts.shareEnabled, true)))

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  if (row.shareExpiresAt && row.shareExpiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 404, statusMessage: 'Link expired' })
  }

  const fieldRows = await db
    .select({
      label: contactFieldValues.label,
      fieldType: contactFieldValues.fieldType,
      value: contactFieldValues.value,
      position: contactFieldValues.position,
    })
    .from(contactFieldValues)
    .where(eq(contactFieldValues.contactId, row.id))
    .orderBy(asc(contactFieldValues.position), asc(contactFieldValues.id))

  const linkedNoteRows = await db
    .select({
      title: notes.title,
      shareEnabled: notes.shareEnabled,
      shareToken: notes.shareToken,
    })
    .from(noteContacts)
    .innerJoin(notes, eq(noteContacts.noteId, notes.id))
    .where(and(
      eq(noteContacts.contactId, row.id),
      eq(notes.userId, row.userId),
    ))
    .orderBy(notes.updatedAt)

  const linkedFileRows = await db
    .select({
      originalName: files.originalName,
      mimeType: files.mimeType,
      size: files.size,
      shareEnabled: files.shareEnabled,
      shareToken: files.shareToken,
    })
    .from(contactFiles)
    .innerJoin(files, eq(contactFiles.fileId, files.id))
    .where(and(eq(contactFiles.contactId, row.id), eq(files.userId, row.userId)))
    .orderBy(files.updatedAt)

  const config = useRuntimeConfig()
  const base = (config.public.siteUrl as string).replace(/\/$/, '')

  return {
    type: row.type,
    displayName: row.displayName,
    firstName: row.firstName,
    lastName: row.lastName,
    orgName: row.orgName,
    note: row.note,
    updatedAt: row.updatedAt,
    fields: fieldRows,
    linkedNotes: linkedNoteRows.map(n => ({
      title: n.title || 'Untitled',
      shareUrl: n.shareEnabled && n.shareToken ? `${base}/share/${n.shareToken}` : null,
    })),
    linkedFiles: linkedFileRows.map(f => ({
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      shareUrl: f.shareEnabled && f.shareToken ? `${base}/share/file/${f.shareToken}` : null,
    })),
  }
})
