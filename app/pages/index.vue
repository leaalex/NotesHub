<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'

type FolderRow = {
  id: string
  name: string
  parentId: string | null
  position: number
}

type NoteList = {
  id: string
  title: string
  excerpt: string
  folderId: string | null
  updatedAt: string
  shareEnabled?: boolean
}

type NoteDetail = NoteList & {
  content: string
  shareToken: string | null
  shareEnabled: boolean
}

const auth = useNotesAuth()
/** Ref to `{ data, error, isPending, … }` — см. better-auth/vue useSession */
const sessionQuery = auth.useSession()

/** Same-origin fetch с cookie сессии (надёжнее глобального `$fetch` при SSR/клиенте) */
const apiFetch = useRequestFetch()
const toast = useToast()

const folderFilter = ref<'all' | 'unfiled' | string>('all')
const folders = ref<FolderRow[]>([])
const notes = ref<NoteList[]>([])
const selectedNoteId = ref<string | null>(null)
const currentNote = ref<NoteDetail | null>(null)
const title = ref('')
const content = ref('')
const excerpt = ref('')
const shareUrl = ref('')
const newFolderName = ref('')
const showNewFolder = ref(false)
const creatingNote = ref(false)
const creatingFolder = ref(false)

/** Подавляет автосохранение при программной подстановке title/content/excerpt (иначе PATCH/DOM «дергаются» и редактор теряет фокус). */
const hydratingNote = ref(false)

/** Таймаут для цепочки создания в Docker dev — `AbortSignal` в одиночку не всегда рвёт зависший `$fetch` */
const API_TIMEOUT_MS = 45_000

function apiErrorMessage(e: unknown): string {
  if (!e || typeof e !== 'object') return 'Request failed'
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

function notifyApiError(title: string, e: unknown) {
  toast.add({
    title,
    description: apiErrorMessage(e),
    color: 'error',
  })
  console.error(e)
}

/** Принудительный таймаут через Promise.race (не зависит от поддержки abort в браузере/ofetch). */
async function apiRequest<T>(
  url: string,
  opts?: Parameters<typeof apiFetch>[1] & { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? API_TIMEOUT_MS
  const { timeoutMs: _omit, ...fetchOpts } = opts ?? {}
  let timer: ReturnType<typeof setTimeout> | undefined
  const rejectOnTimeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Request timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })
  try {
    return await Promise.race([
      apiFetch<T>(url, fetchOpts),
      rejectOnTimeout,
    ])
  }
  finally {
    if (timer !== undefined)
      clearTimeout(timer)
  }
}

function noteMatchesFolderFilter(n: { folderId: string | null }): boolean {
  if (folderFilter.value === 'all') return true
  if (folderFilter.value === 'unfiled') return n.folderId === null
  return n.folderId === folderFilter.value
}

function toNoteListItem(row: NoteDetail): NoteList {
  const u = row.updatedAt as unknown
  const updatedAt = typeof u === 'string'
    ? u
    : u instanceof Date
      ? u.toISOString()
      : new Date(u as number).toISOString()
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    folderId: row.folderId,
    updatedAt,
    shareEnabled: row.shareEnabled,
  }
}

function upsertNoteInLocalList(row: NoteDetail) {
  if (!noteMatchesFolderFilter(row))
    return
  const item = toNoteListItem(row)
  const i = notes.value.findIndex(x => x.id === item.id)
  if (i >= 0)
    notes.value[i] = item
  else
    notes.value = [item, ...notes.value]
}

function openNoteFromRow(n: NoteDetail) {
  hydratingNote.value = true
  try {
    shareUrl.value = ''
    selectedNoteId.value = n.id
    currentNote.value = n
    title.value = n.title
    content.value = n.content || '{}'
    excerpt.value = n.excerpt || ''
  }
  finally {
    nextTick(() => {
      hydratingNote.value = false
    })
  }
}

async function refreshFolders(opts?: { signal?: AbortSignal }) {
  folders.value = await apiFetch<FolderRow[]>('/api/folders', opts?.signal ? { signal: opts.signal } : {})
}

async function refreshNotes(opts?: { signal?: AbortSignal }) {
  const query: Record<string, string> = {}
  if (folderFilter.value === 'unfiled') query.folderId = 'unfiled'
  else if (folderFilter.value !== 'all') query.folderId = folderFilter.value
  notes.value = await apiFetch<NoteList[]>('/api/notes', {
    query,
    ...(opts?.signal ? { signal: opts.signal } : {}),
  })
}

async function load() {
  await Promise.all([refreshFolders(), refreshNotes()])
}

onMounted(load)

watch(folderFilter, async () => {
  selectedNoteId.value = null
  currentNote.value = null
  await refreshNotes()
})

async function selectNote(id: string, opts?: { signal?: AbortSignal }) {
  shareUrl.value = ''
  hydratingNote.value = true
  try {
    /** Сначала загружаем заметку: иначе `selectedNoteId` меняется раньше данных, редактор перемонтируется со старым `content` и PATCH затрёт новую запись чужим JSON. */
    const n = await apiFetch<NoteDetail>(`/api/notes/${id}`, opts?.signal ? { signal: opts.signal } : {})
    selectedNoteId.value = id
    currentNote.value = n
    title.value = n.title
    content.value = n.content || '{}'
    excerpt.value = n.excerpt || ''
  }
  finally {
    await nextTick()
    hydratingNote.value = false
  }
}

async function createNote() {
  creatingNote.value = true
  try {
    const body: { title: string, folderId?: string | null } = { title: 'New note' }
    if (folderFilter.value === 'unfiled') body.folderId = null
    else if (folderFilter.value !== 'all') body.folderId = folderFilter.value
    const row = await apiRequest<NoteDetail>('/api/notes', { method: 'POST', body })
    if (!row?.id) {
      throw new Error('Server returned no note id')
    }
    upsertNoteInLocalList(row)
    openNoteFromRow(row)
  }
  catch (e: unknown) {
    notifyApiError('Could not create note', e)
  }
  finally {
    creatingNote.value = false
  }
}

watchDebounced(
  [title, content, excerpt],
  async () => {
    const id = selectedNoteId.value
    if (!id || hydratingNote.value)
      return
    try {
      const row = await apiFetch<NoteDetail>(`/api/notes/${id}`, {
        method: 'PATCH',
        body: {
          title: title.value,
          content: content.value,
          excerpt: excerpt.value,
        },
      })
      upsertNoteInLocalList(row)
      if (currentNote.value?.id === row.id)
        currentNote.value = { ...currentNote.value, ...row }
    }
    catch (e: unknown) {
      notifyApiError('Could not save note', e)
    }
  },
  { debounce: 650 },
)

function onEditorUpdate(json: string) {
  content.value = json
}

function onExcerptUpdate(text: string) {
  excerpt.value = text
}

async function createFolder() {
  const name = newFolderName.value.trim()
  if (!name) return
  creatingFolder.value = true
  try {
    const row = await apiRequest<FolderRow>('/api/folders', {
      method: 'POST',
      body: { name },
    })
    folders.value = [...folders.value, row].sort((a, b) =>
      a.position !== b.position ? a.position - b.position : a.name.localeCompare(b.name))
    newFolderName.value = ''
    showNewFolder.value = false
  }
  catch (e: unknown) {
    notifyApiError('Could not create folder', e)
  }
  finally {
    creatingFolder.value = false
  }
}

async function deleteNote() {
  if (!selectedNoteId.value) return
  await apiFetch(`/api/notes/${selectedNoteId.value}`, { method: 'DELETE' })
  selectedNoteId.value = null
  currentNote.value = null
  await refreshNotes()
}

async function signOut() {
  await auth.signOut()
  await navigateTo('/login')
}

async function enableShareLink() {
  if (!selectedNoteId.value) return
  const r = await apiFetch<{ url: string }>(`/api/notes/${selectedNoteId.value}/share`, { method: 'POST', body: {} })
  shareUrl.value = r.url
  await refreshNotes()
  if (currentNote.value) currentNote.value.shareEnabled = true
}

async function disableShareLink() {
  if (!selectedNoteId.value) return
  await apiFetch(`/api/notes/${selectedNoteId.value}/share`, { method: 'DELETE' })
  shareUrl.value = ''
  if (currentNote.value) currentNote.value.shareEnabled = false
  await refreshNotes()
}

const adminLink = computed(() => {
  const u = sessionQuery.value?.data?.user as { role?: string } | undefined
  return u?.role === 'admin'
})
</script>

<template>
  <div class="flex h-dvh overflow-hidden">
    <aside class="flex w-56 shrink-0 flex-col border-r border-zinc-200/80 bg-white/70">
      <div class="border-b border-zinc-200/80 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Folders</span>
          <UButton size="xs" variant="ghost" icon="i-lucide-folder-plus" @click="showNewFolder = true" />
        </div>
        <nav class="mt-2 space-y-0.5 text-sm">
          <button
            type="button"
            class="flex w-full items-center rounded-md px-2 py-1.5 text-left hover:bg-zinc-100"
            :class="folderFilter === 'all' ? 'bg-amber-100/80 text-amber-950' : 'text-zinc-700'"
            @click="folderFilter = 'all'"
          >
            <span class="i-lucide-inbox mr-2 size-4 opacity-70" />
            All notes
          </button>
          <button
            type="button"
            class="flex w-full items-center rounded-md px-2 py-1.5 text-left hover:bg-zinc-100"
            :class="folderFilter === 'unfiled' ? 'bg-amber-100/80 text-amber-950' : 'text-zinc-700'"
            @click="folderFilter = 'unfiled'"
          >
            <span class="i-lucide-file-question mr-2 size-4 opacity-70" />
            Unfiled
          </button>
          <button
            v-for="f in folders"
            :key="f.id"
            type="button"
            class="flex w-full items-center rounded-md px-2 py-1.5 text-left hover:bg-zinc-100"
            :class="folderFilter === f.id ? 'bg-amber-100/80 text-amber-950' : 'text-zinc-700'"
            @click="folderFilter = f.id"
          >
            <span class="i-lucide-folder mr-2 size-4 opacity-70" />
            <span class="truncate">{{ f.name }}</span>
          </button>
        </nav>
      </div>
      <div class="mt-auto border-t border-zinc-200/80 p-2 text-xs text-zinc-500">
        <div v-if="sessionQuery?.data?.user" class="truncate font-medium text-zinc-700">
          {{ sessionQuery.data.user.name || sessionQuery.data.user.email }}
        </div>
        <div class="mt-2 flex flex-col gap-1">
          <UButton
            v-if="adminLink"
            to="/staff"
            size="xs"
            variant="soft"
            block
          >
            Admin
          </UButton>
          <UButton size="xs" variant="ghost" color="neutral" block @click="signOut">
            Sign out
          </UButton>
        </div>
      </div>
    </aside>

    <section class="flex w-72 shrink-0 flex-col border-r border-zinc-200/80 bg-white/50">
      <div class="flex items-center justify-between gap-2 border-b border-zinc-200/80 p-3">
        <span class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Notes</span>
        <UButton
          size="xs"
          color="neutral"
          type="button"
          :loading="creatingNote"
          :on-click="createNote"
        >
          New
        </UButton>
      </div>
      <ul class="flex-1 overflow-y-auto">
        <li
          v-for="n in notes"
          :key="n.id"
        >
          <button
            type="button"
            class="flex w-full flex-col items-start border-b border-zinc-100/80 px-3 py-2 text-left hover:bg-zinc-50"
            :class="selectedNoteId === n.id ? 'bg-amber-50/80' : ''"
            @click="selectNote(n.id)"
          >
            <span class="line-clamp-1 text-sm font-medium text-zinc-900">{{ n.title || 'Untitled' }}</span>
            <span class="line-clamp-2 text-xs text-zinc-500">{{ n.excerpt || 'No additional text' }}</span>
            <span class="mt-1 text-[10px] text-zinc-400">{{ new Date(n.updatedAt).toLocaleString() }}</span>
          </button>
        </li>
      </ul>
    </section>

    <main v-if="currentNote" class="flex min-w-0 flex-1 flex-col bg-[#fbfbfa]">
      <header class="flex items-center gap-2 border-b border-zinc-200/60 bg-white/50 px-4 py-3">
        <UInput
          v-model="title"
          placeholder="Title"
          variant="ghost"
          size="lg"
          class="flex-1 font-semibold"
          :ui="{ base: 'text-lg' }"
        />
        <UButton
          v-if="!currentNote.shareEnabled"
          size="xs"
          variant="soft"
          @click="enableShareLink"
        >
          Share
        </UButton>
        <template v-else>
          <UButton size="xs" variant="soft" @click="enableShareLink">
            Copy link
          </UButton>
          <UButton size="xs" color="error" variant="ghost" @click="disableShareLink">
            Stop sharing
          </UButton>
        </template>
        <UButton size="xs" color="error" variant="ghost" @click="deleteNote">
          Delete
        </UButton>
      </header>
      <div v-if="shareUrl" class="border-b border-amber-100 bg-amber-50/90 px-4 py-2 text-xs text-amber-950">
        <span class="font-medium">Shared:</span>
        {{ shareUrl }}
      </div>
      <div class="relative flex-1 overflow-y-auto">
        <ClientOnly>
          <NotesLexicalNoteEditor
            :note-key="selectedNoteId || 'none'"
            :model-value="content"
            class="h-full pt-2"
            @update:model-value="onEditorUpdate"
            @update:excerpt="onExcerptUpdate"
          />
          <template #fallback>
            <div class="p-6 text-sm text-zinc-500">
              Loading editor…
            </div>
          </template>
        </ClientOnly>
      </div>
    </main>

    <div v-else class="flex flex-1 items-center justify-center bg-[#fbfbfa] text-sm text-zinc-400">
      Select a note or create one
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="showNewFolder"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4"
      @click.self="showNewFolder = false"
    >
      <UCard class="w-full max-w-md shadow-xl">
        <template #header>
          <span class="font-medium">New folder</span>
        </template>
        <UFormField label="Name">
          <UInput v-model="newFolderName" autofocus @keyup.enter="createFolder" />
        </UFormField>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showNewFolder = false">
              Cancel
            </UButton>
            <UButton :loading="creatingFolder" :on-click="createFolder">
              Create
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </Teleport>
</template>
