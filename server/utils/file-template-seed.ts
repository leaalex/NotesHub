import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type * as schema from '../database/schema'
import { fileFieldTemplates } from '../database/schema'

const DEFAULT_FILE_FIELDS: { label: string, fieldType: string }[] = [
  { label: 'Tags', fieldType: 'text' },
  { label: 'Category', fieldType: 'text' },
]

/**
 * Seeds default file field templates when the user has none.
 */
export async function ensureFileFieldTemplatesSeed(
  db: LibSQLDatabase<typeof schema>,
  userId: string,
): Promise<void> {
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(fileFieldTemplates)
    .where(eq(fileFieldTemplates.userId, userId))

  if (c > 0)
    return

  let position = 0
  await db.insert(fileFieldTemplates).values(
    DEFAULT_FILE_FIELDS.map(r => ({
      id: randomUUID(),
      userId,
      label: r.label,
      fieldType: r.fieldType,
      position: position++,
    })),
  )
}
