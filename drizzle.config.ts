import { defineConfig } from 'drizzle-kit'
import { resolveDatabaseUrl } from './server/utils/database-url'

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
})
