export type LibraryFieldTemplatesPage = 'contact' | 'task' | 'file'

export type LibraryFieldTemplateSelection = {
  page: LibraryFieldTemplatesPage | null
  contactSubset: 'person' | 'organization' | null
  selectedId: string | null
}

const initial = (): LibraryFieldTemplateSelection => ({
  page: null,
  contactSubset: null,
  selectedId: null,
})

export function useLibraryFieldTemplateSelection() {
  const route = useRoute()
  const sel = useState<LibraryFieldTemplateSelection>('library:fieldTemplateSelection', initial)

  function detectPage(path: string): LibraryFieldTemplatesPage | null {
    if (path.startsWith('/library/contact-fields'))
      return 'contact'
    if (path.startsWith('/library/task-fields'))
      return 'task'
    if (path.startsWith('/library/file-fields'))
      return 'file'
    return null
  }

  watch(
    () => route.path,
    (path) => {
      const next = detectPage(path)
      if (next !== sel.value.page)
        sel.value = { page: next, contactSubset: null, selectedId: null }
    },
    { immediate: true },
  )

  function selectContact(subset: 'person' | 'organization', id: string) {
    sel.value = { page: 'contact', contactSubset: subset, selectedId: id }
  }

  function selectTask(id: string) {
    sel.value = { page: 'task', contactSubset: null, selectedId: id }
  }

  function selectFile(id: string) {
    sel.value = { page: 'file', contactSubset: null, selectedId: id }
  }

  function clearSelectedId() {
    sel.value = { ...sel.value, selectedId: null }
  }

  function neighborId(sortedIds: string[], current: string | null): string | null {
    if (!current)
      return null
    const ix = sortedIds.indexOf(current)
    if (ix < 0)
      return null
    if (sortedIds[ix + 1])
      return sortedIds[ix + 1]!
    if (ix > 0 && sortedIds[ix - 1])
      return sortedIds[ix - 1]!
    return null
  }

  return {
    sel,
    selectContact,
    selectTask,
    selectFile,
    clearSelectedId,
    neighborId,
  }
}
