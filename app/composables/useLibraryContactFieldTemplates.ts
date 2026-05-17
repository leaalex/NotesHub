import { FIELD_TYPE_OPTIONS } from '#shared/field-template-options'

export type LibraryContactTplRow = {
  id: string
  contactType: string
  label: string
  fieldType: string
  position: number
}

export function useLibraryContactFieldTemplates() {
  const toast = useToast()
  const apiFetch = useRequestFetch()

  const personRows = useState<LibraryContactTplRow[]>('library:contactTpl:person', () => [])
  const orgRows = useState<LibraryContactTplRow[]>('library:contactTpl:org', () => [])
  const loading = useState<boolean>('library:contactTpl:loading', () => true)

  async function reload() {
    loading.value = true
    try {
      const [person, org] = await Promise.all([
        apiFetch<LibraryContactTplRow[]>('/api/contact-field-templates', { query: { type: 'person' } }),
        apiFetch<LibraryContactTplRow[]>('/api/contact-field-templates', { query: { type: 'organization' } }),
      ])
      personRows.value = person
      orgRows.value = org
    }
    catch (e) {
      console.error(e)
      toast.add({ title: 'Could not load contact templates', color: 'error' })
    }
    finally {
      loading.value = false
    }
  }

  function sorted(rows: LibraryContactTplRow[]) {
    return [...rows].sort((a, b) =>
      a.position !== b.position ? a.position - b.position : a.label.localeCompare(b.label),
    )
  }

  async function addTemplate(contactType: 'person' | 'organization', label: string): Promise<string | null> {
    try {
      const row = await apiFetch<LibraryContactTplRow>('/api/contact-field-templates', {
        method: 'POST',
        body: { contactType, label, fieldType: 'text' },
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
    row: LibraryContactTplRow,
    patch: Partial<Pick<LibraryContactTplRow, 'label' | 'fieldType' | 'position'>>,
  ) {
    await apiFetch(`/api/contact-field-templates/${row.id}`, { method: 'PATCH', body: patch })
  }

  async function patchRow(
    row: LibraryContactTplRow,
    patch: Partial<Pick<LibraryContactTplRow, 'label' | 'fieldType' | 'position'>>,
  ) {
    await patchRemote(row, patch)
    await reload()
  }

  async function moveTpl(row: LibraryContactTplRow, delta: number, siblings: LibraryContactTplRow[]) {
    const list = sorted(siblings)
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
    await apiFetch(`/api/contact-field-templates/${id}`, { method: 'DELETE' })
    await reload()
  }

  return {
    fieldTypeOptions: FIELD_TYPE_OPTIONS,
    personRows,
    orgRows,
    loading,
    reload,
    sorted,
    addTemplate,
    patchRow,
    moveTpl,
    removeTpl,
  }
}
