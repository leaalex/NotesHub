export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== '/library')
    return

  const tabRaw = to.query.tab
  const tabStr = typeof tabRaw === 'string' ? tabRaw : Array.isArray(tabRaw) ? tabRaw[0] : ''

  const addressNewRaw = to.query.addressNew
  const addressNew = Array.isArray(addressNewRaw) ? addressNewRaw[0] : addressNewRaw
  if (addressNew === '1' || addressNew === 1)
    return navigateTo({ path: '/library/addresses', query: {} }, { replace: true })

  const idRaw = to.query.addressId
  const idStr = typeof idRaw === 'string' ? idRaw : Array.isArray(idRaw) ? idRaw[0] : ''
  if (typeof idStr === 'string' && idStr.length)
    return navigateTo({ path: '/library/addresses', query: {} }, { replace: true })

  if (typeof tabStr === 'string' && tabStr.length) {
    const map: Record<string, string> = {
      addresses: '/library/addresses',
      'contact-fields': '/library/contact-fields',
      'task-fields': '/library/task-fields',
      'file-fields': '/library/file-fields',
    }
    const target = map[tabStr]
    if (target)
      return navigateTo({ path: target, query: {} }, { replace: true })
  }
})
