import { and, eq } from 'drizzle-orm'
import type { ContactFieldKind } from '../../../../../shared/contact-types'
import { fileFieldValues, files } from '../../../../database/schema'
import { db } from '../../../../utils/db'
import { requireUserSession } from '../../../../utils/session'

const FIELD_TYPES: ContactFieldKind[] = [
  'text',
  'email',
  'phone',
  'url',
  'date',
  'longtext',
]

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const fid = getRouterParam(event, 'id')
  const fieldId = getRouterParam(event, 'fieldId')
  if (!fid || !fieldId)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    label?: string
    fieldType?: string
    value?: string
    position?: number
  }>(event)

  const [fileRow] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, fid), eq(files.userId, session.user.id)))

  if (!fileRow)
    throw createError({ statusCode: 404, statusMessage: 'File not found' })

  const [existing] = await db
    .select()
    .from(fileFieldValues)
    .where(and(eq(fileFieldValues.id, fieldId), eq(fileFieldValues.fileId, fid)))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Field not found' })

  if (body.fieldType !== undefined) {
    const ft = body.fieldType as ContactFieldKind
    if (!FIELD_TYPES.includes(ft))
      throw createError({ statusCode: 400, statusMessage: 'Invalid field type' })
  }

  await db
    .update(fileFieldValues)
    .set({
      ...(body.label !== undefined ? { label: body.label.trim() } : {}),
      ...(body.fieldType !== undefined ? { fieldType: body.fieldType } : {}),
      ...(body.value !== undefined ? { value: body.value } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
    })
    .where(eq(fileFieldValues.id, fieldId))

  await db
    .update(files)
    .set({ updatedAt: new Date() })
    .where(eq(files.id, fid))

  const [row] = await db
    .select()
    .from(fileFieldValues)
    .where(eq(fileFieldValues.id, fieldId))

  return row
})
