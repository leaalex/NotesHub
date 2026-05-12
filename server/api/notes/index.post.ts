import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { EMPTY_TIPTAP_DOC_JSON } from '../../../shared/tiptap-empty-doc'
import { folders, notes } from '../../database/schema'
import { db } from '../../utils/db'
import { withDbTimeout } from '../../utils/db-timeout'
import { requireUserSession } from '../../utils/session'

const DB_STEP_MS = 15_000

export default defineEventHandler(async (event) => {
  const dev = process.env.NODE_ENV !== 'production'
  const log = (...args: unknown[]) => {
    if (dev)
      console.info('[api/notes:create]', ...args)
  }

  log('start')

  const session = await requireUserSession(event)
  log('after session', session.user.id)

  log('before readBody')
  const body = await withDbTimeout(
    'notes:create:readBody',
    readBody<{ title?: string, folderId?: string | null }>(event),
    10_000,
  )
  log('after body', { title: body?.title, folderId: body.folderId })

  if (body.folderId) {
    log('before folder check', body.folderId)
    const rows = await withDbTimeout(
      'notes:create:folderLookup',
      db
        .select()
        .from(folders)
        .where(eq(folders.id, body.folderId)),
      DB_STEP_MS,
    )
    const [f] = rows
    log('after folder check', Boolean(f))
    if (!f || f.userId !== session.user.id) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder' })
    }
  }

  const id = randomUUID()
  const now = Date.now()
  const title = body.title?.trim() || 'New note'

  log('before insert', id)
  await withDbTimeout(
    'notes:create:insert',
    db.insert(notes).values({
      id,
      userId: session.user.id,
      folderId: body.folderId ?? null,
      title,
      content: EMPTY_TIPTAP_DOC_JSON,
      excerpt: '',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    }),
    DB_STEP_MS,
  )
  log('after insert', id)

  log('before select', id)
  const rows = await withDbTimeout(
    'notes:create:select',
    db.select().from(notes).where(eq(notes.id, id)),
    DB_STEP_MS,
  )
  const [row] = rows
  log('after select', row?.id)

  return row
})
