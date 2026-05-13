import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

const DATA_ROOT = resolve(process.cwd(), 'data')
const UPLOADS_ROOT = resolve(DATA_ROOT, 'uploads')

function sanitizeExt(inputName: string): string {
  const ext = extname(inputName || '').toLowerCase()
  return /^[a-z0-9.]{0,16}$/.test(ext) ? ext : ''
}

export function makeStoragePath(originalName: string): string {
  return `uploads/${randomUUID()}${sanitizeExt(originalName)}`
}

export function resolveStoragePath(storagePath: string): string {
  const abs = resolve(DATA_ROOT, storagePath)
  if (!abs.startsWith(DATA_ROOT))
    throw createError({ statusCode: 400, statusMessage: 'Invalid storage path' })
  return abs
}

export async function ensureUploadsDir() {
  await mkdir(UPLOADS_ROOT, { recursive: true })
}
