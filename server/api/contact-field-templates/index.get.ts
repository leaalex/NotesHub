import { and, asc, eq } from 'drizzle-orm'
import type { ContactKind } from '../../../shared/contact-types'
import { contactFieldTemplates } from '../../database/schema'
import { db } from '../../utils/db'
import { ensureContactFieldTemplatesSeed } from '../../utils/contact-template-seed'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  await ensureContactFieldTemplatesSeed(db, session.user.id)

  const query = getQuery(event)
  const type = typeof query.type === 'string' ? query.type : undefined

  if (type !== 'person' && type !== 'organization') {
    const rows = await db
      .select()
      .from(contactFieldTemplates)
      .where(eq(contactFieldTemplates.userId, session.user.id))
      .orderBy(asc(contactFieldTemplates.contactType), asc(contactFieldTemplates.position))

    return rows
  }

  const rows = await db
    .select()
    .from(contactFieldTemplates)
    .where(and(
      eq(contactFieldTemplates.userId, session.user.id),
      eq(contactFieldTemplates.contactType, type as ContactKind),
    ))
    .orderBy(asc(contactFieldTemplates.position))

  return rows
})
