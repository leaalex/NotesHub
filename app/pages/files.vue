<script setup lang="ts">
type FolderRow = {
  id: string
  name: string
  parentId: string | null
  position: number
}

type AppFile = {
  id: string
  originalName: string
  title: string
  description: string
  mimeType: string
  size: number
  shareEnabled: boolean
  shareToken: string | null
  shareUrl: string | null
  downloadUrl: string
}

const route = useRoute()
const router = useRouter()
const apiFetch = useRequestFetch()
const toast = useToast()

const folderFilter = useState<'all' | 'unfiled' | string>('files:folderFilter', () => 'all')
const listVersion = useState<number>('files:listVersion', () => 0)

const folders = ref<FolderRow[]>([])
const files = ref<AppFile[]>([])
const filesLoading = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const {
  newFolderName,
  showNewFolder,
  creatingFolder,
  createFolder,
} = useNewFolderModal(folders)

const { open: foldersRailOpen, toggle: toggleFoldersRail } = useFoldersRail()

const searchQuery = ref('')
const viewMode = ref<'cards' | 'table'>('cards')

const selectedFileId = computed(() => {
  const m = route.path.match(/^\/files\/([^/]+)\/?$/)
  if (!m?.[1])
    return ''
  return m[1]
})

function manageFields() {
  void router.push('/library/file-fields')
}

function displayFileName(f: AppFile) {
  const t = f.title?.trim()
  return t && t.length ? t : f.originalName
}

async function refreshFolders() {
  folders.value = await apiFetch<FolderRow[]>('/api/folders')
}

async function refreshFiles() {
  filesLoading.value = true
  try {
    const query: Record<string, string> = {}
    if (folderFilter.value === 'unfiled')
      query.folderId = 'unfiled'
    else if (folderFilter.value !== 'all')
      query.folderId = folderFilter.value
    files.value = await apiFetch<AppFile[]>('/api/files', { query })

    const sel = selectedFileId.value
    if (sel && !files.value.some(f => f.id === sel))
      void router.replace('/files').catch(() => {})
  }
  finally {
    filesLoading.value = false
  }
}

watch(folderFilter, () => {
  void router.push('/files').catch(() => {})
  void refreshFiles()
})

watch(listVersion, () => {
  void refreshFiles()
})

onMounted(async () => {
  await Promise.all([refreshFolders(), refreshFiles()])
})

function openFile(f: AppFile) {
  void router.push(`/files/${f.id}`)
}

function openFilePicker() {
  fileInput.value?.click()
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const raw = input.files?.[0]
  input.value = ''
  if (!raw)
    return
  uploading.value = true
  const form = new FormData()
  form.append('file', raw, raw.name)
  if (folderFilter.value !== 'all' && folderFilter.value !== 'unfiled')
    form.append('folderId', folderFilter.value)
  try {
    const created = await apiFetch<AppFile>('/api/files/upload', {
      method: 'POST',
      body: form,
    })
    await refreshFiles()
    void router.push(`/files/${created.id}?edit=1`)
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not upload file', color: 'error' })
  }
  finally {
    uploading.value = false
  }
}

const filteredFiles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q)
    return files.value
  return files.value.filter((f) => {
    const name = displayFileName(f).toLowerCase()
    const mime = String(f.mimeType ?? '').toLowerCase()
    return name.includes(q) || mime.includes(q)
  })
})

function formatFileSize(n: number) {
  if (!Number.isFinite(n) || n < 0)
    return '—'
  if (n < 1024)
    return `${n} B`
  const kb = n / 1024
  if (kb < 1024)
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

function cardClassesForFile(f: AppFile) {
  const active = selectedFileId.value === f.id && !!f.id
  const base = 'group flex w-full flex-col items-start rounded-[var(--ui-control-radius)] border px-4 py-3 text-left ring-1 transition-all'
  if (active)
    return `${base} border-zinc-900/15 bg-white ring-zinc-900/[0.06]`
  return `${base} border-transparent bg-white ring-zinc-950/[0.03] hover:border-zinc-200/80`
}

function tableRowClassesForFile(f: AppFile) {
  const active = selectedFileId.value === f.id
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
          placeholder="Search files…"
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
            All media
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === 'unfiled'
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = 'unfiled'"
          >
            <Icon name="i-lucide-folder-x" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
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
          Files
        </UiSectionLabel>
        <div class="flex shrink-0 items-center gap-2">
          <UButton variant="ghost" color="neutral" size="xs" class="rounded-[var(--ui-control-radius)]" @click="manageFields">
            Manage fields
          </UButton>
          <input ref="fileInput" type="file" class="hidden" @change="onFilePicked">
          <UButton
            size="xs"
            color="neutral"
            type="button"
            square
            :loading="uploading"
            icon="i-lucide-plus"
            aria-label="Upload file"
            class="rounded-[var(--ui-control-radius)] ring-1 ring-zinc-900/10"
            @click="openFilePicker"
          />
        </div>
      </div>
      <div
        v-if="filesLoading"
        class="ui-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4"
      >
        <div
          class="flex min-h-[12rem] flex-1 items-center justify-center py-16 text-zinc-400"
          role="status"
          aria-live="polite"
          aria-label="Loading files"
        >
          <Icon name="i-lucide-loader-circle" class="size-8 animate-spin" aria-hidden="true" />
        </div>
      </div>
      <div
        v-else-if="!files.length"
        class="ui-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4"
      >
        <div class="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12">
          <UiEmptyState
            icon="i-lucide-image"
            title="No files yet"
            description="Upload a file to start linking it to notes and contacts."
          />
        </div>
      </div>
      <template v-else-if="viewMode === 'cards'">
        <ul
          v-if="filteredFiles.length"
          class="ui-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4"
        >
          <li v-for="f in filteredFiles" :key="f.id">
            <button
              type="button"
              :class="cardClassesForFile(f)"
              @click="openFile(f)"
            >
              <span class="line-clamp-1 text-[13px] font-medium text-zinc-900">{{ displayFileName(f) }}</span>
              <span class="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">{{ f.mimeType }}</span>
            </button>
          </li>
        </ul>
        <div
          v-else
          class="ui-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4"
        >
          <div
            class="rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
          >
            No files match your filters.
          </div>
        </div>
      </template>
      <div v-else class="ui-scrollbar flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto px-3 pb-4">
        <table class="w-full min-w-[20rem] border-collapse text-left text-[13px]">
          <thead>
            <tr class="sticky top-0 z-[1] border-b border-zinc-200/80 bg-white/85 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 backdrop-blur-sm">
              <th class="px-2 py-2 font-semibold">
                Name
              </th>
              <th class="px-2 py-2 font-semibold">
                Type
              </th>
              <th class="hidden px-2 py-2 font-semibold md:table-cell">
                Size
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="f in filteredFiles"
              :key="f.id"
              class="border-b border-zinc-100/90"
              :class="tableRowClassesForFile(f)"
              @click="openFile(f)"
            >
              <td class="max-w-[12rem] truncate px-2 py-2 font-medium text-zinc-900">
                {{ displayFileName(f) }}
              </td>
              <td class="truncate px-2 py-2 text-[11px] uppercase tracking-wide text-zinc-500">
                {{ f.mimeType }}
              </td>
              <td class="hidden whitespace-nowrap tabular-nums px-2 py-2 text-zinc-600 md:table-cell">
                {{ formatFileSize(f.size) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="filteredFiles.length === 0"
          class="rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
        >
          No files match your filters.
        </div>
      </div>
    </template>

    <NuxtPage />
  </LayoutAppThreeColumn>

  <UiNewFolderDialog
    v-model:open="showNewFolder"
    v-model:name="newFolderName"
    :creating="creatingFolder"
    @submit="createFolder"
  />
</template>
