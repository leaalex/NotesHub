import { and, eq } from 'drizzle-orm'
import { folders, notes } from '../../database/schema'
import { db } from '../../utils/db'
import { reconcileNoteContactMentions } from '../../utils/note-contact-mentions'
import { requireUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody<{
    title?: string
    content?: string
    excerpt?: string
    folderId?: string | null
  }>(event)

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  if (body.folderId !== undefined && body.folderId !== null) {
    const [f] = await db
      .select()
      .from(folders)
      .where(eq(folders.id, body.folderId))
    if (!f || f.userId !== session.user.id) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder' })
    }
  }

  await db
    .update(notes)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.excerpt !== undefined ? { excerpt: body.excerpt } : {}),
      ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(notes.id, id))

  if (body.content !== undefined) {
    await reconcileNoteContactMentions(id, session.user.id, body.content)
  }

  const [row] = await db.select().from(notes).where(eq(notes.id, id))
  return row
})
