import { and, eq } from 'drizzle-orm'
import { addresses, folders } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    label?: string
    line1?: string
    line2?: string
    city?: string
    region?: string
    postalCode?: string
    countryCode?: string
    folderId?: string | null
  }>(event)

  const [existing] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.userId, session.user.id)))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  if (body.folderId !== undefined && body.folderId !== null) {
    const [f] = await db.select().from(folders).where(eq(folders.id, body.folderId))
    if (!f || f.userId !== session.user.id)
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder' })
  }

  const now = new Date()
  await db
    .update(addresses)
    .set({
      ...(body.label !== undefined ? { label: body.label.trim() } : {}),
      ...(body.line1 !== undefined ? { line1: body.line1.trim() } : {}),
      ...(body.line2 !== undefined ? { line2: body.line2.trim() } : {}),
      ...(body.city !== undefined ? { city: body.city.trim() } : {}),
      ...(body.region !== undefined ? { region: body.region.trim() } : {}),
      ...(body.postalCode !== undefined ? { postalCode: body.postalCode.trim() } : {}),
      ...(body.countryCode !== undefined ? { countryCode: body.countryCode.trim().toLowerCase() } : {}),
      ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
      updatedAt: now,
    })
    .where(eq(addresses.id, id))

  const [row] = await db.select().from(addresses).where(eq(addresses.id, id))
  return row
})
