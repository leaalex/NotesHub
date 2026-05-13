import { and, eq, inArray } from 'drizzle-orm'
import { extractContactMentionIdsFromTiptapJson } from '../../shared/extract-contact-mentions'
import { contacts, noteContacts } from '../database/schema'
import { db } from './db'

/**
 * Upserts `@contactMention` links for a note. Only touches rows with source `mention`;
 * manual links are preserved. Uses composite PK conflict so existing manual rows remain.
 */
export async function reconcileNoteContactMentions(
  noteId: string,
  userId: string,
  contentJson: string,
): Promise<void> {
  const extracted = extractContactMentionIdsFromTiptapJson(contentJson)
  // Keep stable order while deduping (extractor already dedupes).
  let validIds = extracted
  if (validIds.length > 0) {
    const rows = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.userId, userId), inArray(contacts.id, validIds)))
    const allowed = new Set(rows.map(r => r.id))
    validIds = extracted.filter(id => allowed.has(id))
  }

  await db
    .delete(noteContacts)
    .where(and(eq(noteContacts.noteId, noteId), eq(noteContacts.source, 'mention')))

  if (validIds.length === 0)
    return

  await db
    .insert(noteContacts)
    .values(
      validIds.map(contactId => ({
        noteId,
        contactId,
        source: 'mention',
      })),
    )
    .onConflictDoNothing()
}
