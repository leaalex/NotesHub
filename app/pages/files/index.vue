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

type FileFieldRow = {
  id: string
  fileId: string
  templateId: string | null
  label: string
  fieldType: string
  value: string
  position: number
}

type FileDetail = AppFile & {
  fields: FileFieldRow[]
  linkedTasks?: { id: string, title: string, status: string, priority: string }[]
}

const apiFetch = useRequestFetch()
const toast = useToast()
const runtimeConfig = useRuntimeConfig()

const folderFilter = ref<'all' | 'unfiled' | string>('all')
const folders = ref<FolderRow[]>([])
const files = ref<AppFile[]>([])
const selectedFileId = ref<string | null>(null)
const fileDetail = ref<FileDetail | null>(null)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const isEditing = ref(false)
const finishingEdit = ref(false)
const showDeleteFileConfirm = ref(false)
const deletingFile = ref(false)

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

function viewDash(v: string | null | undefined) {
  const t = String(v ?? '').trim()
  return t.length ? t : '—'
}

function resolvedUrlHref(raw: string) {
  const t = raw.trim()
  if (!t)
    return ''
  try {
    const u = new URL(t.startsWith('//') ? `https:${t}` : t)
    if (u.protocol === 'http:' || u.protocol === 'https:')
      return u.href
    return ''
  }
  catch {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(t))
      return t
    return `https://${t}`
  }
}

const fileShareBannerUrl = computed(() => {
  const url = fileDetail.value?.shareUrl?.trim()
  if (url)
    return url
  const d = fileDetail.value
  if (!d?.shareEnabled || !d.shareToken)
    return ''
  const base = String(runtimeConfig.public.siteUrl ?? '').replace(/\/$/, '')
  return base ? `${base}/share/file/${d.shareToken}` : ''
})

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
    shareUrl: fileDetail.value?.shareUrl ?? base.shareUrl,
    shareEnabled: fileDetail.value?.shareEnabled ?? base.shareEnabled,
  }
})

const selectedFileIsImage = computed(() => selectedFile.value?.mimeType?.startsWith('image/'))

const detailTitleHeading = computed(() => {
  const f = fileDetail.value ?? selectedFile.value
  if (!f)
    return 'Untitled'
  const t = draftTitle.value.trim()
  return t.length ? t : displayFileName(f)
})

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
    selectedFileId.value = created.id
    await loadFileDetail(created.id)
    isEditing.value = true
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not upload file', color: 'error' })
  }
  finally {
    uploading.value = false
  }
}

async function enableFileShare() {
  const id = selectedFileId.value
  if (!id || !fileDetail.value)
    return
  try {
    const r = await apiFetch<{ url: string, shareToken: string }>(`/api/files/${id}/share`, {
      method: 'POST',
      body: {},
    })
    fileDetail.value.shareEnabled = true
    fileDetail.value.shareToken = r.shareToken
    fileDetail.value.shareUrl = r.url
    mergeListRow({
      id,
      shareEnabled: true,
      shareToken: r.shareToken,
      shareUrl: r.url,
    })
    await refreshFiles()
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not enable share link', color: 'error' })
  }
}

async function disableFileShare() {
  const id = selectedFileId.value
  if (!id || !fileDetail.value)
    return
  try {
    await apiFetch(`/api/files/${id}/share`, { method: 'DELETE' })
    fileDetail.value.shareEnabled = false
    fileDetail.value.shareToken = null
    fileDetail.value.shareUrl = null
    mergeListRow({
      id,
      shareEnabled: false,
      shareToken: null,
      shareUrl: null,
    })
    await refreshFiles()
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not disable share link', color: 'error' })
  }
}

async function copyFileShareLink() {
  const url = fileShareBannerUrl.value.trim()
  if (!url) {
    toast.add({
      title: 'No share link',
      description: 'Enable sharing first.',
      color: 'neutral',
    })
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: 'Link copied', color: 'success' })
  }
  catch {
    toast.add({
      title: 'Could not copy',
      description: 'Clipboard permission may be blocked.',
      color: 'error',
    })
  }
}

async function deleteFileEverywhere(fileId: string) {
  await apiFetch(`/api/files/${fileId}`, { method: 'DELETE' })
  if (selectedFileId.value === fileId)
    selectedFileId.value = null
  fileDetail.value = null
  await refreshFiles()
}

function requestDeleteFile() {
  showDeleteFileConfirm.value = true
}

async function confirmDeleteFile() {
  const id = selectedFileId.value
  if (!id)
    return
  deletingFile.value = true
  try {
    await deleteFileEverywhere(id)
    showDeleteFileConfirm.value = false
  }
  finally {
    deletingFile.value = false
  }
}

function mergeListRow(patch: Partial<AppFile> & { id: string }) {
  const i = files.value.findIndex(x => x.id === patch.id)
  if (i >= 0)
    files.value[i] = { ...files.value[i]!, ...patch } as AppFile
}

const linkTaskModal = ref(false)
const taskSearchRows = ref<{ id: string, title: string }[]>([])
const linkingTask = ref(false)

async function refreshLinkedTasks() {
  const id = selectedFileId.value
  if (!id || !fileDetail.value)
    return
  fileDetail.value.linkedTasks = await apiFetch<{ id: string, title: string, status: string, priority: string }[]>(`/api/files/${id}/tasks`)
}

async function openLinkTasks() {
  taskSearchRows.value = await apiFetch<{ id: string, title: string }[]>('/api/tasks')
  linkTaskModal.value = true
}

async function linkTaskToFile(taskId: string) {
  const id = selectedFileId.value
  if (!id || !fileDetail.value)
    return
  linkingTask.value = true
  try {
    await apiFetch(`/api/files/${id}/tasks/${taskId}`, { method: 'POST' })
    await refreshLinkedTasks()
    linkTaskModal.value = false
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not link task', color: 'error' })
  }
  finally {
    linkingTask.value = false
  }
}

async function unlinkTaskFromFile(taskId: string) {
  const id = selectedFileId.value
  if (!id)
    return
  await apiFetch(`/api/files/${id}/tasks/${taskId}`, { method: 'DELETE' })
  await refreshLinkedTasks()
}

async function loadFileDetail(id: string) {
  try {
    const d = await apiFetch<FileDetail>(`/api/files/${id}`)
    fileDetail.value = { ...d, linkedTasks: d.linkedTasks ?? [] }
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
  if (!isEditing.value)
    return
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
      linkedTasks: fileDetail.value.linkedTasks ?? [],
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
    if (!isEditing.value)
      return
    await persistFieldImmediate(fieldId, value)
  },
  450,
)

function onMetaTitleDescChange() {
  if (!isEditing.value)
    return
  persistFileDebounced.schedule()
}

function onFieldUpdate(fieldId: string, next: string) {
  if (!isEditing.value)
    return
  fieldVals[fieldId] = next
  persistFieldDebounced.schedule(fieldId, next)
}

async function finishEditing() {
  const id = selectedFileId.value
  if (!id || !fileDetail.value)
    return
  finishingEdit.value = true
  try {
    persistFileDebounced.cancel()
    persistFieldDebounced.cancel()

    const fieldBaseline = sortedDetailFields().map(f => ({
      id: f.id,
      baseline: f.value ?? '',
    }))

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
        linkedTasks: fileDetail.value.linkedTasks ?? [],
      }
      mergeListRow(updated)
    }
    catch (e) {
      console.error(e)
      toast.add({ title: 'Could not save file', color: 'error' })
      return
    }

    for (const { id: fid, baseline } of fieldBaseline) {
      const cur = fieldVals[fid] ?? ''
      if (cur === baseline)
        continue
      const ok = await persistFieldImmediate(fid, cur)
      if (!ok)
        return
    }
    isEditing.value = false
  }
  finally {
    finishingEdit.value = false
  }
}

watch(selectedFileId, (id, prev) => {
  isEditing.value = false
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
        <template v-if="selectedFile && attachmentFilePayload">
          <header class="flex shrink-0 flex-wrap items-start gap-3 border-b border-zinc-100/90 px-4 py-3 sm:px-6">
            <div class="min-w-0 flex-1">
              <template v-if="!isEditing">
                <h1 class="truncate text-xl font-semibold tracking-tight text-zinc-900 sm:text-[1.35rem]">
                  {{ detailTitleHeading }}
                </h1>
                <p class="mt-1 text-[11px] text-zinc-400">
                  {{ selectedFile.originalName }}
                </p>
              </template>
              <template v-else>
                <UInput
                  v-model="draftTitle"
                  placeholder="Title"
                  variant="ghost"
                  size="lg"
                  class="w-full font-semibold tracking-tight"
                  :ui="{ base: 'text-xl placeholder:text-zinc-300' }"
                  @update:model-value="onMetaTitleDescChange"
                />
                <p class="mt-1 text-[11px] text-zinc-400">
                  {{ selectedFile.originalName }}
                </p>
              </template>
            </div>
            <div class="flex shrink-0 flex-wrap items-center gap-1.5 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]">
              <UButton
                v-if="!fileDetail?.shareEnabled"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-link"
                class="rounded-[var(--ui-control-radius)] px-3"
                :disabled="!fileDetail"
                @click="enableFileShare"
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
                  @click="copyFileShareLink"
                >
                  Copy link
                </UButton>
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-link-2-off"
                  class="rounded-[var(--ui-control-radius)] px-3"
                  @click="disableFileShare"
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
                :disabled="!fileDetail"
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
                  :loading="deletingFile"
                  @click="requestDeleteFile"
                >
                  Delete
                </UButton>
              </template>
            </div>
          </header>

          <div
            v-if="fileShareBannerUrl"
            class="shrink-0 border-b border-emerald-100/90 bg-emerald-50/80 px-4 py-2 text-[11px] text-emerald-950 sm:px-6"
          >
            <span class="font-semibold text-emerald-900">Shared · </span>
            <span class="break-all font-mono text-emerald-900/90">{{ fileShareBannerUrl }}</span>
          </div>

          <div class="ui-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <FilesFileAttachmentItem
              :file="attachmentFilePayload"
              :show-share="false"
              :show-delete="isEditing"
              @delete="deleteFileEverywhere"
            />

            <div v-if="fileDetail" class="mt-6 space-y-5">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Description
                </p>
                <p v-if="!isEditing" class="mt-2 whitespace-pre-wrap text-[13px] text-zinc-900">
                  {{ viewDash(draftDescription) }}
                </p>
                <UTextarea
                  v-else
                  v-model="draftDescription"
                  class="mt-2 rounded-[var(--ui-control-radius)]"
                  autoresize
                  :max-rows="8"
                  @update:model-value="onMetaTitleDescChange"
                />
              </div>

              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Custom fields
                </p>
                <template v-if="!isEditing">
                  <div
                    v-for="f in sortedDetailFields()"
                    :key="f.id"
                    class="mt-3 rounded-[var(--ui-control-radius)] border border-zinc-100 bg-zinc-50/70 p-3"
                  >
                    <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {{ f.label }}
                      <span class="normal-case opacity-70"> · {{ f.fieldType }}</span>
                    </div>
                    <div class="mt-2 min-w-0 text-[13px] text-zinc-900">
                      <template v-if="f.fieldType === 'email' && String(f.value || '').trim()">
                        <a :href="`mailto:${String(f.value).trim()}`" class="font-medium underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700">
                          {{ String(f.value).trim() }}
                        </a>
                      </template>
                      <template v-else-if="f.fieldType === 'url' && String(f.value || '').trim()">
                        <a
                          :href="resolvedUrlHref(String(f.value))"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="break-all font-medium underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700"
                        >
                          {{ String(f.value).trim() }}
                        </a>
                      </template>
                      <p v-else-if="f.fieldType === 'longtext' || f.fieldType === 'address'" class="whitespace-pre-wrap">
                        {{ viewDash(f.value) }}
                      </p>
                      <template v-else>
                        {{ viewDash(f.value) }}
                      </template>
                    </div>
                  </div>
                  <p v-if="fileDetail.fields.length === 0" class="mt-2 text-[13px] text-zinc-400">
                    No custom fields. Add templates under Manage fields.
                  </p>
                </template>
                <template v-else>
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
                </template>
              </div>

              <div class="mt-6 rounded-[var(--ui-control-radius)] border border-zinc-100 bg-zinc-50/70 p-4">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Linked tasks
                  </p>
                  <button
                    v-if="isEditing"
                    type="button"
                    class="rounded-[var(--ui-control-radius)] px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-white/85"
                    @click="openLinkTasks"
                  >
                    + Link
                  </button>
                </div>
                <ul v-if="(fileDetail.linkedTasks ?? []).length" class="mt-3 space-y-2">
                  <li
                    v-for="t in fileDetail.linkedTasks"
                    :key="t.id"
                    class="flex items-center justify-between gap-2 rounded-[var(--ui-control-radius)] bg-white/60 px-3 py-2 text-[13px]"
                  >
                    <NuxtLink :to="`/tasks/${t.id}`" class="min-w-0 flex-1 font-medium text-zinc-800 hover:underline">
                      {{ t.title || 'Untitled' }}
                    </NuxtLink>
                    <button
                      v-if="isEditing"
                      type="button"
                      class="shrink-0 rounded-[var(--ui-control-radius)] p-1 text-zinc-400 hover:text-red-600"
                      aria-label="Unlink task"
                      @click="unlinkTaskFromFile(t.id)"
                    >
                      <Icon name="i-lucide-x" class="size-3.5" />
                    </button>
                  </li>
                </ul>
                <p v-else class="mt-3 text-[13px] text-zinc-400">
                  No linked tasks.
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
        </template>

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
      v-if="linkTaskModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 backdrop-blur-sm"
      @click.self="linkTaskModal = false"
    >
      <UCard class="max-h-[80vh] w-full max-w-md overflow-auto rounded-[var(--ui-panel-radius)]">
        <template #header>
          <span class="font-semibold">Link a task</span>
        </template>
        <ul class="space-y-1">
          <li v-for="t in taskSearchRows" :key="t.id">
            <button
              type="button"
              class="flex w-full rounded-[var(--ui-control-radius)] px-4 py-2.5 text-left text-[13px] hover:bg-zinc-100"
              :disabled="linkingTask"
              @click="linkTaskToFile(t.id)"
            >
              {{ t.title || 'Untitled' }}
            </button>
          </li>
        </ul>
        <template #footer>
          <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="linkTaskModal = false">
            Cancel
          </UButton>
        </template>
      </UCard>
    </div>
  </Teleport>

  <UiConfirmDeleteDialog
    v-model:open="showDeleteFileConfirm"
    title="Delete file"
    description="This file will be removed everywhere it is linked. This action cannot be undone."
    confirm-label="Delete"
    :loading="deletingFile"
    @confirm="confirmDeleteFile"
  />
</template>
