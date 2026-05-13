import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { files } from '../../../database/schema'
import { db } from '../../../utils/db'
import { requireUserSession } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{ expiresAt?: number | null }>(event).catch(() => ({}))
  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, session.user.id)))

  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const token = randomBytes(24).toString('base64url')
  await db
    .update(files)
    .set({
      shareToken: token,
      shareEnabled: true,
      shareExpiresAt: body.expiresAt != null ? new Date(body.expiresAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(files.id, id))

  const config = useRuntimeConfig()
  const base = (config.public.siteUrl as string).replace(/\/$/, '')
  return { shareToken: token, url: `${base}/share/file/${token}` }
})
