import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { and, eq } from 'drizzle-orm'
import { files, folders } from '../../database/schema'
import { db } from '../../utils/db'
import { toFileDto } from '../../utils/file-dto'
import { ensureUploadsDir, makeStoragePath, resolveStoragePath } from '../../utils/file-storage'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
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
      mimeType: filePart.type || 'application/octet-stream',
      size: filePart.data.byteLength,
      storagePath,
      updatedAt: now,
      createdAt: now,
    })
    .returning()

  const config = useRuntimeConfig()
  return toFileDto(inserted, config.public.siteUrl as string)
})
