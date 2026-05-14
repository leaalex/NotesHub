import { asc, eq } from 'drizzle-orm'
import { fileFieldTemplates } from '../../database/schema'
import { db } from '../../utils/db'
import { ensureFileFieldTemplatesSeed } from '../../utils/file-template-seed'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  await ensureFileFieldTemplatesSeed(db, session.user.id)

  const rows = await db
    .select()
    .from(fileFieldTemplates)
    .where(eq(fileFieldTemplates.userId, session.user.id))
    .orderBy(asc(fileFieldTemplates.position), asc(fileFieldTemplates.id))

  return rows
})
