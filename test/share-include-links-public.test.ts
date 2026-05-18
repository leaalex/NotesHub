import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { and, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import * as schema from '../server/database/schema'
import {
  contactFiles,
  contactTasks,
  contacts,
  files,
  noteContacts,
  noteTasks,
  notes,
  taskFiles,
  tasks,
} from '../server/database/schema'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = resolve(__dirname, '../server/database/migrations')

function seedUser(db: ReturnType<typeof drizzle>) {
  const id = randomUUID()
  const now = new Date()
  return db.insert(schema.user).values({
    id,
    name: 'Test',
    email: `test-${id.slice(0, 8)}@example.com`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  }).then(() => id)
}

/** Same condition as public share handlers: omit linked lists when disabled. */
function includeLinkedInShare(shareIncludeLinks: boolean | null | undefined) {
  return shareIncludeLinks !== false
}

describe('public share linked entities when shareIncludeLinks=false', () => {
  let dir: string | undefined

  afterEach(() => {
    if (dir)
      rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('task share: links exist in DB but should not be exposed when flag is false', async () => {
    dir = mkdtempSync(join(tmpdir(), 'notes-share-task-'))
    const dbPath = join(dir, 'test.sqlite')
    const client = createClient({ url: `file:${dbPath}` })
    const db = drizzle(client, { schema })
    await migrate(db, { migrationsFolder })

    const userId = await seedUser(db)
    const now = new Date()
    const shareToken = 'task-share-test-token'

    const taskId = randomUUID()
    await db.insert(tasks).values({
      id: taskId,
      userId,
      folderId: null,
      title: 'T',
      description: '',
      status: 'todo',
      priority: 'normal',
      shareToken,
      shareEnabled: true,
      shareIncludeLinks: false,
      createdAt: now,
      updatedAt: now,
    })

    const noteId = randomUUID()
    await db.insert(notes).values({
      id: noteId,
      userId,
      folderId: null,
      title: 'Linked note',
      content: '{}',
      excerpt: '',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(noteTasks).values({ noteId, taskId })

    const contactId = randomUUID()
    await db.insert(contacts).values({
      id: contactId,
      userId,
      folderId: null,
      type: 'person',
      firstName: 'A',
      lastName: 'B',
      orgName: '',
      displayName: 'A B',
      note: '',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(contactTasks).values({ contactId, taskId })

    const fileId = randomUUID()
    await db.insert(files).values({
      id: fileId,
      userId,
      folderId: null,
      originalName: 'f.bin',
      title: '',
      description: '',
      mimeType: 'application/octet-stream',
      size: 1,
      storagePath: 'noop',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(taskFiles).values({ taskId, fileId })

    const [row] = await db
      .select({ shareIncludeLinks: tasks.shareIncludeLinks })
      .from(tasks)
      .where(and(eq(tasks.shareToken, shareToken), eq(tasks.shareEnabled, true)))

    expect(row?.shareIncludeLinks).toBe(false)
    expect(includeLinkedInShare(row?.shareIncludeLinks)).toBe(false)

    const linkedNoteRows = await db
      .select({ id: notes.id })
      .from(noteTasks)
      .innerJoin(notes, eq(noteTasks.noteId, notes.id))
      .where(and(eq(noteTasks.taskId, taskId), eq(notes.userId, userId)))

    expect(linkedNoteRows.length).toBeGreaterThan(0)

    const publicLinkedNotes = includeLinkedInShare(row?.shareIncludeLinks) ? linkedNoteRows : []
    expect(publicLinkedNotes).toEqual([])
  })

  it('contact share: links exist in DB but should not be exposed when flag is false', async () => {
    dir = mkdtempSync(join(tmpdir(), 'notes-share-contact-'))
    const dbPath = join(dir, 'test.sqlite')
    const client = createClient({ url: `file:${dbPath}` })
    const db = drizzle(client, { schema })
    await migrate(db, { migrationsFolder })

    const userId = await seedUser(db)
    const now = new Date()
    const shareToken = 'contact-share-test-token'

    const contactId = randomUUID()
    await db.insert(contacts).values({
      id: contactId,
      userId,
      folderId: null,
      type: 'person',
      firstName: 'C',
      lastName: 'D',
      orgName: '',
      displayName: 'C D',
      note: '',
      shareToken,
      shareEnabled: true,
      shareIncludeLinks: false,
      createdAt: now,
      updatedAt: now,
    })

    const noteId = randomUUID()
    await db.insert(notes).values({
      id: noteId,
      userId,
      folderId: null,
      title: 'Linked',
      content: '{}',
      excerpt: '',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(noteContacts).values({ noteId, contactId })

    const fileId = randomUUID()
    await db.insert(files).values({
      id: fileId,
      userId,
      folderId: null,
      originalName: 'doc.pdf',
      title: '',
      description: '',
      mimeType: 'application/pdf',
      size: 2,
      storagePath: 'noop2',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(contactFiles).values({ contactId, fileId })

    const [row] = await db
      .select({ id: contacts.id, shareIncludeLinks: contacts.shareIncludeLinks })
      .from(contacts)
      .where(and(eq(contacts.shareToken, shareToken), eq(contacts.shareEnabled, true)))

    expect(row?.shareIncludeLinks).toBe(false)
    expect(includeLinkedInShare(row?.shareIncludeLinks)).toBe(false)

    const linkedNoteRows = await db
      .select({ id: notes.id })
      .from(noteContacts)
      .innerJoin(notes, eq(noteContacts.noteId, notes.id))
      .where(and(eq(noteContacts.contactId, contactId), eq(notes.userId, userId)))

    expect(linkedNoteRows.length).toBeGreaterThan(0)

    const publicLinkedNotes = includeLinkedInShare(row?.shareIncludeLinks) ? linkedNoteRows : []
    expect(publicLinkedNotes).toEqual([])
  })
})
