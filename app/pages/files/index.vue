<script setup lang="ts">
import { debouncedSchedule, debouncedScheduleArgs } from '#shared/debounced-schedule'

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

type FileTemplateRow = {
  id: string
  label: string
  fieldType: string
  position: number
}

type FileFieldRow = {
  id: string
  fileId: string
  templateId: string | null
  label: string
  fieldType: string
  value: string
  position: number
}

type FileDetail = AppFile & { fields: FileFieldRow[] }

const apiFetch = useRequestFetch()
const toast = useToast()
const folderFilter = ref<'all' | 'unfiled' | string>('all')
const folders = ref<FolderRow[]>([])
const files = ref<AppFile[]>([])
const selectedFileId = ref<string | null>(null)
const fileDetail = ref<FileDetail | null>(null)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

/** Upload metadata modal */
const showUploadMeta = ref(false)
const pendingUploadFile = ref<File | null>(null)
const uploadTitle = ref('')
const uploadDescription = ref('')
const uploadTemplates = ref<FileTemplateRow[]>([])
const uploadFieldValues = reactive<Record<string, string>>({})

const draftTitle = ref('')
const draftDescription = ref('')
const fieldVals = reactive<Record<string, string>>({})

const {
  newFolderName,
  showNewFolder,
  creatingFolder,
  createFolder,
} = useNewFolderModal(folders)

function displayFileName(f: AppFile) {
  const t = f.title?.trim()
  return t && t.length ? t : f.originalName
}

async function refreshFolders() {
  folders.value = await apiFetch<FolderRow[]>('/api/folders')
}

async function refreshFiles() {
  const query: Record<string, string> = {}
  if (folderFilter.value === 'unfiled') query.folderId = 'unfiled'
  else if (folderFilter.value !== 'all') query.folderId = folderFilter.value
  files.value = await apiFetch<AppFile[]>('/api/files', { query })
  if (selectedFileId.value && !files.value.some(f => f.id === selectedFileId.value))
    selectedFileId.value = null
}

const selectedFile = computed(() => files.value.find(f => f.id === selectedFileId.value) ?? null)
const attachmentFilePayload = computed(() => {
  const base = selectedFile.value
  if (!base)
    return null
  const t = fileDetail.value?.title ?? base.title
  return {
    ...base,
    title: (t ?? '').trim() ? t : '',
  }
})
const selectedFileIsImage = computed(() => selectedFile.value?.mimeType?.startsWith('image/'))

function openFilePicker() {
  fileInput.value?.click()
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const raw = input.files?.[0]
  input.value = ''
  if (!raw)
    return
  pendingUploadFile.value = raw
  uploadTitle.value = raw.name
  uploadDescription.value = ''
  for (const k of Object.keys(uploadFieldValues))
    delete uploadFieldValues[k]
  try {
    uploadTemplates.value = await apiFetch<FileTemplateRow[]>('/api/file-field-templates')
    for (const t of uploadTemplates.value)
      uploadFieldValues[t.id] = ''
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not load field templates', color: 'error' })
    pendingUploadFile.value = null
    return
  }
  showUploadMeta.value = true
}

function cancelUploadMeta() {
  showUploadMeta.value = false
  pendingUploadFile.value = null
}

async function confirmUploadMeta() {
  const file = pendingUploadFile.value
  if (!file)
    return
  uploading.value = true
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('title', uploadTitle.value.trim())
  form.append('description', uploadDescription.value.trim())
  form.append('fieldValues', JSON.stringify(uploadFieldValues))
  if (folderFilter.value !== 'all' && folderFilter.value !== 'unfiled')
    form.append('folderId', folderFilter.value)
  try {
    const created = await apiFetch<AppFile>('/api/files/upload', {
      method: 'POST',
      body: form,
    })
    cancelUploadMeta()
    await refreshFiles()
    selectedFileId.value = created.id
    await loadFileDetail(created.id)
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not upload file', color: 'error' })
  }
  finally {
    uploading.value = false
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
  if (selectedFileId.value === fileId)
    selectedFileId.value = null
  fileDetail.value = null
  await refreshFiles()
}

function mergeListRow(patch: Partial<AppFile> & { id: string }) {
  const i = files.value.findIndex(x => x.id === patch.id)
  if (i >= 0)
    files.value[i] = { ...files.value[i]!, ...patch } as AppFile
}

async function loadFileDetail(id: string) {
  try {
    const d = await apiFetch<FileDetail>(`/api/files/${id}`)
    fileDetail.value = d
    draftTitle.value = d.title
    draftDescription.value = d.description
    for (const k of Object.keys(fieldVals))
      delete fieldVals[k]
    for (const f of d.fields)
      fieldVals[f.id] = f.value
    mergeListRow({ id: d.id, title: d.title, description: d.description })
  }
  catch (e) {
    console.error(e)
    fileDetail.value = null
    toast.add({ title: 'Could not load file detail', color: 'error' })
  }
}

const persistFileDebounced = debouncedSchedule(async () => {
  const id = selectedFileId.value
  if (!id || !fileDetail.value)
    return
  try {
    const updated = await apiFetch<AppFile>(`/api/files/${id}`, {
      method: 'PATCH',
      body: {
        title: draftTitle.value,
        description: draftDescription.value,
      },
    })
    fileDetail.value = {
      ...fileDetail.value,
      ...updated,
      fields: fileDetail.value.fields,
    }
    mergeListRow(updated)
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not save file', color: 'error' })
  }
}, 450)

async function persistFieldImmediate(fieldId: string, value: string): Promise<boolean> {
  const fid = fileDetail.value?.id
  if (!fid)
    return false
  try {
    await apiFetch(`/api/files/${fid}/fields/${fieldId}`, {
      method: 'PATCH',
      body: { value },
    })
    const f = fileDetail.value?.fields.find(x => x.id === fieldId)
    if (f)
      f.value = value
    return true
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not save field', color: 'error' })
    return false
  }
}

const persistFieldDebounced = debouncedScheduleArgs(
  async (fieldId: string, value: string) => {
    await persistFieldImmediate(fieldId, value)
  },
  450,
)

function onMetaTitleDescChange() {
  persistFileDebounced.schedule()
}

function onFieldUpdate(fieldId: string, next: string) {
  fieldVals[fieldId] = next
  persistFieldDebounced.schedule(fieldId, next)
}

watch(selectedFileId, (id, prev) => {
  persistFileDebounced.cancel()
  persistFieldDebounced.cancel()
  if (!id) {
    fileDetail.value = null
    draftTitle.value = ''
    draftDescription.value = ''
    for (const k of Object.keys(fieldVals))
      delete fieldVals[k]
    return
  }
  if (prev && prev !== id) {
    for (const k of Object.keys(fieldVals))
      delete fieldVals[k]
  }
  void loadFileDetail(id)
})

function sortedDetailFields(): FileFieldRow[] {
  const list = fileDetail.value?.fields ?? []
  return [...list].sort((a, b) =>
    a.position !== b.position ? a.position - b.position : a.label.localeCompare(b.label),
  )
}

watch(folderFilter, async () => {
  await refreshFiles()
})

onMounted(async () => {
  await Promise.all([refreshFolders(), refreshFiles()])
})

function previewAlt() {
  const f = fileDetail.value ?? selectedFile.value
  if (!f)
    return ''
  return displayFileName(f)
}
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
      <div class="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-4">
        <UiSectionLabel>
          Library
        </UiSectionLabel>
        <div class="flex shrink-0 items-center gap-2">
          <NuxtLink
            to="/files/templates"
            class="rounded-[var(--ui-control-radius)] px-3 py-1.5 text-[12px] font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-[4px] hover:text-zinc-900"
          >
            Manage fields
          </NuxtLink>
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
              <span class="line-clamp-1 text-[13px] font-medium text-zinc-900">{{ displayFileName(f) }}</span>
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
        <div v-if="selectedFile && attachmentFilePayload" class="ui-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <FilesFileAttachmentItem
            :file="attachmentFilePayload"
            show-delete
            @delete="deleteFileEverywhere"
            @toggle-share="(fileId, nextEnabled) => toggleFileShare(fileId, nextEnabled)"
          />

          <div v-if="fileDetail" class="mt-6 space-y-5">
            <UFormField label="Title">
              <UInput
                v-model="draftTitle"
                class="rounded-[var(--ui-control-radius)]"
                @update:model-value="onMetaTitleDescChange"
              />
            </UFormField>
            <UFormField label="Description">
              <UTextarea
                v-model="draftDescription"
                class="rounded-[var(--ui-control-radius)]"
                autoresize
                :max-rows="8"
                @update:model-value="onMetaTitleDescChange"
              />
            </UFormField>

            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Custom fields
              </p>
              <div v-for="f in sortedDetailFields()" :key="f.id" class="mt-3 rounded-[var(--ui-control-radius)] border border-zinc-100 bg-zinc-50/70 p-3">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  {{ f.label }}
                  <span class="normal-case opacity-70"> · {{ f.fieldType }}</span>
                </div>
                <UTextarea
                  v-if="f.fieldType === 'longtext' || f.fieldType === 'address'"
                  :model-value="fieldVals[f.id]"
                  class="mt-2 w-full rounded-[var(--ui-control-radius)]"
                  autoresize
                  :max-rows="8"
                  @update:model-value="v => onFieldUpdate(f.id, v ?? '')"
                />
                <UInput
                  v-else-if="f.fieldType === 'date'"
                  :model-value="fieldVals[f.id]"
                  type="date"
                  class="mt-2 w-full rounded-[var(--ui-control-radius)]"
                  @update:model-value="v => onFieldUpdate(f.id, v ?? '')"
                />
                <UInput
                  v-else
                  :model-value="fieldVals[f.id]"
                  class="mt-2 w-full rounded-[var(--ui-control-radius)]"
                  :type="f.fieldType === 'email' ? 'email' : f.fieldType === 'url' ? 'url' : 'text'"
                  @update:model-value="v => onFieldUpdate(f.id, v ?? '')"
                />
              </div>
              <p v-if="fileDetail.fields.length === 0" class="mt-2 text-[13px] text-zinc-400">
                No custom fields. Add templates under Manage fields.
              </p>
            </div>
          </div>
          <div v-else class="mt-4 text-[13px] text-zinc-400">
            Loading details…
          </div>

          <div class="mt-8 rounded-[var(--ui-control-radius)] border border-zinc-200/80 bg-white/70 p-4">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Preview
            </p>
            <div v-if="selectedFileIsImage && selectedFile" class="mt-3">
              <img :src="selectedFile.downloadUrl" :alt="previewAlt()" class="max-h-[24rem] w-full rounded-[var(--ui-control-radius)] object-contain ring-1 ring-zinc-200/80">
            </div>
            <div v-else class="mt-3 text-sm text-zinc-600">
              Preview is unavailable for this format. Use Download to open the file locally.
            </div>
          </div>
        </div>

        <div v-else class="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
          <UiEmptyState
            icon="i-lucide-file"
            title="No file selected"
            description="Pick a file from the list on the left or upload a new one."
          >
            <template #actions>
              <UButton
                color="neutral"
                :loading="uploading"
                class="rounded-[var(--ui-control-radius)] px-4 shadow-sm ring-1 ring-zinc-900/10"
                @click="openFilePicker"
              >
                <Icon name="i-lucide-upload" class="mr-2 size-4" aria-hidden="true" />
                Upload file
              </UButton>
            </template>
          </UiEmptyState>
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

  <Teleport to="body">
    <div
      v-if="showUploadMeta"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-[2px]"
      @click.self="cancelUploadMeta"
    >
      <UCard class="max-h-[min(90dvh,640px)] w-full max-w-lg overflow-hidden overflow-y-auto rounded-[var(--ui-panel-radius)] border border-white/60 bg-white/90 shadow-2xl shadow-zinc-950/15 ring-1 ring-zinc-950/[0.06] backdrop-blur-xl">
        <template #header>
          <span class="font-semibold tracking-tight text-zinc-900">File details</span>
        </template>
        <div class="space-y-4">
          <UFormField label="Title" required>
            <UInput v-model="uploadTitle" class="rounded-[var(--ui-control-radius)]" />
          </UFormField>
          <UFormField label="Description">
            <UTextarea v-model="uploadDescription" class="rounded-[var(--ui-control-radius)]" autoresize :max-rows="6" />
          </UFormField>
          <template v-if="uploadTemplates.length">
            <div
              v-for="tpl in [...uploadTemplates].sort((a, b) =>
                a.position !== b.position ? a.position - b.position : a.label.localeCompare(b.label),
              )"
              :key="tpl.id"
            >
              <UFormField :label="`${tpl.label} (${tpl.fieldType})`">
                <UInput
                  v-if="tpl.fieldType !== 'longtext' && tpl.fieldType !== 'address' && tpl.fieldType !== 'date'"
                  v-model="uploadFieldValues[tpl.id]"
                  class="rounded-[var(--ui-control-radius)]"
                  :type="tpl.fieldType === 'email' ? 'email' : tpl.fieldType === 'url' ? 'url' : 'text'"
                />
                <UInput
                  v-else-if="tpl.fieldType === 'date'"
                  v-model="uploadFieldValues[tpl.id]"
                  type="date"
                  class="rounded-[var(--ui-control-radius)]"
                />
                <UTextarea
                  v-else
                  v-model="uploadFieldValues[tpl.id]"
                  class="rounded-[var(--ui-control-radius)]"
                  autoresize
                  :max-rows="5"
                />
              </UFormField>
            </div>
          </template>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="cancelUploadMeta">
              Cancel
            </UButton>
            <UButton color="neutral" class="rounded-[var(--ui-control-radius)]" :loading="uploading" @click="confirmUploadMeta">
              Upload
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </Teleport>
</template>
