import { unlink } from 'node:fs/promises'
import { and, eq } from 'drizzle-orm'
import { files } from '../../database/schema'
import { db } from '../../utils/db'
import { resolveStoragePath } from '../../utils/file-storage'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, session.user.id)))

  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  await db.delete(files).where(eq(files.id, id))
  const absPath = resolveStoragePath(row.storagePath)
  await unlink(absPath).catch(() => {})

  setResponseStatus(event, 204)
  return null
})
