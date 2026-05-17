import { asc, eq } from 'drizzle-orm'
import { taskFieldTemplates } from '../../database/schema'
import { db } from '../../utils/db'
import { ensureTaskFieldTemplatesSeed } from '../../utils/task-template-seed'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  await ensureTaskFieldTemplatesSeed(db, session.user.id)

  const rows = await db
    .select()
    .from(taskFieldTemplates)
    .where(eq(taskFieldTemplates.userId, session.user.id))
    .orderBy(asc(taskFieldTemplates.position), asc(taskFieldTemplates.id))

  return rows
})
