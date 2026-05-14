import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { and, asc, eq } from 'drizzle-orm'
import {
  fileFieldTemplates,
  fileFieldValues,
  files,
  folders,
} from '../../database/schema'
import { db } from '../../utils/db'
import { toFileDto } from '../../utils/file-dto'
import { ensureUploadsDir, makeStoragePath, resolveStoragePath } from '../../utils/file-storage'
import { ensureFileFieldTemplatesSeed } from '../../utils/file-template-seed'
import { requireUserSession } from '../../utils/session'

function parseFieldValuesJson(raw: string | undefined): Record<string, string> {
  if (!raw?.trim())
    return {}
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object')
      return {}
    const out: Record<string, string> = {}
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'string')
        out[k] = val
      else if (val != null)
        out[k] = String(val)
    }
    return out
  }
  catch {
    return {}
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  await ensureFileFieldTemplatesSeed(db, session.user.id)

  const form = await readMultipartFormData(event)

  if (!form?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Expected multipart form data' })
  }

  const filePart = form.find(part => part.filename && part.data)
  if (!filePart?.filename || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'File is required' })
  }

  const folderPart = form.find(part => part.name === 'folderId')
  const folderId = folderPart?.data?.toString('utf-8')?.trim() || null

  const titleRaw = form.find(part => part.name === 'title')?.data?.toString('utf-8')?.trim()
    ?? ''
  const descriptionRaw = form.find(part => part.name === 'description')?.data?.toString('utf-8')?.trim()
    ?? ''
  const fieldValuesRaw = form.find(part => part.name === 'fieldValues')?.data?.toString('utf-8')
  const overrides = parseFieldValuesJson(fieldValuesRaw)

  const title = titleRaw.length ? titleRaw : filePart.filename

  if (folderId) {
    const [folder] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, session.user.id)))
    if (!folder) {
      throw createError({ statusCode: 400, statusMessage: 'Folder not found' })
    }
  }

  await ensureUploadsDir()
  const storagePath = makeStoragePath(filePart.filename)
  const absPath = resolveStoragePath(storagePath)
  await writeFile(absPath, filePart.data)

  const now = new Date()
  const id = randomUUID()
  const [inserted] = await db
    .insert(files)
    .values({
      id,
      userId: session.user.id,
      folderId,
      originalName: filePart.filename,
      title,
      description: descriptionRaw,
      mimeType: filePart.type || 'application/octet-stream',
      size: filePart.data.byteLength,
      storagePath,
      updatedAt: now,
      createdAt: now,
    })
    .returning()

  const templates = await db
    .select()
    .from(fileFieldTemplates)
    .where(eq(fileFieldTemplates.userId, session.user.id))
    .orderBy(asc(fileFieldTemplates.position), asc(fileFieldTemplates.id))

  if (templates.length > 0) {
    await db.insert(fileFieldValues).values(
      templates.map(t => ({
        id: randomUUID(),
        fileId: id,
        templateId: t.id,
        label: t.label,
        fieldType: t.fieldType,
        value: overrides[t.id] ?? '',
        position: t.position,
      })),
    )
  }

  const config = useRuntimeConfig()
  return toFileDto(inserted, config.public.siteUrl as string)
})
