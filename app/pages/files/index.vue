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
  mimeType: string
  size: number
  shareEnabled: boolean
  shareToken: string | null
  shareUrl: string | null
  downloadUrl: string
}

const apiFetch = useRequestFetch()
const toast = useToast()
const folderFilter = ref<'all' | 'unfiled' | string>('all')
const folders = ref<FolderRow[]>([])
const files = ref<AppFile[]>([])
const selectedFileId = ref<string | null>(null)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const {
  newFolderName,
  showNewFolder,
  creatingFolder,
  createFolder,
} = useNewFolderModal(folders)

async function refreshFolders() {
  folders.value = await apiFetch<FolderRow[]>('/api/folders')
}

async function refreshFiles() {
  const query: Record<string, string> = {}
  if (folderFilter.value === 'unfiled') query.folderId = 'unfiled'
  else if (folderFilter.value !== 'all') query.folderId = folderFilter.value
  files.value = await apiFetch<AppFile[]>('/api/files', { query })
  if (!selectedFileId.value || !files.value.some(f => f.id === selectedFileId.value))
    selectedFileId.value = files.value[0]?.id ?? null
}

const selectedFile = computed(() => files.value.find(f => f.id === selectedFileId.value) ?? null)
const selectedFileIsImage = computed(() => selectedFile.value?.mimeType?.startsWith('image/'))

function openFilePicker() {
  fileInput.value?.click()
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  uploading.value = true
  const form = new FormData()
  form.append('file', file, file.name)
  if (folderFilter.value !== 'all' && folderFilter.value !== 'unfiled')
    form.append('folderId', folderFilter.value)
  try {
    await apiFetch('/api/files/upload', {
      method: 'POST',
      body: form,
    })
    await refreshFiles()
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not upload file', color: 'error' })
  }
  finally {
    uploading.value = false
    input.value = ''
  }
}

async function toggleFileShare(fileId: string, nextEnabled: boolean) {
  await apiFetch(`/api/files/${fileId}/share`, {
    method: nextEnabled ? 'POST' : 'DELETE',
    ...(nextEnabled ? { body: {} } : {}),
  })
  await refreshFiles()
}

async function deleteFileEverywhere(fileId: string) {
  await apiFetch(`/api/files/${fileId}`, { method: 'DELETE' })
  await refreshFiles()
}

watch(folderFilter, async () => {
  await refreshFiles()
})

onMounted(async () => {
  await Promise.all([refreshFolders(), refreshFiles()])
})
</script>

<template>
  <LayoutAppThreeColumn>
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
              ? 'bg-zinc-900 text-white shadow-sm'
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
              ? 'bg-zinc-900 text-white shadow-sm'
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
        <UiSectionLabel>
          Library
        </UiSectionLabel>
        <input ref="fileInput" type="file" class="hidden" @change="onFilePicked">
        <UButton
          size="xs"
          color="neutral"
          type="button"
          :loading="uploading"
          class="rounded-[var(--ui-control-radius)] px-3 shadow-sm ring-1 ring-zinc-900/10"
          @click="openFilePicker"
        >
          <Icon name="i-lucide-plus" class="mr-1 size-3.5" aria-hidden="true" />
          Upload
        </UButton>
      </div>
      <div class="ui-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-2">
        <ul v-if="files.length" class="space-y-2">
          <li v-for="f in files" :key="f.id">
            <button
              type="button"
              class="flex w-full flex-col items-start rounded-[var(--ui-control-radius)] border px-3 py-2 text-left transition-all"
              :class="selectedFileId === f.id
                ? 'border-zinc-900/20 bg-white shadow-sm ring-1 ring-zinc-900/[0.06]'
                : 'border-transparent bg-white/50 ring-1 ring-zinc-950/[0.03] hover:bg-white/80'"
              @click="selectedFileId = f.id"
            >
              <span class="line-clamp-1 text-[13px] font-medium text-zinc-900">{{ f.originalName }}</span>
              <span class="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">{{ f.mimeType }}</span>
            </button>
          </li>
        </ul>
        <UiEmptyState
          v-else
          icon="i-lucide-image"
          title="No files yet"
          description="Upload a file to start linking it to notes and contacts."
        />
      </div>
    </template>

    <div class="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-md ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/45">
        <div v-if="selectedFile" class="ui-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <FilesFileAttachmentItem
            :file="selectedFile"
            show-delete
            @delete="deleteFileEverywhere"
            @toggle-share="(fileId, nextEnabled) => toggleFileShare(fileId, nextEnabled)"
          />

          <div class="mt-5 rounded-[var(--ui-control-radius)] border border-zinc-200/80 bg-white/70 p-4">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Preview
            </p>
            <div v-if="selectedFileIsImage" class="mt-3">
              <img :src="selectedFile.downloadUrl" :alt="selectedFile.originalName" class="max-h-[24rem] w-full rounded-[var(--ui-control-radius)] object-contain ring-1 ring-zinc-200/80">
            </div>
            <div v-else class="mt-3 text-sm text-zinc-600">
              Preview is unavailable for this format. Use Download to open the file locally.
            </div>
          </div>
        </div>

        <div v-else class="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
          <UiEmptyState
            icon="i-lucide-image"
            title="Pick a file"
            description="Choose a file from Library to view details and actions."
          />
        </div>
      </div>
    </div>
  </LayoutAppThreeColumn>

  <UiNewFolderDialog
    v-model:open="showNewFolder"
    v-model:name="newFolderName"
    :creating="creatingFolder"
    @submit="createFolder"
  />
</template>
