import { and, eq } from 'drizzle-orm'
import { files } from '../../database/schema'
import { db } from '../../utils/db'
import { toFileDto } from '../../utils/file-dto'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    title?: string
    description?: string
  }>(event)

  const [existing] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, session.user.id)))

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const title = body.title !== undefined ? body.title.trim() : existing.title
  const description = body.description !== undefined ? body.description.trim() : existing.description

  await db
    .update(files)
    .set({
      title,
      description,
      updatedAt: new Date(),
    })
    .where(eq(files.id, id))

  const [row] = await db.select().from(files).where(eq(files.id, id))
  const config = useRuntimeConfig()
  return toFileDto(row!, config.public.siteUrl as string)
})
