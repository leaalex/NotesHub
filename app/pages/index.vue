<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { debouncedSchedule } from '#shared/debounced-schedule'
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
  linkedFiles?: AppFile[]
}

/** Same-origin fetch с cookie сессии (надёжнее глобального `$fetch` при SSR/клиенте) */
const apiFetch = useRequestFetch()
const toast = useToast()
const runtimeConfig = useRuntimeConfig()

const folderFilter = ref<'all' | 'unfiled' | string>('all')
const folders = ref<FolderRow[]>([])
const notes = ref<NoteList[]>([])
const selectedNoteId = ref<string | null>(null)
const currentNote = ref<NoteDetail | null>(null)
const title = ref('')
const content = ref('')
const excerpt = ref('')
const shareUrl = ref('')
const creatingNote = ref(false)
const showDeleteNoteConfirm = ref(false)
const deletingNote = ref(false)

/** Default read-only until Edit; autosave только в режиме редактирования. */
const isEditing = ref(false)
const finishingEdit = ref(false)

const {
  newFolderName,
  showNewFolder,
  creatingFolder,
  createFolder,
} = useNewFolderModal(folders)

const { open: foldersRailOpen, toggle: toggleFoldersRail } = useFoldersRail()

const searchQuery = ref('')
const viewMode = ref<'cards' | 'table'>('cards')

const filteredNotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q)
    return notes.value
  return notes.value.filter(n =>
    String(n.title ?? '').toLowerCase().includes(q)
    || String(n.excerpt ?? '').toLowerCase().includes(q),
  )
})

/** Заголовки текущей заметки для Notion-like навигации (клиент-only). */
const noteOutline = ref<NoteOutlineItem[]>([])

type LinkedContact = {
  contactId: string
  displayName: string
  type: string
  source: string
}

type AppFile = {
  id: string
  originalName: string
  title?: string
  description?: string
  mimeType: string
  size: number
  shareEnabled: boolean
  shareToken: string | null
  shareUrl: string | null
  downloadUrl: string
}

const linkedContacts = ref<LinkedContact[]>([])
const linkedFiles = ref<AppFile[]>([])
const showLinkContact = ref(false)
const linkContactQuery = ref('')
const noteFileInput = ref<HTMLInputElement | null>(null)

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

async function refreshLinkedFiles(opts?: { signal?: AbortSignal }) {
  const id = selectedNoteId.value
  if (!id) {
    linkedFiles.value = []
    return
  }
  try {
    linkedFiles.value = await apiFetch<AppFile[]>(`/api/notes/${id}/files`, {
      ...(opts?.signal ? { signal: opts.signal } : {}),
    })
  }
  catch {
    linkedFiles.value = []
  }
}

async function persistNoteImmediate(): Promise<boolean> {
  const id = selectedNoteId.value
  if (!id || hydratingNote.value)
    return true
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
    await refreshLinkedFiles()
    if (currentNote.value?.id === row.id)
      currentNote.value = { ...currentNote.value, ...row }
    return true
  }
  catch (e: unknown) {
    notifyApiError('Could not save note', e)
    return false
  }
}

const notePersistDebounce = debouncedSchedule(() => persistNoteImmediate(), 650)

watch([title, content, excerpt], () => {
  if (!isEditing.value || hydratingNote.value)
    return
  notePersistDebounce.schedule()
})

async function finishEditing() {
  if (!selectedNoteId.value || !currentNote.value)
    return
  finishingEdit.value = true
  try {
    notePersistDebounce.cancel()
    const ok = await persistNoteImmediate()
    if (!ok)
      return
    isEditing.value = false
  }
  finally {
    finishingEdit.value = false
  }
}

function openNoteFromRow(n: NoteDetail) {
  notePersistDebounce.cancel()
  hydratingNote.value = true
  try {
    shareUrl.value = ''
    selectedNoteId.value = n.id
    currentNote.value = n
    title.value = n.title
    content.value = n.content || EMPTY_TIPTAP_DOC_JSON
    excerpt.value = n.excerpt || ''
    isEditing.value = false
  }
  finally {
    nextTick(() => {
      hydratingNote.value = false
      refreshLinkedContacts()
      refreshLinkedFiles()
    })
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

function openNoteFilePicker() {
  noteFileInput.value?.click()
}

async function onNoteFilePicked(event: Event) {
  const id = selectedNoteId.value
  if (!id) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const form = new FormData()
  form.append('file', file, file.name)

  try {
    const uploaded = await apiFetch<AppFile>('/api/files/upload', {
      method: 'POST',
      body: form,
    })
    await apiFetch(`/api/notes/${id}/files`, {
      method: 'POST',
      body: { fileId: uploaded.id },
    })
    await refreshLinkedFiles()
  }
  catch (e: unknown) {
    notifyApiError('Could not upload file', e)
  }
  finally {
    input.value = ''
  }
}

async function unlinkFileFromNote(fileId: string) {
  const id = selectedNoteId.value
  if (!id) return
  await apiFetch(`/api/notes/${id}/files/${fileId}`, { method: 'DELETE' })
  await refreshLinkedFiles()
}

async function deleteFileEverywhere(fileId: string) {
  await apiFetch(`/api/files/${fileId}`, { method: 'DELETE' })
  await refreshLinkedFiles()
}

async function toggleFileShare(fileId: string, nextEnabled: boolean) {
  if (nextEnabled) {
    await apiFetch(`/api/files/${fileId}/share`, { method: 'POST', body: {} })
  }
  else {
    await apiFetch(`/api/files/${fileId}/share`, { method: 'DELETE' })
  }
  await refreshLinkedFiles()
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
  notePersistDebounce.cancel()
  isEditing.value = false
  selectedNoteId.value = null
  currentNote.value = null
  linkedContacts.value = []
  linkedFiles.value = []
  await refreshNotes()
})

async function selectNote(id: string, opts?: { signal?: AbortSignal }) {
  notePersistDebounce.cancel()
  isEditing.value = false
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
    await refreshLinkedFiles()
  }
}

async function createNote() {
  creatingNote.value = true
  try {
    notePersistDebounce.cancel()
    const body: { title: string, folderId?: string | null } = { title: 'New note' }
    if (folderFilter.value === 'unfiled') body.folderId = null
    else if (folderFilter.value !== 'all') body.folderId = folderFilter.value
    const row = await apiRequest<NoteDetail>('/api/notes', { method: 'POST', body })
    if (!row?.id) {
      throw new Error('Server returned no note id')
    }
    upsertNoteInLocalList(row)
    openNoteFromRow(row)
    await nextTick()
    isEditing.value = true
    await refreshLinkedContacts()
    await refreshLinkedFiles()
  }
  catch (e: unknown) {
    notifyApiError('Could not create note', e)
  }
  finally {
    creatingNote.value = false
  }
}

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

function openDeleteNoteConfirm() {
  if (!selectedNoteId.value)
    return
  showDeleteNoteConfirm.value = true
}

async function confirmDeleteNote() {
  if (!selectedNoteId.value)
    return
  deletingNote.value = true
  try {
    await apiFetch(`/api/notes/${selectedNoteId.value}`, { method: 'DELETE' })
    selectedNoteId.value = null
    currentNote.value = null
    isEditing.value = false
    linkedContacts.value = []
    linkedFiles.value = []
    await refreshNotes()
    showDeleteNoteConfirm.value = false
  }
  catch (e: unknown) {
    notifyApiError('Could not delete note', e)
  }
  finally {
    deletingNote.value = false
  }
}

function currentNoteShareHref(): string {
  const n = currentNote.value
  if (!n?.shareEnabled || !n.shareToken)
    return ''
  const base = String(runtimeConfig.public.siteUrl ?? '').replace(/\/$/, '')
  return base ? `${base}/share/${n.shareToken}` : ''
}

async function copyNoteShareLink() {
  const href = currentNoteShareHref()
  if (!href) {
    toast.add({
      title: 'No share link',
      description: 'Enable sharing first.',
      color: 'neutral',
    })
    return
  }
  try {
    await navigator.clipboard.writeText(href)
    shareUrl.value = href
    toast.add({
      title: 'Link copied',
      color: 'success',
    })
  }
  catch {
    toast.add({
      title: 'Could not copy',
      description: 'Clipboard permission may be blocked.',
      color: 'error',
    })
  }
}

async function enableShareLink() {
  if (!selectedNoteId.value) return
  try {
    const r = await apiFetch<{ url: string, shareToken?: string }>(`/api/notes/${selectedNoteId.value}/share`, { method: 'POST', body: {} })
    shareUrl.value = r.url
    await refreshNotes()
    const id = selectedNoteId.value
    if (currentNote.value?.id === id) {
      currentNote.value.shareEnabled = true
      if (r.shareToken)
        currentNote.value.shareToken = r.shareToken
    }
  }
  catch (e: unknown) {
    notifyApiError('Could not enable share link', e)
  }
}

async function disableShareLink() {
  if (!selectedNoteId.value) return
  try {
    await apiFetch(`/api/notes/${selectedNoteId.value}/share`, { method: 'DELETE' })
    shareUrl.value = ''
    if (currentNote.value) {
      currentNote.value.shareEnabled = false
      currentNote.value.shareToken = null
    }
    await refreshNotes()
  }
  catch (e: unknown) {
    notifyApiError('Could not disable share link', e)
  }
}

function tableRowClasses(n: NoteList) {
  const active = selectedNoteId.value === n.id && !!n.id
  const base = 'cursor-pointer transition-colors text-left text-[13px]'
  if (active)
    return `${base} bg-zinc-900/8 font-medium text-zinc-900`
  return `${base} text-zinc-800 hover:bg-white/75`
}

</script>

<template>
  <LayoutAppThreeColumn right-pane-scrollable :view-mode="viewMode">
    <template #subheader>
      <UButton
        variant="ghost"
        color="neutral"
        square
        size="sm"
        class="shrink-0 rounded-[var(--ui-control-radius)] ring-1 ring-zinc-200/80 hover:bg-white/80"
        :icon="foldersRailOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
        :aria-label="foldersRailOpen ? 'Hide folders' : 'Show folders'"
        :aria-pressed="foldersRailOpen"
        @click="toggleFoldersRail()"
      />
      <div class="flex min-w-0 flex-1 justify-center">
        <UInput
          v-model="searchQuery"
          placeholder="Search notes…"
          size="sm"
          icon="i-lucide-search"
          class="w-full max-w-sm"
          :ui="{ base: 'rounded-[var(--ui-control-radius)]' }"
        />
      </div>
      <div class="flex shrink-0 items-center gap-1 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]">
        <UButton
          size="xs"
          :variant="viewMode === 'cards' ? 'solid' : 'ghost'"
          color="neutral"
          icon="i-lucide-layout-list"
          square
          class="rounded-[var(--ui-control-radius)]"
          aria-label="Card view"
          @click="viewMode = 'cards'"
        />
        <UButton
          size="xs"
          :variant="viewMode === 'table' ? 'solid' : 'ghost'"
          color="neutral"
          icon="i-lucide-table-2"
          square
          class="rounded-[var(--ui-control-radius)]"
          aria-label="Table view"
          @click="viewMode = 'table'"
        />
      </div>
    </template>

    <template #folders>
      <div class="flex flex-col gap-4 border-b border-zinc-200/40 p-4 pb-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <UiSectionLabel>
              Folders
            </UiSectionLabel>
          </div>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            square
            class="rounded-[var(--ui-control-radius)] ring-1 ring-zinc-200/80 hover:bg-white/80"
            icon="i-lucide-folder-plus"
            aria-label="New folder"
            @click="showNewFolder = true"
          />
        </div>
        <nav class="flex flex-col gap-1 text-[13px]">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === 'all'
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = 'all'"
          >
            <Icon name="i-lucide-layout-grid" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            All notes
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === 'unfiled'
              ? 'bg-zinc-900 text-white'
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
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === f.id
              ? 'bg-zinc-900 text-white'
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
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
        <UiSectionLabel>
          Notes
        </UiSectionLabel>
        <UButton
          size="xs"
          color="neutral"
          type="button"
          square
          class="rounded-[var(--ui-control-radius)] ring-1 ring-zinc-900/10"
          icon="i-lucide-plus"
          aria-label="New note"
          :loading="creatingNote"
          :on-click="createNote"
        />
      </div>
      <template v-if="viewMode === 'cards'">
        <ul class="ui-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
          <li v-for="n in filteredNotes" :key="n.id">
            <button
              type="button"
              class="group flex w-full flex-col items-start rounded-[var(--ui-control-radius)] border px-4 py-3 text-left ring-1 transition-all"
              :class="selectedNoteId === n.id
                ? 'border-zinc-900/15 bg-white ring-zinc-900/[0.06]'
                : 'border-transparent bg-white ring-zinc-950/[0.03] hover:border-zinc-200/80'"
              @click="void selectNote(n.id)"
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
          <li
            v-if="filteredNotes.length === 0"
            class="rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
          >
            No notes match your filters.
          </li>
        </ul>
      </template>
      <div v-else class="ui-scrollbar min-h-0 flex-1 overflow-auto px-2 pb-4 pt-2 sm:px-3">
        <table class="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr class="sticky top-0 z-[1] border-b border-zinc-200/80 bg-white/85 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 backdrop-blur-sm">
              <th class="px-2 py-2 font-semibold">
                Title
              </th>
              <th class="px-2 py-2 font-semibold">
                Excerpt
              </th>
              <th class="hidden px-2 py-2 font-semibold md:table-cell">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="n in filteredNotes"
              :key="n.id"
              class="border-b border-zinc-100/90"
              :class="tableRowClasses(n)"
              @click="void selectNote(n.id)"
            >
              <td class="max-w-[10rem] px-2 py-2">
                <div class="flex min-w-0 items-center gap-1.5">
                  <Icon
                    v-if="n.shareEnabled"
                    name="i-lucide-link-2"
                    class="size-3 shrink-0 text-zinc-400"
                    aria-hidden="true"
                  />
                  <span class="truncate font-medium text-zinc-900">{{ n.title || 'Untitled' }}</span>
                </div>
              </td>
              <td class="max-w-[14rem] truncate px-2 py-2 text-zinc-600">
                {{ n.excerpt || 'Empty note' }}
              </td>
              <td class="hidden whitespace-nowrap tabular-nums px-2 py-2 text-zinc-500 md:table-cell">
                {{ new Date(n.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
                ·
                {{ new Date(n.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="filteredNotes.length === 0"
          class="rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
        >
          No notes match your filters.
        </div>
      </div>
    </template>

    <main v-if="currentNote" class="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/70 bg-white/55 backdrop-blur-md ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/45">
        <header class="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-100/90 px-4 py-3 sm:px-6">
          <div class="min-w-[12rem] flex-1">
            <h1
              v-if="!isEditing"
              class="truncate text-xl font-semibold tracking-tight text-zinc-900 sm:text-[1.35rem]"
            >
              {{ title.trim() ? title : 'Untitled' }}
            </h1>
            <UInput
              v-else
              v-model="title"
              placeholder="Untitled"
              variant="ghost"
              size="lg"
              class="w-full font-semibold tracking-tight"
              :ui="{ base: 'text-xl placeholder:text-zinc-300' }"
            />
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-1.5 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]">
            <UButton
              v-if="!currentNote.shareEnabled"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-link"
              class="rounded-[var(--ui-control-radius)] px-3"
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
                class="rounded-[var(--ui-control-radius)] px-3"
                @click="copyNoteShareLink"
              >
                Copy link
              </UButton>
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-link-2-off"
                class="rounded-[var(--ui-control-radius)] px-3"
                @click="disableShareLink"
              >
                Stop
              </UButton>
            </template>
            <div
              class="mx-0.5 hidden h-4 w-px shrink-0 bg-zinc-200/80 sm:block"
              role="presentation"
              aria-hidden="true"
            />
            <UButton
              v-if="!isEditing"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              class="rounded-[var(--ui-control-radius)] px-3"
              @click="isEditing = true"
            >
              Edit
            </UButton>
            <template v-else>
              <UButton
                icon="i-lucide-check"
                color="neutral"
                variant="ghost"
                size="xs"
                class="rounded-[var(--ui-control-radius)] px-3"
                :loading="finishingEdit"
                @click="finishEditing"
              >
                Done
              </UButton>
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                class="rounded-[var(--ui-control-radius)] px-3"
                :loading="deletingNote"
                @click="openDeleteNoteConfirm"
              >
                Delete
              </UButton>
            </template>
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
          <div class="ui-scrollbar relative min-h-0 flex-1 overflow-y-auto px-3 pb-10 pt-2 sm:px-8">
            <ClientOnly>
              <NotesLexicalNoteEditor
                :note-key="selectedNoteId || 'none'"
                :model-value="content"
                :read-only="!isEditing"
                :placeholder="isEditing ? 'Start writing…' : ''"
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
            class="ui-scrollbar hidden w-[17rem] shrink-0 overflow-y-auto border-l border-zinc-100/90 bg-white/20 px-3 py-5 xl:flex xl:flex-col xl:gap-0"
          >
            <input
              ref="noteFileInput"
              type="file"
              class="hidden"
              @change="onNoteFilePicked"
            >
            <div>
              <UiSectionLabel>
                On this page
              </UiSectionLabel>
              <nav v-if="noteOutline.length" class="mt-3 space-y-0.5" aria-label="Outline">
                <button
                  v-for="item in noteOutline"
                  :key="item.id"
                  type="button"
                  class="flex w-full max-w-full rounded-[var(--ui-control-radius)] px-2 py-1.5 text-left text-[12px] leading-snug text-zinc-600 transition-colors hover:bg-white/85 hover:text-zinc-900"
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
                <UiSectionLabel>
                  Linked contacts
                </UiSectionLabel>
                <button
                  v-if="isEditing"
                  type="button"
                  class="rounded-[var(--ui-control-radius)] px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-white/85"
                  @click="showLinkContact = true"
                >
                  + Link
                </button>
              </div>
              <ul v-if="linkedContacts.length" class="mt-3 flex flex-col gap-1">
                <li
                  v-for="c in linkedContacts"
                  :key="c.contactId"
                  class="flex items-start justify-between gap-1 rounded-[var(--ui-control-radius)] bg-white/50 px-2 py-1.5 ring-1 ring-zinc-950/[0.04]"
                >
                  <NuxtLink
                    class="flex min-w-0 flex-col text-left hover:underline"
                    :to="`/contacts/${c.contactId}`"
                  >
                    <span class="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">{{ c.displayName }}</span>
                    <span class="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{{ c.type }}</span>
                  </NuxtLink>
                  <button
                    v-if="isEditing"
                    type="button"
                    class="shrink-0 rounded-[var(--ui-control-radius)] p-1 text-zinc-400 hover:bg-white hover:text-red-600"
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

            <div class="mt-8 shrink-0 border-t border-zinc-100/80 pt-5">
              <div class="flex items-center justify-between gap-2">
                <UiSectionLabel>
                  Linked files
                </UiSectionLabel>
                <button
                  v-if="isEditing"
                  type="button"
                  class="rounded-[var(--ui-control-radius)] px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-white/85"
                  @click="openNoteFilePicker"
                >
                  + File
                </button>
              </div>
              <div v-if="linkedFiles.length" class="mt-3 flex flex-col gap-2">
                <FilesFileAttachmentItem
                  v-for="f in linkedFiles"
                  :key="f.id"
                  :file="f"
                  :show-unlink="isEditing"
                  :show-delete="isEditing"
                  :show-share="isEditing"
                  @unlink="unlinkFileFromNote"
                  @delete="deleteFileEverywhere"
                  @toggle-share="(fileId, nextEnabled) => toggleFileShare(fileId, nextEnabled)"
                />
              </div>
              <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
                No files yet. Attach one to share, preview, or download.
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
      <UiEmptyState
        title="Pick a note to write"
        description="Your drafts stay here — minimal surface, zero clutter."
      >
        <template #actions>
          <UButton
            class="rounded-[var(--ui-control-radius)] px-6 ring-1 ring-zinc-900/10"
            color="neutral"
            size="md"
            icon="i-lucide-plus"
            :loading="creatingNote"
            :on-click="createNote"
          >
            New note
          </UButton>
        </template>
      </UiEmptyState>
    </div>
  </LayoutAppThreeColumn>

  <UiNewFolderDialog
    v-model:open="showNewFolder"
    v-model:name="newFolderName"
    :creating="creatingFolder"
    @submit="createFolder"
  />

  <UiConfirmDeleteDialog
    v-model:open="showDeleteNoteConfirm"
    title="Delete note"
    description="This note will be permanently removed. This action cannot be undone."
    :loading="deletingNote"
    @confirm="confirmDeleteNote"
  />

  <Teleport to="body">
    <div
      v-if="showLinkContact"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-[2px]"
      @click.self="showLinkContact = false"
    >
      <UCard class="max-h-[80vh] w-full max-w-md overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/60 bg-white/95 ring-1 ring-zinc-950/[0.06] backdrop-blur-xl">
        <template #header>
          <span class="font-semibold text-zinc-900">Link a contact</span>
        </template>
        <UInput v-model="linkContactQuery" placeholder="Search…" icon="i-lucide-search" class="rounded-[var(--ui-control-radius)]" />
        <ul class="mt-3 space-y-1 overflow-y-auto" style="max-height:min(320px,50vh);">
          <li v-if="pickerContactsFiltered.length === 0" class="px-3 py-6 text-center text-[13px] text-zinc-400">
            Nothing to show yet.
          </li>
          <li v-for="c in pickerContactsFiltered" :key="c.id">
            <button
              type="button"
              class="flex w-full items-center rounded-[var(--ui-control-radius)] px-3 py-2.5 text-left text-[13px] hover:bg-zinc-50"
              @click="linkContactPick(c.id)"
            >
              <span class="line-clamp-1 font-medium">{{ c.displayName }}</span>
              <span class="ml-auto rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">{{ c.type }}</span>
            </button>
          </li>
        </ul>
        <template #footer>
          <div class="flex justify-end">
            <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="showLinkContact = false">
              Close
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </Teleport>
</template>
