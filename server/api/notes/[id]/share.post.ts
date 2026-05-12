import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { notes } from '../../../database/schema'
import { db } from '../../../utils/db'
import { requireUserSession } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{ expiresAt?: number | null }>(event).catch(() => ({}))

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const token = randomBytes(24).toString('base64url')
  await db
    .update(notes)
    .set({
      shareToken: token,
      shareEnabled: true,
      shareExpiresAt: body.expiresAt != null ? new Date(body.expiresAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, id))

  const config = useRuntimeConfig()
  const base = config.public.siteUrl as string
  const url = `${base.replace(/\/$/, '')}/share/${token}`

  return { shareToken: token, url }
})
