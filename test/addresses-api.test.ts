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

describe('addresses schema', () => {
  let dir: string | undefined

  afterEach(() => {
    if (dir)
      rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('stores addresses and contact_addresses with unique (contact, address)', async () => {
    dir = mkdtempSync(join(tmpdir(), 'notes-addr-'))
    const dbPath = join(dir, 'test.sqlite')
    const url = `file:${dbPath}`
    const client = createClient({ url })
    const db = drizzle(client, { schema })
    await migrate(db, { migrationsFolder })

    const userId = await seedUser(db)
    const now = new Date()

    const contactId = randomUUID()
    await db.insert(schema.contacts).values({
      id: contactId,
      userId,
      type: 'person',
      firstName: 'Ada',
      lastName: 'Lovelace',
      orgName: '',
      displayName: 'Ada Lovelace',
      note: '',
      createdAt: now,
      updatedAt: now,
    })

    const addrId = randomUUID()
    await db.insert(schema.addresses).values({
      id: addrId,
      userId,
      folderId: null,
      label: 'HQ',
      line1: '1 Test St',
      line2: '',
      city: 'Moscow',
      region: '',
      postalCode: '101000',
      countryCode: 'ru',
      lat: null,
      lng: null,
      provider: 'manual',
      providerId: null,
      rawJson: null,
      createdAt: now,
      updatedAt: now,
    })

    const linkId = randomUUID()
    await db.insert(schema.contactAddresses).values({
      id: linkId,
      contactId,
      addressId: addrId,
      role: 'shipping',
      isPrimary: true,
      createdAt: now,
    })

    const [link] = await db.select().from(schema.contactAddresses).where(eq(schema.contactAddresses.id, linkId))
    expect(link).toMatchObject({
      contactId,
      addressId: addrId,
      role: 'shipping',
      isPrimary: true,
    })

    await expect(
      db.insert(schema.contactAddresses).values({
        id: randomUUID(),
        contactId,
        addressId: addrId,
        role: 'other',
        isPrimary: false,
        createdAt: now,
      }),
    ).rejects.toThrow()

    await db.insert(schema.addresses).values({
      id: randomUUID(),
      userId,
      folderId: null,
      label: 'Dup',
      line1: '',
      line2: '',
      city: '',
      region: '',
      postalCode: '',
      countryCode: 'ru',
      lat: null,
      lng: null,
      provider: 'testsrc',
      providerId: 'same-external-id',
      rawJson: null,
      createdAt: now,
      updatedAt: now,
    })

    await expect(
      db.insert(schema.addresses).values({
        id: randomUUID(),
        userId,
        folderId: null,
        label: 'Dup2',
        line1: '',
        line2: '',
        city: '',
        region: '',
        postalCode: '',
        countryCode: 'ru',
        lat: null,
        lng: null,
        provider: 'testsrc',
        providerId: 'same-external-id',
        rawJson: null,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow()
  })
})
