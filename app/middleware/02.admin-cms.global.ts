export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/cms') && !to.path.startsWith('/staff')) return

  const { getSession } = useNotesAuth()
  const res = await getSession()
  const user = res?.data?.user as { role?: string } | undefined
  if (!user || user.role !== 'admin') {
    return navigateTo('/')
  }
})
