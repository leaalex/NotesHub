import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type * as schema from '../database/schema'
import { contactFieldTemplates } from '../database/schema'

const DEFAULT_PERSON: { label: string, fieldType: string }[] = [
  { label: 'Email', fieldType: 'email' },
  { label: 'Phone', fieldType: 'phone' },
  { label: 'Job title', fieldType: 'text' },
  { label: 'Company', fieldType: 'text' },
  { label: 'Address', fieldType: 'address' },
  { label: 'Birthday', fieldType: 'date' },
]

const DEFAULT_ORG: { label: string, fieldType: string }[] = [
  { label: 'Email', fieldType: 'email' },
  { label: 'Phone', fieldType: 'phone' },
  { label: 'Website', fieldType: 'url' },
  { label: 'Address', fieldType: 'address' },
]

/**
 * Seeds default templates when none exist for `(userId, contactType)`.
 */
export async function ensureContactFieldTemplatesSeed(
  db: LibSQLDatabase<typeof schema>,
  userId: string,
): Promise<void> {
  const pairs = [
    ['person', DEFAULT_PERSON],
    ['organization', DEFAULT_ORG],
  ] as const

  for (const [contactType, rows] of pairs) {
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(contactFieldTemplates)
      .where(and(
        eq(contactFieldTemplates.userId, userId),
        eq(contactFieldTemplates.contactType, contactType),
      ))

    if (c > 0)
      continue

    let position = 0
    await db.insert(contactFieldTemplates).values(
      rows.map(r => ({
        id: randomUUID(),
        userId,
        contactType,
        label: r.label,
        fieldType: r.fieldType,
        position: position++,
      })),
    )
  }
}
