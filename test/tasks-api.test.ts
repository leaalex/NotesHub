import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import * as schema from '../server/database/schema'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = resolve(__dirname, '../server/database/migrations')

function seedUser(db: ReturnType<typeof drizzle>) {
  const id = randomUUID()
  const now = new Date()
  return db.insert(schema.user).values({
    id,
    name: 'Test',
    email: `test-${id.slice(0, 8)}@example.com`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  }).then(() => id)
}

describe('tasks schema & relations', () => {
  let dir: string | undefined

  afterEach(() => {
    if (dir)
      rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('migrates tasks and join tables', async () => {
    dir = mkdtempSync(join(tmpdir(), 'notes-tasks-'))
    const dbPath = join(dir, 'test.sqlite')
    const url = `file:${dbPath}`
    const client = createClient({ url })
    const db = drizzle(client, { schema })
    await migrate(db, { migrationsFolder })

    const userId = await seedUser(db)
    const folderId = randomUUID()
    const now = new Date()
    await db.insert(schema.folders).values({
      id: folderId,
      userId,
      name: 'F',
      position: 0,
      createdAt: now,
      updatedAt: now,
    })

    const taskId = randomUUID()
    await db.insert(schema.tasks).values({
      id: taskId,
      userId,
      folderId,
      title: 'Hello',
      description: '',
      status: 'todo',
      priority: 'normal',
      createdAt: now,
      updatedAt: now,
    })

    const noteId = randomUUID()
    await db.insert(schema.notes).values({
      id: noteId,
      userId,
      folderId,
      title: 'N',
      content: '{}',
      excerpt: '',
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(schema.noteTasks).values({ noteId, taskId })

    const [nt] = await db.select().from(schema.noteTasks).where(eq(schema.noteTasks.taskId, taskId))
    expect(nt).toMatchObject({ noteId, taskId })

    const tplId = randomUUID()
    await db.insert(schema.taskFieldTemplates).values({
      id: tplId,
      userId,
      label: 'Tags',
      fieldType: 'text',
      position: 0,
    })
    const fvId = randomUUID()
    await db.insert(schema.taskFieldValues).values({
      id: fvId,
      taskId,
      templateId: tplId,
      label: 'Tags',
      fieldType: 'text',
      value: 'a',
      position: 0,
    })
    const [fv] = await db.select().from(schema.taskFieldValues).where(eq(schema.taskFieldValues.taskId, taskId))
    expect(fv?.value).toBe('a')
  })
})
