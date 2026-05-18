export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token)
    throw createError({ statusCode: 400, statusMessage: 'Missing token' })

  const path = `/api/share/file/${encodeURIComponent(token)}/download`
  return sendRedirect(event, path, 308)
})
