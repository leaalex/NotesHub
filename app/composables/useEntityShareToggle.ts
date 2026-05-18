import { ref } from 'vue'

export type EntityShareKind = 'note' | 'contact' | 'file' | 'task'

const RESOURCE: Record<EntityShareKind, string> = {
  note: 'notes',
  contact: 'contacts',
  file: 'files',
  task: 'tasks',
}

export function useEntityShareToggle() {
  const apiFetch = useRequestFetch()
  const toast = useToast()
  const pendingKeys = ref<string[]>([])

  function busyKey(kind: EntityShareKind, id: string) {
    return `${kind}:${id}`
  }

  function isBusy(kind: EntityShareKind, id: string) {
    return pendingKeys.value.includes(busyKey(kind, id))
  }

  async function toggleShare(
    kind: EntityShareKind,
    id: string,
    nextEnabled: boolean,
  ): Promise<{ shareEnabled: boolean, shareToken: string | null, shareUrl: string | null }> {
    const key = busyKey(kind, id)
    pendingKeys.value = [...pendingKeys.value, key]
    try {
      if (nextEnabled) {
        const r = await apiFetch<{ url: string, shareToken: string }>(
          `/api/${RESOURCE[kind]}/${id}/share`,
          { method: 'POST', body: {} },
        )
        return {
          shareEnabled: true,
          shareToken: r.shareToken,
          shareUrl: r.url,
        }
      }
      await apiFetch(`/api/${RESOURCE[kind]}/${id}/share`, { method: 'DELETE' })
      return {
        shareEnabled: false,
        shareToken: null,
        shareUrl: null,
      }
    }
    catch (e: unknown) {
      console.error(e)
      toast.add({ title: 'Could not update share', color: 'error' })
      throw e
    }
    finally {
      pendingKeys.value = pendingKeys.value.filter(k => k !== key)
    }
  }

  return { isBusy, toggleShare }
}
