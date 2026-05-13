export type NewFolderModalFolderRow = {
  id: string
  name: string
  parentId: string | null
  position: number
}

function apiErrorMessage(e: unknown): string {
  if (!e || typeof e !== 'object')
    return 'Request failed'
  const err = e as {
    statusMessage?: string
    message?: string
    data?: { message?: string, statusMessage?: string }
  }
  return err.data?.message
    ?? err.data?.statusMessage
    ?? err.statusMessage
    ?? err.message
    ?? 'Request failed'
}

function sortFolderRows(rows: NewFolderModalFolderRow[]) {
  return [...rows].sort((a, b) =>
    a.position !== b.position ? a.position - b.position : a.name.localeCompare(b.name))
}

export function useNewFolderModal(folders: Ref<NewFolderModalFolderRow[]>) {
  const apiFetch = useRequestFetch()
  const toast = useToast()

  const newFolderName = ref('')
  const showNewFolder = ref(false)
  const creatingFolder = ref(false)

  async function createFolder() {
    const name = newFolderName.value.trim()
    if (!name)
      return
    creatingFolder.value = true
    try {
      const row = await apiFetch<NewFolderModalFolderRow>('/api/folders', {
        method: 'POST',
        body: { name },
      })
      folders.value = sortFolderRows([...folders.value, row])
      newFolderName.value = ''
      showNewFolder.value = false
    }
    catch (e: unknown) {
      toast.add({
        title: 'Could not create folder',
        description: apiErrorMessage(e),
        color: 'error',
      })
      console.error(e)
    }
    finally {
      creatingFolder.value = false
    }
  }

  return {
    newFolderName,
    showNewFolder,
    creatingFolder,
    createFolder,
  }
}
