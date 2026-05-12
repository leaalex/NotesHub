import type { H3Event } from 'h3'
import { getRequestHeaders } from 'h3'
import { auth } from './auth'

function authHeaders(event: H3Event): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(getRequestHeaders(event))) {
    if (Array.isArray(value)) {
      for (const item of value)
        headers.append(name, item)
    }
    else if (value !== undefined) {
      headers.set(name, value)
    }
  }
  return headers
}

export async function requireUserSession(event: H3Event) {
  const session = await auth.api.getSession({
    // Do not call toWebRequest(event) here: it can lock the request body stream before readBody().
    headers: authHeaders(event),
  })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}

export async function requireAdminSession(event: H3Event) {
  const session = await requireUserSession(event)
  const role = (session.user as { role?: string }).role
  if (role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}
