import { and, eq } from 'drizzle-orm'
import { folders } from '../../database/schema'
import { db } from '../../utils/db'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    name?: string
    parentId?: string | null
    position?: number
  }>(event)

  if (body.parentId !== undefined && body.parentId !== null) {
    const [parent] = await db
      .select()
      .from(folders)
      .where(eq(folders.id, body.parentId))
    if (!parent || parent.userId !== session.user.id) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid parent folder' })
    }
    if (body.parentId === id) {
      throw createError({ statusCode: 400, statusMessage: 'Folder cannot be its own parent' })
    }
  }

  const [existing] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, session.user.id)))

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  await db
    .update(folders)
    .set({
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
      updatedAt: new Date(),
    })
    .where(eq(folders.id, id))

  const [row] = await db.select().from(folders).where(eq(folders.id, id))
  return row
})
