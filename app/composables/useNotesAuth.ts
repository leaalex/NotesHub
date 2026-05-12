import { createAuthClient } from 'better-auth/vue'
import { adminClient } from 'better-auth/client/plugins'

let browserClient: ReturnType<typeof createAuthClient> | null = null
let browserClientOrigin: string | null = null

function fallbackSiteUrl(): string {
  return useRuntimeConfig().public.siteUrl as string
}

/**
 * Origin вкладки / входящего запроса — не фиксированный NUXT_PUBLIC_SITE_URL.
 * Иначе при открытии через 127.0.0.1 или LAN-IP Docker клиент Better Auth ходит на другой host,
 * сессия и cookie расходятся с `/api/*`.
 */
function resolveAuthOrigin(): string {
  if (import.meta.server) {
    try {
      return useRequestURL().origin
    }
    catch {
      return fallbackSiteUrl()
    }
  }
  if (typeof window !== 'undefined')
    return window.location.origin
  return fallbackSiteUrl()
}

export function useNotesAuth() {
  if (import.meta.server) {
    const headers = useRequestHeaders(['cookie'])
    return createAuthClient({
      baseURL: resolveAuthOrigin(),
      basePath: '/api/auth',
      fetchOptions: {
        headers,
      },
      plugins: [adminClient()],
    })
  }

  const origin = resolveAuthOrigin()
  if (!browserClient || browserClientOrigin !== origin) {
    browserClient = createAuthClient({
      baseURL: origin,
      basePath: '/api/auth',
      plugins: [adminClient()],
    })
    browserClientOrigin = origin
  }
  return browserClient
}
