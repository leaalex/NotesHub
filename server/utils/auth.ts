import { count, eq } from 'drizzle-orm'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import * as schema from '../database/schema'
import { db } from './db'

function getBaseURL(): string {
  return (
    process.env.BETTER_AUTH_URL
    ?? process.env.NUXT_PUBLIC_SITE_URL
    ?? 'http://localhost:3000'
  )
}

function staticTrustedOriginStrings(): string[] {
  const origins = new Set<string>()
  for (const raw of [getBaseURL(), process.env.NUXT_PUBLIC_SITE_URL]) {
    if (!raw || typeof raw !== 'string') continue
    try {
      origins.add(new URL(raw).origin)
    }
    catch {
      origins.add(raw.replace(/\/$/, ''))
    }
  }
  return [...origins].filter(Boolean)
}

export const auth = betterAuth({
  baseURL: getBaseURL(),
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-only-change-in-production-min-32-chars!!',
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const [row] = await db.select({ n: count() }).from(schema.user)
          if (Number(row?.n) === 1) {
            await db.update(schema.user).set({ role: 'admin' }).where(eq(schema.user.id, user.id))
          }
        },
      },
    },
  },
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
  ],
  trustedOrigins:
    process.env.NODE_ENV === 'production'
      ? staticTrustedOriginStrings()
      : async (request: Request) => {
          const allowed = new Set(staticTrustedOriginStrings())
          try {
            allowed.add(new URL(request.url).origin)
          }
          catch { /* ignore malformed request.url */ }
          return [...allowed]
        },
})
