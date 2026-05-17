import { FIELD_TYPE_OPTIONS } from '#shared/field-template-options'

export type LibrarySimpleTplRow = {
  id: string
  label: string
  fieldType: string
  position: number
}

export function useLibraryTaskFieldTemplates() {
  const toast = useToast()
  const apiFetch = useRequestFetch()

  const rows = useState<LibrarySimpleTplRow[]>('library:taskTpl:rows', () => [])
  const loading = useState<boolean>('library:taskTpl:loading', () => true)

  async function reload() {
    loading.value = true
    try {
      rows.value = await apiFetch<LibrarySimpleTplRow[]>('/api/task-field-templates')
    }
    catch (e) {
      console.error(e)
      toast.add({ title: 'Could not load task templates', color: 'error' })
    }
    finally {
      loading.value = false
    }
  }

  function sorted(list: LibrarySimpleTplRow[]) {
    return [...list].sort((a, b) =>
      a.position !== b.position ? a.position - b.position : a.label.localeCompare(b.label),
    )
  }

  async function addTemplate(label: string): Promise<string | null> {
    try {
      const row = await apiFetch<LibrarySimpleTplRow>('/api/task-field-templates', {
        method: 'POST',
        body: { label, fieldType: 'text' },
      })
      await reload()
      return row?.id ?? null
    }
    catch (e: unknown) {
      console.error(e)
      let msg = 'Could not create template'
      if (e && typeof e === 'object') {
        const err = e as {
          statusMessage?: string
          message?: string
          data?: { message?: string, statusMessage?: string }
        }
        msg = err.data?.statusMessage
          ?? err.data?.message
          ?? err.statusMessage
          ?? err.message
          ?? msg
      }
      toast.add({ title: msg, color: 'error' })
      return null
    }
  }

  async function patchRemote(
    row: LibrarySimpleTplRow,
    patch: Partial<Pick<LibrarySimpleTplRow, 'label' | 'fieldType' | 'position'>>,
  ) {
    await apiFetch(`/api/task-field-templates/${row.id}`, { method: 'PATCH', body: patch })
  }

  async function patchRow(
    row: LibrarySimpleTplRow,
    patch: Partial<Pick<LibrarySimpleTplRow, 'label' | 'fieldType' | 'position'>>,
  ) {
    await patchRemote(row, patch)
    await reload()
  }

  async function moveTpl(row: LibrarySimpleTplRow, delta: number) {
    const list = sorted(rows.value)
    const ix = list.findIndex(t => t.id === row.id)
    const nx = ix + delta
    if (ix < 0 || nx < 0 || nx >= list.length)
      return
    const a = list[ix]!
    const b = list[nx]!
    await patchRemote(a, { position: b.position })
    await patchRemote(b, { position: a.position })
    await reload()
  }

  async function removeTpl(id: string) {
    await apiFetch(`/api/task-field-templates/${id}`, { method: 'DELETE' })
    await reload()
  }

  return {
    fieldTypeOptions: FIELD_TYPE_OPTIONS,
    rows,
    loading,
    reload,
    sorted,
    addTemplate,
    patchRow,
    moveTpl,
    removeTpl,
  }
}
