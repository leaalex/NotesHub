export default defineNuxtRouteMiddleware(async (to) => {
  if (
    to.path.startsWith('/login')
    || to.path.startsWith('/share')
  ) return

  if (to.path.startsWith('/cms') || to.path.startsWith('/staff')) return

  const { getSession } = useNotesAuth()
  const res = await getSession()
  if (!res?.data?.user) {
    return navigateTo('/login')
  }
})
