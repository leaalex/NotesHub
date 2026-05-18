import { and, asc, eq, inArray } from 'drizzle-orm'
import {
  contacts,
  files,
  noteContacts,
  noteFiles,
  noteTasks,
  notes,
  tasks,
} from '../../database/schema'
import { db } from '../../utils/db'
import {
  extractMentionIdsFromTiptapJson,
  rewriteShareMentionHrefs,
  type ShareMentionEntityInfo,
} from '../../../shared/rewrite-share-mention-hrefs'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Missing token' })

  const [row] = await db
    .select({
      id: notes.id,
      userId: notes.userId,
      title: notes.title,
      content: notes.content,
      updatedAt: notes.updatedAt,
      shareExpiresAt: notes.shareExpiresAt,
      shareEnabled: notes.shareEnabled,
      shareIncludeLinks: notes.shareIncludeLinks,
    })
    .from(notes)
    .where(and(eq(notes.shareToken, token), eq(notes.shareEnabled, true)))

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  if (row.shareExpiresAt && row.shareExpiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 404, statusMessage: 'Link expired' })
  }

  const config = useRuntimeConfig()
  const baseUrl = (config.public.siteUrl as string).replace(/\/$/, '')
  const includeLinks = row.shareIncludeLinks !== false

  const { fileIds, contactIds } = extractMentionIdsFromTiptapJson(row.content)
  const fileLookup = new Map<string, ShareMentionEntityInfo>()
  const contactLookup = new Map<string, ShareMentionEntityInfo>()

  if (fileIds.length) {
    const fileRows = await db
      .select({
        id: files.id,
        shareEnabled: files.shareEnabled,
        shareToken: files.shareToken,
      })
      .from(files)
      .where(and(inArray(files.id, fileIds), eq(files.userId, row.userId)))
    for (const fr of fileRows) {
      fileLookup.set(fr.id, {
        shareEnabled: !!fr.shareEnabled,
        shareToken: fr.shareToken,
      })
    }
  }

  if (contactIds.length) {
    const contactRows = await db
      .select({
        id: contacts.id,
        shareEnabled: contacts.shareEnabled,
        shareToken: contacts.shareToken,
      })
      .from(contacts)
      .where(and(inArray(contacts.id, contactIds), eq(contacts.userId, row.userId)))
    for (const cr of contactRows) {
      contactLookup.set(cr.id, {
        shareEnabled: !!cr.shareEnabled,
        shareToken: cr.shareToken,
      })
    }
  }

  const content = rewriteShareMentionHrefs(row.content, {
    baseUrl,
    mentionLinksAllowed: includeLinks,
    lookup: { files: fileLookup, contacts: contactLookup },
  })

  const linkedContactRows = includeLinks
    ? await db
        .select({
          displayName: contacts.displayName,
          shareEnabled: contacts.shareEnabled,
          shareToken: contacts.shareToken,
        })
        .from(noteContacts)
        .innerJoin(contacts, eq(noteContacts.contactId, contacts.id))
        .where(and(eq(noteContacts.noteId, row.id), eq(contacts.userId, row.userId)))
        .orderBy(asc(contacts.displayName))
    : []

  const linkedFileRows = includeLinks
    ? await db
        .select({
          originalName: files.originalName,
          mimeType: files.mimeType,
          size: files.size,
          shareEnabled: files.shareEnabled,
          shareToken: files.shareToken,
        })
        .from(noteFiles)
        .innerJoin(files, eq(noteFiles.fileId, files.id))
        .where(and(eq(noteFiles.noteId, row.id), eq(files.userId, row.userId)))
        .orderBy(files.updatedAt)
    : []

  const linkedTaskRows = includeLinks
    ? await db
        .select({
          title: tasks.title,
          shareEnabled: tasks.shareEnabled,
          shareToken: tasks.shareToken,
        })
        .from(noteTasks)
        .innerJoin(tasks, eq(noteTasks.taskId, tasks.id))
        .where(and(eq(noteTasks.noteId, row.id), eq(tasks.userId, row.userId)))
        .orderBy(tasks.updatedAt)
    : []

  return {
    id: row.id,
    title: row.title,
    content,
    updatedAt: row.updatedAt,
    linkedContacts: linkedContactRows.map(c => ({
      displayName: c.displayName,
      shareUrl: c.shareEnabled && c.shareToken ? `${baseUrl}/share/contact/${c.shareToken}` : null,
    })),
    linkedFiles: linkedFileRows.map(f => ({
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      shareUrl: f.shareEnabled && f.shareToken ? `${baseUrl}/share/file/${f.shareToken}` : null,
    })),
    linkedTasks: linkedTaskRows.map(t => ({
      title: t.title || 'Untitled',
      shareUrl: t.shareEnabled && t.shareToken ? `${baseUrl}/share/task/${t.shareToken}` : null,
    })),
  }
})
