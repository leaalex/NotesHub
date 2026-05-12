import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { folders } from '../../database/schema'
import { db } from '../../utils/db'
import { withDbTimeout } from '../../utils/db-timeout'
import { requireUserSession } from '../../utils/session'

const DB_STEP_MS = 15_000

export default defineEventHandler(async (event) => {
  const dev = process.env.NODE_ENV !== 'production'
  const log = (...args: unknown[]) => {
    if (dev)
      console.info('[api/folders:create]', ...args)
  }

  log('start')

  const session = await requireUserSession(event)
  log('after session', session.user.id)

  log('before readBody')
  const body = await withDbTimeout(
    'folders:create:readBody',
    readBody<{ name: string, parentId?: string | null, position?: number }>(event),
    10_000,
  )
  log('after body', { name: body?.name, parentId: body.parentId })

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name required' })
  }

  if (body.parentId) {
    log('before parent check', body.parentId)
    const parentRows = await withDbTimeout(
      'folders:create:parentLookup',
      db
        .select()
        .from(folders)
        .where(eq(folders.id, body.parentId)),
      DB_STEP_MS,
    )
    const [parent] = parentRows
    log('after parent check', Boolean(parent))
    if (!parent || parent.userId !== session.user.id) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid parent folder' })
    }
  }

  const id = randomUUID()
  const now = Date.now()

  log('before insert', id)
  await withDbTimeout(
    'folders:create:insert',
    db.insert(folders).values({
      id,
      userId: session.user.id,
      parentId: body.parentId ?? null,
      name: body.name.trim(),
      position: body.position ?? 0,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    }),
    DB_STEP_MS,
  )
  log('after insert', id)

  log('before select', id)
  const rowRows = await withDbTimeout(
    'folders:create:select',
    db.select().from(folders).where(eq(folders.id, id)),
    DB_STEP_MS,
  )
  const [row] = rowRows
  log('after select', row?.id)

  return row
})
