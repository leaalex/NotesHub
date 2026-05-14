import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { ContactFieldKind } from '../../../shared/contact-types'
import { fileFieldTemplates, fileFieldValues, files } from '../../database/schema'
import { db } from '../../utils/db'
import { ensureFileFieldTemplatesSeed } from '../../utils/file-template-seed'
import { requireUserSession } from '../../utils/session'

const FIELD_TYPES: ContactFieldKind[] = [
  'text',
  'email',
  'phone',
  'url',
  'date',
  'address',
  'longtext',
]

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  await ensureFileFieldTemplatesSeed(db, session.user.id)

  const body = await readBody<{
    label?: string
    fieldType?: string
    position?: number
  }>(event)

  const label = (body.label ?? '').trim()
  if (!label)
    throw createError({ statusCode: 400, statusMessage: 'Label is required' })

  const ft = (body.fieldType ?? 'text') as ContactFieldKind
  if (!FIELD_TYPES.includes(ft))
    throw createError({ statusCode: 400, statusMessage: 'Invalid field type' })

  let position = body.position ?? 0
  if (body.position === undefined) {
    const [{ maxPos }] = await db
      .select({
        maxPos: sql<number>`coalesce(max(${fileFieldTemplates.position}), -1)`.mapWith(Number),
      })
      .from(fileFieldTemplates)
      .where(eq(fileFieldTemplates.userId, session.user.id))

    position = maxPos + 1
  }

  const tplId = randomUUID()
  await db.insert(fileFieldTemplates).values({
    id: tplId,
    userId: session.user.id,
    label,
    fieldType: ft,
    position,
  })

  const userFiles = await db
    .select({ id: files.id })
    .from(files)
    .where(eq(files.userId, session.user.id))

  if (userFiles.length > 0) {
    await db.insert(fileFieldValues).values(
      userFiles.map(row => ({
        id: randomUUID(),
        fileId: row.id,
        templateId: tplId,
        label,
        fieldType: ft,
        value: '',
        position,
      })),
    )
  }

  const [row] = await db
    .select()
    .from(fileFieldTemplates)
    .where(eq(fileFieldTemplates.id, tplId))

  return row
})
