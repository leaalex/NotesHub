<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { EMPTY_TIPTAP_DOC_JSON } from '#shared/tiptap-empty-doc'
import type { NoteOutlineItem } from '#shared/note-outline'

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

/** Заголовки текущей заметки для Notion-like навигации (клиент-only). */
const noteOutline = ref<NoteOutlineItem[]>([])

type LinkedContact = {
  contactId: string
  displayName: string
  type: string
  source: string
}

const linkedContacts = ref<LinkedContact[]>([])
const showLinkContact = ref(false)
const linkContactQuery = ref('')

const route = useRoute()
const router = useRouter()

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
    content.value = n.content || EMPTY_TIPTAP_DOC_JSON
    excerpt.value = n.excerpt || ''
  }
  finally {
    nextTick(() => {
      hydratingNote.value = false
      refreshLinkedContacts()
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

async function refreshLinkedContacts(opts?: { signal?: AbortSignal }) {
  const id = selectedNoteId.value
  if (!id) {
    linkedContacts.value = []
    return
  }
  try {
    linkedContacts.value = await apiFetch<LinkedContact[]>(`/api/notes/${id}/contacts`, {
      ...(opts?.signal ? { signal: opts.signal } : {}),
    })
  }
  catch {
    linkedContacts.value = []
  }
}

async function linkContactPick(contactId: string) {
  const id = selectedNoteId.value
  if (!id) return
  await apiFetch(`/api/notes/${id}/contacts/${contactId}`, { method: 'POST' })
  await refreshLinkedContacts()
  showLinkContact.value = false
  linkContactQuery.value = ''
}

async function unlinkContact(contactId: string) {
  const id = selectedNoteId.value
  if (!id) return
  await apiFetch(`/api/notes/${id}/contacts/${contactId}`, { method: 'DELETE' })
  await refreshLinkedContacts()
}

type ContactChip = {
  id: string
  displayName: string
  type: string
}

const contactPickerCandidates = ref<ContactChip[]>([])

async function refreshContactPicker() {
  const q = linkContactQuery.value.trim()
  contactPickerCandidates.value = await apiFetch('/api/contacts', {
    query: q ? { q } : {},
  })
}

watch(showLinkContact, async v => {
  if (v)
    await refreshContactPicker()
})

watchDebounced(linkContactQuery, async () => {
  if (!showLinkContact.value)
    return
  await refreshContactPicker()
}, { debounce: 300 })

const pickerContactsFiltered = computed(() => {
  const linked = new Set(linkedContacts.value.map(l => l.contactId))
  return contactPickerCandidates.value.filter(c => !linked.has(c.id))
})

watch(
  () => route.query.note,
  async (nid) => {
    if (!nid || Array.isArray(nid))
      return
    const noteId = String(nid)
    await selectNote(noteId)
    const q = { ...route.query }
    delete q.note
    await router.replace({ path: '/', query: q })
  },
  { immediate: true },
)

async function load() {
  await Promise.all([refreshFolders(), refreshNotes()])
}

onMounted(load)

watch(folderFilter, async () => {
  selectedNoteId.value = null
  currentNote.value = null
  linkedContacts.value = []
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
    content.value = n.content || EMPTY_TIPTAP_DOC_JSON
    excerpt.value = n.excerpt || ''
  }
  finally {
    await nextTick()
    hydratingNote.value = false
    await refreshLinkedContacts()
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
    await refreshLinkedContacts()
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
      await refreshLinkedContacts()
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

function onOutlineUpdate(items: NoteOutlineItem[]) {
  noteOutline.value = items
}

function scrollNoteToHeading(id: string) {
  nextTick(() => {
    const el = document.querySelector(`[data-note-heading-id="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

watch(currentNote, v => {
  if (!v)
    noteOutline.value = []
})

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
  linkedContacts.value = []
  await refreshNotes()
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

</script>

<template>
  <LayoutAppThreeColumn>
    <template #folders>
      <div class="flex flex-col gap-4 border-b border-zinc-200/40 p-4 pb-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Folders
            </div>
          </div>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            square
            class="rounded-full ring-1 ring-zinc-200/80 hover:bg-white/80"
            icon="i-lucide-folder-plus"
            aria-label="New folder"
            @click="showNewFolder = true"
          />
        </div>
        <nav class="flex flex-col gap-1 text-[13px]">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === 'all'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = 'all'"
          >
            <Icon name="i-lucide-layout-grid" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            All notes
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === 'unfiled'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = 'unfiled'"
          >
            <Icon name="i-lucide-file-stack" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            Unfiled
          </button>
          <button
            v-for="f in folders"
            :key="f.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === f.id
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = f.id"
          >
            <Icon name="i-lucide-folder" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            <span class="truncate">{{ f.name }}</span>
          </button>
        </nav>
      </div>
    </template>

    <template #cards>
      <div class="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
        <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          Library
        </span>
        <UButton
          size="xs"
          color="neutral"
          type="button"
          class="rounded-full px-3 shadow-sm ring-1 ring-zinc-900/10"
          :loading="creatingNote"
          :on-click="createNote"
        >
          <Icon name="i-lucide-plus" class="mr-1 size-3.5" aria-hidden="true" />
          New
        </UButton>
      </div>
      <ul class="notes-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
        <li v-for="n in notes" :key="n.id">
          <button
            type="button"
            class="group flex w-full flex-col items-start rounded-2xl border px-3 py-3 text-left transition-all duration-200"
            :class="selectedNoteId === n.id
              ? 'border-zinc-900/25 bg-white'
              : 'border-transparent bg-white/40 hover:border-zinc-200/80 hover:bg-white/70 hover:shadow-sm'"
            @click="selectNote(n.id)"
          >
            <div class="flex w-full items-start justify-between gap-2">
              <span class="line-clamp-1 flex-1 text-[13px] font-semibold tracking-tight text-zinc-900">
                {{ n.title || 'Untitled' }}
              </span>
              <Icon
                v-if="n.shareEnabled"
                name="i-lucide-link-2"
                class="mt-0.5 size-3.5 shrink-0 text-zinc-400 opacity-70 group-hover:opacity-100"
                aria-hidden="true"
                title="Shared"
              />
            </div>
            <span class="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500">
              {{ n.excerpt || 'Empty note' }}
            </span>
            <span class="mt-2 text-[10px] tabular-nums text-zinc-400">
              {{ new Date(n.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
              ·
              {{ new Date(n.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }}
            </span>
          </button>
        </li>
      </ul>
    </template>

    <main v-if="currentNote" class="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-md ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/45">
        <header class="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-100/90 px-4 py-3 sm:px-6">
          <UInput
            v-model="title"
            placeholder="Untitled"
            variant="ghost"
            size="lg"
            class="min-w-[12rem] flex-1 font-semibold tracking-tight"
            :ui="{ base: 'text-xl placeholder:text-zinc-300' }"
          />
          <div class="flex shrink-0 flex-wrap items-center gap-1.5 rounded-full bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]">
            <UButton
              v-if="!currentNote.shareEnabled"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-link"
              class="rounded-full px-3"
              @click="enableShareLink"
            >
              Share
            </UButton>
            <template v-else>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-copy"
                class="rounded-full px-3"
                @click="enableShareLink"
              >
                Copy link
              </UButton>
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-link-2-off"
                class="rounded-full px-3"
                @click="disableShareLink"
              >
                Stop
              </UButton>
            </template>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              class="rounded-full px-3"
              @click="deleteNote"
            >
              Delete
            </UButton>
          </div>
        </header>

        <div
          v-if="shareUrl"
          class="shrink-0 border-b border-emerald-100/90 bg-emerald-50/80 px-4 py-2 text-[11px] text-emerald-950 sm:px-6"
        >
          <span class="font-semibold text-emerald-900">Shared · </span>
          <span class="break-all font-mono text-emerald-900/90">{{ shareUrl }}</span>
        </div>

        <div class="relative flex min-h-0 flex-1 overflow-hidden">
          <div class="notes-scrollbar relative min-h-0 flex-1 overflow-y-auto px-3 pb-10 pt-2 sm:px-8">
            <ClientOnly>
              <NotesLexicalNoteEditor
                :note-key="selectedNoteId || 'none'"
                :model-value="content"
                class="mx-auto min-h-full max-w-[42rem]"
                @update:model-value="onEditorUpdate"
                @update:excerpt="onExcerptUpdate"
                @update:outline="onOutlineUpdate"
              />
              <template #fallback>
                <div class="flex min-h-[40vh] items-center justify-center text-sm text-zinc-400">
                  Loading editor…
                </div>
              </template>
            </ClientOnly>
          </div>

          <aside
            class="notes-scrollbar hidden w-[17rem] shrink-0 overflow-y-auto border-l border-zinc-100/90 bg-white/20 px-3 py-5 xl:flex xl:flex-col xl:gap-0"
          >
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                On this page
              </div>
              <nav v-if="noteOutline.length" class="mt-3 space-y-0.5" aria-label="Outline">
                <button
                  v-for="item in noteOutline"
                  :key="item.id"
                  type="button"
                  class="flex w-full max-w-full rounded-lg px-2 py-1.5 text-left text-[12px] leading-snug text-zinc-600 transition-colors hover:bg-white/85 hover:text-zinc-900"
                  :style="{ paddingLeft: `${8 + (item.level - 1) * 12}px` }"
                  @click="scrollNoteToHeading(item.id)"
                >
                  <span class="line-clamp-2">{{ item.text }}</span>
                </button>
              </nav>
              <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
                Add headings to build navigation.
              </p>
            </div>

            <div class="mt-8 shrink-0 border-t border-zinc-100/80 pt-5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  Linked contacts
                </span>
                <button
                  type="button"
                  class="rounded-full px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-white/85"
                  @click="showLinkContact = true"
                >
                  + Link
                </button>
              </div>
              <ul v-if="linkedContacts.length" class="mt-3 flex flex-col gap-1">
                <li
                  v-for="c in linkedContacts"
                  :key="c.contactId"
                  class="flex items-start justify-between gap-1 rounded-lg bg-white/50 px-2 py-1.5 ring-1 ring-zinc-950/[0.04]"
                >
                  <NuxtLink
                    class="flex min-w-0 flex-col text-left hover:underline"
                    :to="`/contacts/${c.contactId}`"
                  >
                    <span class="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">{{ c.displayName }}</span>
                    <span class="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{{ c.type }}</span>
                  </NuxtLink>
                  <button
                    type="button"
                    class="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-white hover:text-red-600"
                    aria-label="Unlink contact"
                    @click="unlinkContact(c.contactId)"
                  >
                    <Icon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              </ul>
              <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
                No linked contacts. Use “+ Link” or <span class="font-medium text-zinc-500">@</span> in the note body.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>

    <div
      v-else
      class="flex min-w-0 flex-1 flex-col items-center justify-center px-8 py-12 text-center"
    >
      <div class="max-w-sm rounded-[1.35rem] border border-white/70 bg-white/50 px-10 py-12 shadow-[0_24px_80px_-32px_rgba(24,24,27,0.35)] backdrop-blur-md ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/40">
        <h2 class="text-lg font-semibold tracking-tight text-zinc-900">
          Pick a note to write
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-zinc-500">
          Your drafts stay here — minimal surface, zero clutter.
        </p>
        <UButton
          class="mt-8 rounded-full px-6 shadow-md ring-1 ring-zinc-900/10"
          color="neutral"
          size="md"
          icon="i-lucide-plus"
          :loading="creatingNote"
          :on-click="createNote"
        >
          New note
        </UButton>
      </div>
    </div>
  </LayoutAppThreeColumn>

  <Teleport to="body">
    <div
      v-if="showNewFolder"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-[2px]"
      @click.self="showNewFolder = false"
    >
      <UCard class="w-full max-w-md overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-2xl shadow-zinc-950/15 ring-1 ring-zinc-950/[0.06] backdrop-blur-xl">
        <template #header>
          <span class="font-semibold tracking-tight text-zinc-900">New folder</span>
        </template>
        <UFormField label="Name">
          <UInput v-model="newFolderName" autofocus class="rounded-xl" @keyup.enter="createFolder" />
        </UFormField>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" icon="i-lucide-x" class="rounded-full" @click="showNewFolder = false">
              Cancel
            </UButton>
            <UButton icon="i-lucide-check" color="neutral" :loading="creatingFolder" class="rounded-full" :on-click="createFolder">
              Create
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="showLinkContact"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-[2px]"
      @click.self="showLinkContact = false"
    >
      <UCard class="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-2xl ring-1 ring-zinc-950/[0.06] backdrop-blur-xl">
        <template #header>
          <span class="font-semibold text-zinc-900">Link a contact</span>
        </template>
        <UInput v-model="linkContactQuery" placeholder="Search…" icon="i-lucide-search" class="rounded-xl" />
        <ul class="mt-3 space-y-1 overflow-y-auto" style="max-height:min(320px,50vh);">
          <li v-if="pickerContactsFiltered.length === 0" class="px-3 py-6 text-center text-[13px] text-zinc-400">
            Nothing to show yet.
          </li>
          <li v-for="c in pickerContactsFiltered" :key="c.id">
            <button
              type="button"
              class="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[13px] hover:bg-zinc-50"
              @click="linkContactPick(c.id)"
            >
              <span class="line-clamp-1 font-medium">{{ c.displayName }}</span>
              <span class="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">{{ c.type }}</span>
            </button>
          </li>
        </ul>
        <template #footer>
          <div class="flex justify-end">
            <UButton variant="ghost" color="neutral" class="rounded-full" @click="showLinkContact = false">
              Close
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </Teleport>
</template>

<style scoped>
.notes-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgb(228 228 231 / 0.9) transparent;
}
.notes-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.notes-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgb(228 228 231 / 0.95);
}
</style>
