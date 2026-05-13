import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { contacts } from '../../../database/schema'
import { db } from '../../../utils/db'
import { requireUserSession } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{ expiresAt?: number | null }>(event).catch(() => ({}))

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, session.user.id)))

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const config = useRuntimeConfig()
  const base = (config.public.siteUrl as string).replace(/\/$/, '')

  if (existing.shareEnabled && existing.shareToken) {
    return {
      shareToken: existing.shareToken,
      url: `${base}/share/contact/${existing.shareToken}`,
    }
  }

  const token = randomBytes(24).toString('base64url')
  await db
    .update(contacts)
    .set({
      shareToken: token,
      shareEnabled: true,
      shareExpiresAt: body.expiresAt != null ? new Date(body.expiresAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id))

  return { shareToken: token, url: `${base}/share/contact/${token}` }
})
