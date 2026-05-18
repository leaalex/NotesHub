<script setup lang="ts">
import { debouncedSchedule, debouncedScheduleArgs } from '#shared/debounced-schedule'

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
  shareIncludeLinks?: boolean
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
  linkedTasks?: { id: string, title: string, status: string, priority: string, shareEnabled?: boolean, shareToken?: string | null }[]
}

const route = useRoute()
const router = useRouter()
const apiFetch = useRequestFetch()
const toast = useToast()
const { isBusy: isFileLinkedTaskShareBusy, toggleShare: toggleFileLinkedTaskShare } = useEntityShareToggle()
const runtimeConfig = useRuntimeConfig()

const listVersion = useState<number>('files:listVersion', () => 0)

function bumpFilesList() {
  listVersion.value++
}

const fileId = computed(() => String(route.params.id ?? ''))

const fileDetail = ref<FileDetail | null>(null)
const detailLoading = ref(false)
const isEditing = ref(false)
const finishingEdit = ref(false)
const showDeleteFileConfirm = ref(false)
const deletingFile = ref(false)

const draftTitle = ref('')
const draftDescription = ref('')
const fieldVals = reactive<Record<string, string>>({})

const linkTaskModal = ref(false)
const taskSearchRows = ref<{ id: string, title: string }[]>([])
const linkingTask = ref(false)

function displayFileName(f: Pick<AppFile, 'title' | 'originalName'>) {
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

const attachmentFilePayload = computed(() => {
  const d = fileDetail.value
  if (!d)
    return null
  const t = d.title
  return {
    id: d.id,
    originalName: d.originalName,
    title: (t ?? '').trim() ? t : '',
    description: d.description,
    mimeType: d.mimeType,
    size: d.size,
    shareEnabled: d.shareEnabled,
    shareToken: d.shareToken,
    shareUrl: d.shareUrl,
    downloadUrl: d.downloadUrl,
  }
})

const selectedFileIsImage = computed(() => fileDetail.value?.mimeType?.startsWith('image/'))

const detailTitleHeading = computed(() => {
  const f = fileDetail.value
  if (!f)
    return 'Untitled'
  const t = draftTitle.value.trim()
  return t.length ? t : displayFileName(f)
})

async function enableFileShare() {
  const id = fileId.value
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
    bumpFilesList()
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not enable share link', color: 'error' })
  }
}

async function disableFileShare() {
  const id = fileId.value
  if (!id || !fileDetail.value)
    return
  try {
    await apiFetch(`/api/files/${id}/share`, { method: 'DELETE' })
    fileDetail.value.shareEnabled = false
    fileDetail.value.shareToken = null
    fileDetail.value.shareUrl = null
    bumpFilesList()
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not disable share link', color: 'error' })
  }
}

async function toggleAttachmentFileShare(fid: string, nextEnabled: boolean) {
  const current = fileId.value
  if (!current || fid !== current || !fileDetail.value)
    return
  if (nextEnabled)
    await enableFileShare()
  else
    await disableFileShare()
}

const fileShareIncludeLinks = ref(true)
watch(
  fileDetail,
  (d) => {
    fileShareIncludeLinks.value = d?.shareIncludeLinks ?? true
  },
  { immediate: true, deep: true },
)

async function onFileShareIncludeLinksChange(value: boolean) {
  const id = fileId.value
  const d = fileDetail.value
  if (!id || !d)
    return
  const prev = d.shareIncludeLinks ?? true
  fileShareIncludeLinks.value = value
  d.shareIncludeLinks = value
  try {
    await apiFetch(`/api/files/${id}`, {
      method: 'PATCH',
      body: { shareIncludeLinks: value },
    })
  }
  catch (e) {
    console.error(e)
    fileShareIncludeLinks.value = prev
    if (fileDetail.value)
      fileDetail.value.shareIncludeLinks = prev
    toast.add({ title: 'Could not update share settings', color: 'error' })
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

async function deleteFileEverywhere(fid: string) {
  await apiFetch(`/api/files/${fid}`, { method: 'DELETE' })
  bumpFilesList()
  await router.push('/files')
}

function requestDeleteFile() {
  showDeleteFileConfirm.value = true
}

async function confirmDeleteFile() {
  const id = fileId.value
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

async function onFileLinkedTaskShareToggle(
  t: NonNullable<FileDetail['linkedTasks']>[number],
  nextEnabled: boolean,
) {
  const prevE = t.shareEnabled ?? false
  const prevT = t.shareToken ?? null
  try {
    const r = await toggleFileLinkedTaskShare('task', t.id, nextEnabled)
    t.shareEnabled = r.shareEnabled
    t.shareToken = r.shareToken
  }
  catch {
    t.shareEnabled = prevE
    t.shareToken = prevT
  }
}

async function refreshLinkedTasks() {
  const id = fileId.value
  if (!id || !fileDetail.value)
    return
  fileDetail.value.linkedTasks = await apiFetch<NonNullable<FileDetail['linkedTasks']>>(`/api/files/${id}/tasks`)
}

async function openLinkTasks() {
  taskSearchRows.value = await apiFetch<{ id: string, title: string }[]>('/api/tasks')
  linkTaskModal.value = true
}

async function linkTaskToFile(taskId: string) {
  const id = fileId.value
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
  const id = fileId.value
  if (!id)
    return
  await apiFetch(`/api/files/${id}/tasks/${taskId}`, { method: 'DELETE' })
  await refreshLinkedTasks()
}

async function loadFileDetail(id: string): Promise<boolean> {
  try {
    const d = await apiFetch<FileDetail>(`/api/files/${id}`)
    fileDetail.value = { ...d, linkedTasks: d.linkedTasks ?? [] }
    draftTitle.value = d.title
    draftDescription.value = d.description
    for (const k of Object.keys(fieldVals))
      delete fieldVals[k]
    for (const f of d.fields)
      fieldVals[f.id] = f.value
    return true
  }
  catch (e) {
    console.error(e)
    fileDetail.value = null
    toast.add({ title: 'Could not load file detail', color: 'error' })
    void router.replace('/files').catch(() => {})
    return false
  }
}

const persistFileDebounced = debouncedSchedule(async () => {
  if (!isEditing.value)
    return
  const id = fileId.value
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
    bumpFilesList()
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not save file', color: 'error' })
  }
}, 450)

async function persistFieldImmediate(fieldRowId: string, value: string): Promise<boolean> {
  const fid = fileDetail.value?.id
  if (!fid)
    return false
  try {
    await apiFetch(`/api/files/${fid}/fields/${fieldRowId}`, {
      method: 'PATCH',
      body: { value },
    })
    const f = fileDetail.value?.fields.find(x => x.id === fieldRowId)
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
  async (fieldRowId: string, value: string) => {
    if (!isEditing.value)
      return
    await persistFieldImmediate(fieldRowId, value)
  },
  450,
)

function onMetaTitleDescChange() {
  if (!isEditing.value)
    return
  persistFileDebounced.schedule()
}

function onFieldUpdate(fieldRowId: string, next: string) {
  if (!isEditing.value)
    return
  fieldVals[fieldRowId] = next
  persistFieldDebounced.schedule(fieldRowId, next)
}

async function finishEditing() {
  const id = fileId.value
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
      bumpFilesList()
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

function sortedDetailFields(): FileFieldRow[] {
  const list = fileDetail.value?.fields ?? []
  return [...list].sort((a, b) =>
    a.position !== b.position ? a.position - b.position : a.label.localeCompare(b.label),
  )
}

function previewAlt() {
  const f = fileDetail.value
  if (!f)
    return ''
  return displayFileName(f)
}

watch(
  fileId,
  async (id, prev) => {
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
    fileDetail.value = null
    detailLoading.value = true
    try {
      const ok = await loadFileDetail(id)
      if (ok && route.query.edit === '1') {
        isEditing.value = true
        await router.replace({ path: `/files/${id}` }).catch(() => {})
      }
    }
    finally {
      detailLoading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="detailLoading"
    class="flex min-w-0 flex-1 flex-col items-center justify-center px-8 py-12 text-center text-[13px] text-zinc-400"
  >
    Loading…
  </div>
  <main v-else-if="fileDetail" class="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--ui-panel-radius)] border border-zinc-100 bg-white ring-1 ring-zinc-950/[0.04]">
      <header class="flex shrink-0 flex-wrap items-start gap-3 border-b border-zinc-100/90 px-4 py-3 sm:px-6">
        <div class="min-w-0 flex-1">
          <template v-if="!isEditing">
            <h1 class="truncate text-xl font-semibold tracking-tight text-zinc-900 sm:text-[1.35rem]">
              {{ detailTitleHeading }}
            </h1>
            <p class="mt-1 text-[11px] text-zinc-400">
              {{ fileDetail.originalName }}
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
              {{ fileDetail.originalName }}
            </p>
          </template>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-1.5 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]">
          <UButton
            v-if="!fileDetail.shareEnabled"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-link"
            class="rounded-[var(--ui-control-radius)] px-3"
            @click="enableFileShare"
          >
            Share
          </UButton>
          <template v-else>
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
            @click="isEditing = true"
          >
            Edit
          </UButton>
          <template v-else>
            <UButton
              icon="i-lucide-check"
              color="success"
              variant="soft"
              size="xs"
              class="ui-done-btn rounded-[var(--ui-control-radius)] px-3"
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
        <div class="flex flex-wrap items-center gap-3">
          <span class="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
            <span class="shrink-0 font-semibold text-emerald-900">Shared ·</span>
            <span class="min-w-0 break-all font-mono text-emerald-900/90">{{ fileShareBannerUrl }}</span>
          </span>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-copy"
            class="rounded-[var(--ui-control-radius)]"
            @click="copyFileShareLink"
          >
            Copy
          </UButton>
          <USwitch
            :model-value="fileShareIncludeLinks"
            label="Include links"
            size="xs"
            @update:model-value="onFileShareIncludeLinksChange"
          />
        </div>
      </div>

      <div class="relative flex min-h-0 flex-1 overflow-hidden">
        <div class="ui-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-10 pt-2 sm:px-8">
          <FilesFileAttachmentItem
            v-if="attachmentFilePayload"
            :file="attachmentFilePayload"
            :show-share="true"
            :show-delete="isEditing"
            @delete="deleteFileEverywhere"
            @toggle-share="toggleAttachmentFileShare"
          />

          <div class="mt-6">
            <div>
              <UiSectionLabel>
                Description
              </UiSectionLabel>
              <div class="mt-3">
              <p v-if="!isEditing" class="whitespace-pre-wrap text-[13px] text-zinc-900">
                {{ viewDash(draftDescription) }}
              </p>
              <UTextarea
                v-else
                v-model="draftDescription"
                class="w-full rounded-[var(--ui-control-radius)]"
                autoresize
                :max-rows="8"
                @update:model-value="onMetaTitleDescChange"
              />
            </div>
          </div>

          <div id="file-section-fields" class="mt-8 border-t border-zinc-100/90 pt-6">
            <UiSectionLabel>
              Custom fields
            </UiSectionLabel>
            <div class="mt-3">
              <template v-if="!isEditing">
                <div
                  v-for="f in sortedDetailFields()"
                  :key="f.id"
                  class="mb-4 rounded-[var(--ui-control-radius)] border border-zinc-100 bg-white p-3 last:mb-0"
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
                    <p v-else-if="f.fieldType === 'longtext'" class="whitespace-pre-wrap">
                      {{ viewDash(f.value) }}
                    </p>
                    <template v-else>
                      {{ viewDash(f.value) }}
                    </template>
                  </div>
                </div>
                <p v-if="fileDetail.fields.length === 0" class="text-[13px] text-zinc-400">
                  No custom fields. Add templates under Manage fields.
                </p>
              </template>
              <template v-else>
                <div
                  v-for="f in sortedDetailFields()"
                  :key="f.id"
                  class="mb-4 flex flex-wrap items-start gap-2 rounded-[var(--ui-control-radius)] border border-zinc-100 bg-white p-3"
                >
                  <div class="min-w-0 flex-1">
                    <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {{ f.label }}
                      <span class="normal-case opacity-70"> · {{ f.fieldType }}</span>
                    </div>
                    <UTextarea
                      v-if="f.fieldType === 'longtext'"
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
                </div>
                <p v-if="fileDetail.fields.length === 0" class="text-[13px] text-zinc-400">
                  No custom fields. Add templates under Manage fields.
                </p>
              </template>
            </div>
          </div>
          </div>

          <div class="mt-8 rounded-[var(--ui-control-radius)] border border-zinc-200/80 bg-white/70 p-4">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Preview
            </p>
            <div v-if="selectedFileIsImage" class="mt-3">
              <img :src="fileDetail.downloadUrl" :alt="previewAlt()" class="max-h-[24rem] w-full rounded-[var(--ui-control-radius)] object-contain ring-1 ring-zinc-200/80">
            </div>
            <div v-else class="mt-3 text-sm text-zinc-600">
              Preview is unavailable for this format. Use Download to open the file locally.
            </div>
          </div>
        </div>

        <aside
          class="ui-scrollbar hidden w-[17rem] shrink-0 overflow-y-auto border-l border-zinc-100/90 bg-white/20 px-3 py-5 xl:flex xl:flex-col xl:gap-0"
        >
          <div class="mt-8 shrink-0 border-t border-zinc-100/80 pt-5 xl:mt-0 xl:border-t-0 xl:pt-0">
            <div class="flex items-center justify-between gap-2">
              <UiSectionLabel>
                Linked tasks
              </UiSectionLabel>
              <button
                v-if="isEditing"
                type="button"
                class="rounded-[var(--ui-control-radius)] px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-white/85"
                @click="openLinkTasks"
              >
                + Link
              </button>
            </div>
            <ul v-if="(fileDetail.linkedTasks ?? []).length" class="mt-3 flex flex-col gap-2">
              <li
                v-for="t in fileDetail.linkedTasks"
                :key="t.id"
                class="flex items-start gap-1"
              >
                <ShareLinkedShareRow
                  class="min-w-0 flex-1"
                  kind="task"
                  :entity-id="t.id"
                  :title="t.title || 'Untitled'"
                  :subtitle="`${t.status.replaceAll('_', ' ')} · ${t.priority}`"
                  :to="`/tasks/${t.id}`"
                  :share-enabled="t.shareEnabled ?? false"
                  :share-token="t.shareToken ?? null"
                  :busy="isFileLinkedTaskShareBusy('task', t.id)"
                  @toggle="onFileLinkedTaskShareToggle(t, $event)"
                />
                <button
                  v-if="isEditing"
                  type="button"
                  class="mt-0.5 shrink-0 rounded-[var(--ui-control-radius)] p-1 text-zinc-400 hover:text-red-600"
                  aria-label="Unlink task"
                  @click="unlinkTaskFromFile(t.id)"
                >
                  <Icon name="i-lucide-x" class="size-3.5" />
                </button>
              </li>
            </ul>
            <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
              No linked tasks.
            </p>
          </div>
        </aside>
      </div>
    </div>
  </main>
  <div
    v-else
    class="flex min-w-0 flex-1 flex-col items-center justify-center px-8 py-12 text-[13px] text-zinc-400"
    aria-busy="true"
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
