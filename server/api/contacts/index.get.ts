import { and, asc, eq, isNull, like } from 'drizzle-orm'
import type { ContactKind } from '../../../shared/contact-types'
import { contacts } from '../../database/schema'
import { db } from '../../utils/db'
import { ensureContactFieldTemplatesSeed } from '../../utils/contact-template-seed'
import { requireUserSession } from '../../utils/session'

function sanitizeLikeTerm(raw: string): string {
  return raw.trim().replace(/[%_]/g, '')
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  await ensureContactFieldTemplatesSeed(db, session.user.id)

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q : ''
  const type = typeof query.type === 'string' ? query.type : undefined
  const folderId = typeof query.folderId === 'string' ? query.folderId : undefined

  const conditions = [eq(contacts.userId, session.user.id)]
  if (type === 'person' || type === 'organization')
    conditions.push(eq(contacts.type, type as ContactKind))
  if (folderId === 'unfiled')
    conditions.push(isNull(contacts.folderId))
  else if (folderId && folderId !== 'all')
    conditions.push(eq(contacts.folderId, folderId))

  const term = sanitizeLikeTerm(q)
  if (term.length > 0)
    conditions.push(like(contacts.displayName, `%${term}%`))

  const rows = await db
    .select({
      id: contacts.id,
      displayName: contacts.displayName,
      type: contacts.type,
      folderId: contacts.folderId,
      updatedAt: contacts.updatedAt,
    })
    .from(contacts)
    .where(and(...conditions))
    .orderBy(asc(contacts.displayName))

  return rows
})
