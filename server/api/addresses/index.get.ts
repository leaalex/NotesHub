import { and, asc, eq, isNull, like, or } from 'drizzle-orm'
import { addresses } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

function sanitizeLikeTerm(raw: string): string {
  return raw.trim().replace(/[%_]/g, '')
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const query = getQuery(event)
  const folderId = typeof query.folderId === 'string' ? query.folderId : undefined
  const q = typeof query.q === 'string' ? query.q : ''

  const conditions = [eq(addresses.userId, session.user.id)]
  if (folderId === 'unfiled')
    conditions.push(isNull(addresses.folderId))
  else if (folderId && folderId !== 'all')
    conditions.push(eq(addresses.folderId, folderId))

  const term = sanitizeLikeTerm(q)
  if (term.length > 0) {
    const pat = `%${term}%`
    conditions.push(
      or(
        like(addresses.label, pat),
        like(addresses.line1, pat),
        like(addresses.city, pat),
        like(addresses.countryCode, pat),
      )!,
    )
  }

  const rows = await db
    .select({
      id: addresses.id,
      label: addresses.label,
      line1: addresses.line1,
      city: addresses.city,
      countryCode: addresses.countryCode,
      folderId: addresses.folderId,
      updatedAt: addresses.updatedAt,
    })
    .from(addresses)
    .where(and(...conditions))
    .orderBy(asc(addresses.label), asc(addresses.city))

  return rows
})
