import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { and, eq } from 'drizzle-orm'
import { files } from '../../../database/schema'
import { db } from '../../../utils/db'
import { resolveStoragePath } from '../../../utils/file-storage'
import { requireUserSession } from '../../../utils/session'

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

  const absPath = resolveStoragePath(row.storagePath)
  await access(absPath).catch(() => {
    throw createError({ statusCode: 404, statusMessage: 'File missing on disk' })
  })

  setHeader(event, 'Content-Type', row.mimeType || 'application/octet-stream')
  setHeader(event, 'Content-Length', String(row.size))
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
  )

  return sendStream(event, createReadStream(absPath))
})
