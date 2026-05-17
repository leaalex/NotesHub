import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { addresses, folders } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody<{
    label?: string
    line1?: string
    line2?: string
    city?: string
    region?: string
    postalCode?: string
    countryCode?: string
    folderId?: string | null
  }>(event).catch(() => ({}))

  if (body.folderId) {
    const [f] = await db.select().from(folders).where(eq(folders.id, body.folderId))
    if (!f || f.userId !== session.user.id)
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder' })
  }

  const id = randomUUID()
  const now = Date.now()

  await db.insert(addresses).values({
    id,
    userId: session.user.id,
    folderId: body.folderId === undefined ? null : body.folderId,
    label: (body.label ?? '').trim(),
    line1: (body.line1 ?? '').trim(),
    line2: (body.line2 ?? '').trim(),
    city: (body.city ?? '').trim(),
    region: (body.region ?? '').trim(),
    postalCode: (body.postalCode ?? '').trim(),
    countryCode: (body.countryCode ?? '').trim().toLowerCase(),
    lat: null,
    lng: null,
    provider: 'manual',
    providerId: null,
    rawJson: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  })

  const [row] = await db.select().from(addresses).where(eq(addresses.id, id))
  return row
})
