import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type * as schema from '../database/schema'
import { taskFieldTemplates } from '../database/schema'

const DEFAULT_TASK_FIELDS: { label: string, fieldType: string }[] = [
  { label: 'Tags', fieldType: 'text' },
  { label: 'Context', fieldType: 'text' },
]

/**
 * Seeds default task field templates when the user has none.
 */
export async function ensureTaskFieldTemplatesSeed(
  db: LibSQLDatabase<typeof schema>,
  userId: string,
): Promise<void> {
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(taskFieldTemplates)
    .where(eq(taskFieldTemplates.userId, userId))

  if (c > 0)
    return

  let position = 0
  await db.insert(taskFieldTemplates).values(
    DEFAULT_TASK_FIELDS.map(r => ({
      id: randomUUID(),
      userId,
      label: r.label,
      fieldType: r.fieldType,
      position: position++,
    })),
  )
}
