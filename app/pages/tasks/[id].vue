<script setup lang="ts">
import { debouncedSchedule, debouncedScheduleArgs } from '#shared/debounced-schedule'

type FieldRow = {
  id: string
  templateId: string | null
  label: string
  fieldType: string
  value: string
  position: number
}

type AppFile = {
  id: string
  originalName: string
  title?: string
  mimeType: string
  size: number
  shareEnabled: boolean
  shareToken: string | null
  shareUrl: string | null
  downloadUrl: string
}

type TaskDetail = {
  id: string
  userId: string
  folderId: string | null
  parentId: string | null
  title: string
  description: string
  status: string
  priority: string
  dueAt: string | Date | null
  completedAt: string | Date | null
  position: number
  shareEnabled?: boolean
  shareToken?: string | null
  shareExpiresAt?: string | Date | null
  fields: FieldRow[]
  linkedNotes: { id: string, title: string }[]
  linkedContacts: { id: string, displayName: string, type: string }[]
  linkedFiles: AppFile[]
  children: { id: string, title: string, status: string, priority: string }[]
}

type TemplateRow = { id: string, label: string, fieldType: string }
type NoteSearch = { id: string, title: string }
type ContactSearch = { id: string, displayName: string }
type FileSearch = { id: string, originalName: string, title?: string }

const route = useRoute()
const router = useRouter()
const toast = useToast()
const apiFetch = useRequestFetch()
const runtimeConfig = useRuntimeConfig()

const listVersion = useState<number>('tasks:listVersion', () => 0)
function bumpList() {
  listVersion.value++
}

const taskShareUrl = ref('')
const hydrating = ref(true)
const detail = ref<TaskDetail | null>(null)
const isEditing = ref(false)
const finishingEdit = ref(false)

const templates = ref<TemplateRow[]>([])
const coreTitle = ref('')
const coreDesc = ref('')
const coreStatus = ref('todo')
const corePriority = ref('normal')
const deleting = ref(false)
const showDeleteConfirm = ref(false)
const showDeleteFieldConfirm = ref(false)
const pendingFieldId = ref<string | null>(null)
const removingField = ref(false)
const taskDetailScroll = ref<HTMLElement | null>(null)

const fieldVals = reactive<Record<string, string>>({})
const showAddField = ref(false)
const newFieldLabel = ref('')
const newFieldType = ref('text')

const linkNoteModal = ref(false)
const linkContactModal = ref(false)
const linkFileModal = ref(false)
const noteSearchRows = ref<NoteSearch[]>([])
const contactSearchRows = ref<ContactSearch[]>([])
const fileSearchRows = ref<FileSearch[]>([])
const linking = ref(false)

const statusOpts = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]
const priorityOpts = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
]

function dueLocal(d: string | Date | null | undefined): string {
  if (!d)
    return ''
  const x = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(x.getTime()))
    return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}

const coreDueLocal = ref('')

const dueDisplayReadonly = computed(() => {
  if (!coreDueLocal.value.trim())
    return '—'
  const d = new Date(coreDueLocal.value)
  if (Number.isNaN(d.getTime()))
    return '—'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
})

function syncTaskShareUrl() {
  const d = detail.value
  if (!d?.shareEnabled || !d.shareToken) {
    taskShareUrl.value = ''
    return
  }
  const base = String(runtimeConfig.public.siteUrl ?? '').replace(/\/$/, '')
  taskShareUrl.value = base ? `${base}/share/task/${d.shareToken}` : ''
}

async function enableShare() {
  if (!detail.value)
    return
  try {
    const r = await apiFetch<{ url: string, shareToken: string }>(`/api/tasks/${detail.value.id}/share`, { method: 'POST', body: {} })
    taskShareUrl.value = r.url
    detail.value.shareEnabled = true
    detail.value.shareToken = r.shareToken
  }
  catch (e: unknown) {
    console.error(e)
    toast.add({ title: 'Could not enable share link', color: 'error' })
  }
}

async function disableShare() {
  if (!detail.value)
    return
  try {
    await apiFetch(`/api/tasks/${detail.value.id}/share`, { method: 'DELETE' })
    taskShareUrl.value = ''
    detail.value.shareEnabled = false
    detail.value.shareToken = null
    detail.value.shareExpiresAt = null
  }
  catch (e: unknown) {
    console.error(e)
    toast.add({ title: 'Could not disable share link', color: 'error' })
  }
}

async function copyShareLink() {
  syncTaskShareUrl()
  const url = taskShareUrl.value.trim()
  if (!url) {
    toast.add({ title: 'No share link', description: 'Enable sharing first.', color: 'neutral' })
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: 'Link copied', color: 'success' })
  }
  catch {
    toast.add({ title: 'Could not copy', color: 'error' })
  }
}

watch(detail, syncTaskShareUrl, { deep: true })

function refreshFieldVals(rows: FieldRow[]) {
  for (const k of Object.keys(fieldVals))
    delete fieldVals[k]
  rows.forEach(f => fieldVals[f.id] = f.value ?? '')
}

const missingTemplates = computed(() =>
  templates.value.filter(t =>
    !(detail.value?.fields.some(v => v.templateId === t.id)),
  ),
)

async function loadTemplates() {
  templates.value = await apiFetch<TemplateRow[]>('/api/task-field-templates')
}

async function load() {
  const id = route.params.id as string
  if (!id)
    return
  hydrating.value = true
  try {
    const row = await apiFetch<TaskDetail>(`/api/tasks/${id}`)
    detail.value = {
      ...row,
      linkedFiles: row.linkedFiles ?? [],
      linkedNotes: row.linkedNotes ?? [],
      linkedContacts: row.linkedContacts ?? [],
      children: row.children ?? [],
      fields: row.fields ?? [],
    }
    coreTitle.value = row.title ?? ''
    coreDesc.value = row.description ?? ''
    coreStatus.value = row.status ?? 'todo'
    corePriority.value = row.priority ?? 'normal'
    coreDueLocal.value = dueLocal(row.dueAt ?? null)
    refreshFieldVals(row.fields ?? [])
    await loadTemplates()
  }
  catch {
    toast.add({ title: 'Task not found', color: 'error' })
    await router.replace('/tasks')
    detail.value = null
  }
  finally {
    hydrating.value = false
  }
}

watch(() => route.params.id as string, () => {
  isEditing.value = false
  showAddField.value = false
  linkNoteModal.value = false
  linkContactModal.value = false
  linkFileModal.value = false
  load()
}, { immediate: true })

async function persistCoreImmediate(): Promise<boolean> {
  if (!detail.value || hydrating.value)
    return true
  try {
    const dueMs = coreDueLocal.value.trim()
      ? new Date(coreDueLocal.value).getTime()
      : null
    const row = await apiFetch(`/api/tasks/${detail.value.id}`, {
      method: 'PATCH',
      body: {
        title: coreTitle.value,
        description: coreDesc.value,
        status: coreStatus.value,
        priority: corePriority.value,
        dueAt: dueMs,
      },
    }) as TaskDetail
    detail.value = {
      ...detail.value,
      ...row,
      fields: detail.value.fields,
      linkedNotes: detail.value.linkedNotes,
      linkedContacts: detail.value.linkedContacts,
      linkedFiles: detail.value.linkedFiles,
      children: detail.value.children,
    }
    bumpList()
    return true
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not save task', color: 'error' })
    return false
  }
}

const persistCoreDebounced = debouncedSchedule(() => persistCoreImmediate(), 600)

watch([coreTitle, coreDesc, coreStatus, corePriority, coreDueLocal], () => {
  if (!isEditing.value || hydrating.value)
    return
  persistCoreDebounced.schedule()
})

async function persistFieldImmediate(fieldId: string, value: string): Promise<boolean> {
  if (!detail.value || hydrating.value)
    return true
  const f = detail.value.fields.find(x => x.id === fieldId)
  if (!f || f.value === value)
    return true
  try {
    const row = await apiFetch<FieldRow>(
      `/api/tasks/${detail.value.id}/fields/${fieldId}`,
      { method: 'PATCH', body: { value } },
    )
    const i = detail.value.fields.findIndex(x => x.id === fieldId)
    if (i >= 0)
      detail.value.fields[i] = row
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
  500,
)

function onFieldUpdate(fieldId: string, next: string) {
  if (!isEditing.value)
    return
  fieldVals[fieldId] = next
  persistFieldDebounced.schedule(fieldId, next)
}

async function finishEditing() {
  if (!detail.value)
    return
  finishingEdit.value = true
  try {
    persistCoreDebounced.cancel()
    persistFieldDebounced.cancel()
    const fieldBaseline = sortedFields().map(f => ({ id: f.id, baseline: f.value ?? '' }))
    const coreOk = await persistCoreImmediate()
    if (!coreOk)
      return
    for (const { id, baseline } of fieldBaseline) {
      const cur = fieldVals[id] ?? ''
      if (cur === baseline)
        continue
      const ok = await persistFieldImmediate(id, cur)
      if (!ok)
        return
    }
    isEditing.value = false
    showAddField.value = false
    linkNoteModal.value = false
    linkContactModal.value = false
    linkFileModal.value = false
  }
  finally {
    finishingEdit.value = false
  }
}

async function addTemplateField(t: TemplateRow) {
  if (!detail.value)
    return
  try {
    await apiFetch<FieldRow>(`/api/tasks/${detail.value.id}/fields`, {
      method: 'POST',
      body: { templateId: t.id },
    })
    await load()
    showAddField.value = false
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not add field', color: 'error' })
  }
}

async function addAdHocField() {
  if (!detail.value)
    return
  const lb = newFieldLabel.value.trim()
  if (!lb)
    return
  try {
    await apiFetch(`/api/tasks/${detail.value.id}/fields`, {
      method: 'POST',
      body: { label: lb, fieldType: newFieldType.value },
    })
    newFieldLabel.value = ''
    newFieldType.value = 'text'
    await load()
    showAddField.value = false
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not add field', color: 'error' })
  }
}

async function confirmDelete() {
  if (!detail.value)
    return
  deleting.value = true
  try {
    await apiFetch(`/api/tasks/${detail.value.id}`, { method: 'DELETE' })
    bumpList()
    showDeleteConfirm.value = false
    await router.replace('/tasks')
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not delete task', color: 'error' })
  }
  finally {
    deleting.value = false
  }
}

async function openLinkNotes() {
  noteSearchRows.value = await apiFetch<NoteSearch[]>('/api/notes')
  linkNoteModal.value = true
}

async function linkNote(noteId: string) {
  if (!detail.value)
    return
  linking.value = true
  try {
    await apiFetch(`/api/tasks/${detail.value.id}/notes/${noteId}`, { method: 'POST' })
    detail.value.linkedNotes = await apiFetch(`/api/tasks/${detail.value.id}/notes`)
    linkNoteModal.value = false
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not link note', color: 'error' })
  }
  finally {
    linking.value = false
  }
}

async function unlinkNote(noteId: string) {
  if (!detail.value)
    return
  await apiFetch(`/api/tasks/${detail.value.id}/notes/${noteId}`, { method: 'DELETE' })
  detail.value.linkedNotes = detail.value.linkedNotes.filter(n => n.id !== noteId)
}

async function openLinkContacts() {
  contactSearchRows.value = await apiFetch<ContactSearch[]>('/api/contacts')
  linkContactModal.value = true
}

async function linkContact(contactId: string) {
  if (!detail.value)
    return
  linking.value = true
  try {
    await apiFetch(`/api/tasks/${detail.value.id}/contacts/${contactId}`, { method: 'POST' })
    detail.value.linkedContacts = await apiFetch(`/api/tasks/${detail.value.id}/contacts`)
    linkContactModal.value = false
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not link contact', color: 'error' })
  }
  finally {
    linking.value = false
  }
}

async function unlinkContact(contactId: string) {
  if (!detail.value)
    return
  await apiFetch(`/api/tasks/${detail.value.id}/contacts/${contactId}`, { method: 'DELETE' })
  detail.value.linkedContacts = detail.value.linkedContacts.filter(c => c.id !== contactId)
}

async function openLinkFiles() {
  fileSearchRows.value = await apiFetch<FileSearch[]>('/api/files')
  linkFileModal.value = true
}

async function linkFile(fileId: string) {
  if (!detail.value)
    return
  linking.value = true
  try {
    await apiFetch(`/api/tasks/${detail.value.id}/files/${fileId}`, { method: 'POST' })
    await refreshLinkedFiles()
    linkFileModal.value = false
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not link file', color: 'error' })
  }
  finally {
    linking.value = false
  }
}

async function unlinkFile(fileId: string) {
  if (!detail.value)
    return
  await apiFetch(`/api/tasks/${detail.value.id}/files/${fileId}`, { method: 'DELETE' })
  await refreshLinkedFiles()
}

async function refreshLinkedFiles() {
  if (!detail.value)
    return
  const d = await apiFetch<TaskDetail>(`/api/tasks/${detail.value.id}`)
  detail.value.linkedFiles = d.linkedFiles ?? []
}

async function toggleFileShare(fileId: string, nextEnabled: boolean) {
  if (nextEnabled)
    await apiFetch(`/api/files/${fileId}/share`, { method: 'POST', body: {} })
  else
    await apiFetch(`/api/files/${fileId}/share`, { method: 'DELETE' })
  await refreshLinkedFiles()
}

async function deleteFileEverywhere(fileId: string) {
  await apiFetch(`/api/files/${fileId}`, { method: 'DELETE' })
  await refreshLinkedFiles()
}

function sortedFields() {
  return [...(detail.value?.fields ?? [])].sort((a, b) =>
    a.position !== b.position ? a.position - b.position : a.label.localeCompare(b.label),
  )
}

function addSubtask() {
  if (!detail.value)
    return
  void router.push({ path: '/tasks/new', query: { parent: detail.value.id } })
}

function scrollToTaskSection(sectionId: string) {
  taskDetailScroll.value?.querySelector(`#${sectionId}`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  return p.slice(0, 2) || '?'
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

function statusLabelUi(s: string) {
  return statusOpts.find(o => o.value === s)?.label ?? s.replaceAll('_', ' ')
}

function priorityLabelUi(s: string) {
  return priorityOpts.find(o => o.value === s)?.label ?? s
}

function requestRemoveField(fid: string) {
  pendingFieldId.value = fid
  showDeleteFieldConfirm.value = true
}

async function confirmRemoveField() {
  if (!detail.value)
    return
  const fid = pendingFieldId.value
  if (!fid)
    return
  removingField.value = true
  try {
    await apiFetch(`/api/tasks/${detail.value.id}/fields/${fid}`, { method: 'DELETE' })
    detail.value.fields = detail.value.fields.filter(f => f.id !== fid)
    delete fieldVals[fid]
    showDeleteFieldConfirm.value = false
    pendingFieldId.value = null
  }
  catch (e) {
    toast.add({ title: 'Could not delete field', color: 'error' })
    console.error(e)
  }
  finally {
    removingField.value = false
  }
}

function requestDeleteTask() {
  showDeleteConfirm.value = true
}
</script>

<template>
  <div v-if="hydrating || !detail" class="flex flex-1 items-center justify-center p-16 text-zinc-400">
    Loading…
  </div>
  <main v-else class="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-md ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/45">
      <header class="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-zinc-100/90 px-4 py-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-4">
          <div
            class="flex size-14 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] bg-zinc-900 text-lg font-semibold text-white shadow-lg"
            aria-hidden="true"
          >
            {{ initials(coreTitle || 'Task') }}
          </div>
          <div class="min-w-0">
            <span
              class="mb-1 inline-block rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600"
            >
              {{ statusLabelUi(coreStatus) }}
              <span class="lowercase text-zinc-400"> · </span>
              <span class="normal-case">{{ priorityLabelUi(corePriority) }}</span>
            </span>
            <h1 class="truncate text-2xl font-semibold tracking-tight text-zinc-900">
              {{ coreTitle.trim() || 'Untitled task' }}
            </h1>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-1.5 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]">
          <UButton
            v-if="!detail.shareEnabled"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-link"
            class="rounded-[var(--ui-control-radius)] px-3"
            @click="enableShare"
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
              @click="copyShareLink"
            >
              Copy link
            </UButton>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-link-2-off"
              class="rounded-[var(--ui-control-radius)] px-3"
              @click="disableShare"
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
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              :loading="deleting"
              class="rounded-[var(--ui-control-radius)] px-3"
              @click="requestDeleteTask"
            >
              Delete
            </UButton>
          </template>
        </div>
      </header>

      <div
        v-if="taskShareUrl"
        class="shrink-0 border-b border-emerald-100/90 bg-emerald-50/80 px-4 py-2 text-[11px] text-emerald-950 sm:px-6"
      >
        <span class="font-semibold text-emerald-900">Shared · </span>
        <span class="break-all font-mono text-emerald-900/90">{{ taskShareUrl }}</span>
      </div>

      <div class="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          ref="taskDetailScroll"
          class="ui-scrollbar relative min-h-0 flex-1 overflow-y-auto px-3 pb-10 pt-2 sm:px-8"
        >
          <div id="task-section-basics">
            <UiSectionLabel>
              Basics
            </UiSectionLabel>
            <div class="mt-3">
              <template v-if="!isEditing">
                <div>
                  <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Title
                  </div>
                  <div class="mt-1 text-[13px] text-zinc-900">
                    {{ viewDash(coreTitle) }}
                  </div>
                </div>
                <div class="mt-5">
                  <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Description
                  </div>
                  <p class="mt-1 whitespace-pre-wrap text-[13px] text-zinc-900">
                    {{ viewDash(coreDesc) }}
                  </p>
                </div>
                <div class="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      Status
                    </div>
                    <div class="mt-1 text-[13px] text-zinc-900">
                      {{ statusLabelUi(coreStatus) }}
                    </div>
                  </div>
                  <div>
                    <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      Priority
                    </div>
                    <div class="mt-1 text-[13px] text-zinc-900">
                      {{ priorityLabelUi(corePriority) }}
                    </div>
                  </div>
                </div>
                <div class="mt-5">
                  <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Due
                  </div>
                  <div class="mt-1 text-[13px] text-zinc-900">
                    {{ dueDisplayReadonly }}
                  </div>
                </div>
              </template>
              <template v-else>
                <UFormField label="Title">
                  <UInput v-model="coreTitle" class="rounded-[var(--ui-control-radius)]" />
                </UFormField>
                <UFormField label="Description" class="mt-4">
                  <UTextarea v-model="coreDesc" class="rounded-[var(--ui-control-radius)]" autoresize :max-rows="10" />
                </UFormField>
                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <UFormField label="Status">
                    <select v-model="coreStatus" class="ui-select w-full">
                      <option v-for="o in statusOpts" :key="o.value" :value="o.value">
                        {{ o.label }}
                      </option>
                    </select>
                  </UFormField>
                  <UFormField label="Priority">
                    <select v-model="corePriority" class="ui-select w-full">
                      <option v-for="o in priorityOpts" :key="o.value" :value="o.value">
                        {{ o.label }}
                      </option>
                    </select>
                  </UFormField>
                </div>
                <UFormField label="Due" class="mt-4">
                  <input
                    v-model="coreDueLocal"
                    type="datetime-local"
                    class="ui-control-radius w-full border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                </UFormField>
              </template>
            </div>
          </div>

          <div id="task-section-subtasks" class="mt-8 border-t border-zinc-100/90 pt-6">
            <div class="flex items-center justify-between gap-3">
              <UiSectionLabel>
                Subtasks
              </UiSectionLabel>
              <UButton size="xs" color="neutral" icon="i-lucide-plus" class="shrink-0 rounded-[var(--ui-control-radius)]" @click="addSubtask">
                New
              </UButton>
            </div>
            <ul v-if="detail.children.length" class="mt-3 flex flex-col gap-1">
              <li v-for="c in detail.children" :key="c.id">
                <NuxtLink
                  :to="`/tasks/${c.id}`"
                  class="flex items-start justify-between gap-1 rounded-[var(--ui-control-radius)] bg-white/50 px-2 py-1.5 ring-1 ring-zinc-950/[0.04] hover:bg-white/85"
                >
                  <span class="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">{{ c.title || 'Untitled' }}</span>
                  <span class="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-400">{{ c.status.replaceAll('_', ' ') }}</span>
                </NuxtLink>
              </li>
            </ul>
            <p v-else class="mt-3 text-[13px] text-zinc-400">
              No subtasks yet.
            </p>
          </div>

          <div id="task-section-fields" class="mt-8 border-t border-zinc-100/90 pt-6">
            <div class="flex items-center justify-between gap-4">
              <UiSectionLabel>
                Custom fields
              </UiSectionLabel>
              <UButton v-if="isEditing" size="xs" color="neutral" icon="i-lucide-plus" class="shrink-0 rounded-[var(--ui-control-radius)]" @click="showAddField = true">
                Add field
              </UButton>
            </div>
            <div class="mt-3">
              <template v-if="!isEditing">
                <div
                  v-for="f in sortedFields()"
                  :key="f.id"
                  class="mb-4 rounded-[var(--ui-control-radius)] border border-zinc-100 bg-zinc-50/70 p-3 last:mb-0"
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
                <p v-if="!sortedFields().length" class="text-[13px] text-zinc-400">
                  No custom fields yet.
                </p>
              </template>
              <template v-else>
                <div
                  v-for="f in sortedFields()"
                  :key="f.id"
                  class="mb-4 flex flex-wrap items-start gap-2 rounded-[var(--ui-control-radius)] border border-zinc-100 bg-zinc-50/70 p-3"
                >
                  <div class="min-w-0 flex-1">
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
                  <button
                    type="button"
                    class="rounded-[var(--ui-control-radius)] p-2 text-zinc-400 hover:bg-white hover:text-red-600"
                    title="Remove"
                    @click="requestRemoveField(f.id)"
                  >
                    <Icon name="i-lucide-x" class="size-4" aria-hidden="true" />
                  </button>
                </div>
                <p v-if="!sortedFields().length" class="text-[13px] text-zinc-400">
                  No custom fields yet.
                </p>
              </template>
            </div>
          </div>
        </div>

        <aside
          class="ui-scrollbar hidden w-[17rem] shrink-0 overflow-y-auto border-l border-zinc-100/90 bg-white/20 px-3 py-5 xl:flex xl:flex-col xl:gap-0"
        >
          <div>
            <UiSectionLabel>
              On this task
            </UiSectionLabel>
            <nav class="mt-3 space-y-0.5" aria-label="Task sections">
              <button
                type="button"
                class="flex w-full max-w-full rounded-[var(--ui-control-radius)] px-2 py-1.5 text-left text-[12px] leading-snug text-zinc-600 transition-colors hover:bg-white/85 hover:text-zinc-900"
                @click="scrollToTaskSection('task-section-basics')"
              >
                Basics
              </button>
              <button
                type="button"
                class="flex w-full max-w-full rounded-[var(--ui-control-radius)] px-2 py-1.5 text-left text-[12px] leading-snug text-zinc-600 transition-colors hover:bg-white/85 hover:text-zinc-900"
                @click="scrollToTaskSection('task-section-subtasks')"
              >
                Subtasks
              </button>
              <button
                type="button"
                class="flex w-full max-w-full rounded-[var(--ui-control-radius)] px-2 py-1.5 text-left text-[12px] leading-snug text-zinc-600 transition-colors hover:bg-white/85 hover:text-zinc-900"
                @click="scrollToTaskSection('task-section-fields')"
              >
                Custom fields
              </button>
            </nav>
          </div>

          <div class="mt-8 shrink-0 border-t border-zinc-100/80 pt-5">
            <div class="flex items-center justify-between gap-2">
              <UiSectionLabel>
                Linked notes
              </UiSectionLabel>
              <button
                v-if="isEditing"
                type="button"
                class="rounded-[var(--ui-control-radius)] px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-white/85"
                @click="openLinkNotes"
              >
                + Link
              </button>
            </div>
            <ul v-if="detail.linkedNotes.length" class="mt-3 flex flex-col gap-1">
              <li
                v-for="n in detail.linkedNotes"
                :key="n.id"
                class="flex items-start justify-between gap-1 rounded-[var(--ui-control-radius)] bg-white/50 px-2 py-1.5 ring-1 ring-zinc-950/[0.04]"
              >
                <NuxtLink
                  class="flex min-w-0 flex-1 flex-col text-left hover:underline"
                  :to="{ path: '/', query: { note: n.id } }"
                >
                  <span class="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">{{ n.title || 'Untitled' }}</span>
                </NuxtLink>
                <button
                  v-if="isEditing"
                  type="button"
                  class="shrink-0 rounded-[var(--ui-control-radius)] p-1 text-zinc-400 hover:bg-white hover:text-red-600"
                  aria-label="Unlink note"
                  @click="unlinkNote(n.id)"
                >
                  <Icon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
                </button>
              </li>
            </ul>
            <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
              No linked notes yet. Use + Link while editing.
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
                @click="openLinkContacts"
              >
                + Link
              </button>
            </div>
            <ul v-if="detail.linkedContacts.length" class="mt-3 flex flex-col gap-1">
              <li
                v-for="c in detail.linkedContacts"
                :key="c.id"
                class="flex items-start justify-between gap-1 rounded-[var(--ui-control-radius)] bg-white/50 px-2 py-1.5 ring-1 ring-zinc-950/[0.04]"
              >
                <NuxtLink
                  class="flex min-w-0 flex-1 flex-col text-left hover:underline"
                  :to="`/contacts/${c.id}`"
                >
                  <span class="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">{{ c.displayName }}</span>
                  <span class="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{{ c.type }}</span>
                </NuxtLink>
                <button
                  v-if="isEditing"
                  type="button"
                  class="shrink-0 rounded-[var(--ui-control-radius)] p-1 text-zinc-400 hover:bg-white hover:text-red-600"
                  aria-label="Unlink contact"
                  @click="unlinkContact(c.id)"
                >
                  <Icon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
                </button>
              </li>
            </ul>
            <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
              No linked contacts yet.
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
                @click="openLinkFiles"
              >
                + Link
              </button>
            </div>
            <div v-if="detail.linkedFiles.length" class="mt-3 flex flex-col gap-2">
              <FilesFileAttachmentItem
                v-for="f in detail.linkedFiles"
                :key="f.id"
                :file="f"
                :show-unlink="isEditing"
                :show-delete="isEditing"
                :show-share="isEditing"
                @unlink="unlinkFile"
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

    <Teleport to="body">
      <div
        v-if="showAddField"
        class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 backdrop-blur-sm"
        @click.self="showAddField = false"
      >
        <UCard class="ui-scrollbar max-h-[80vh] w-full max-w-md overflow-auto rounded-[var(--ui-panel-radius)]">
          <template #header>
            <span class="font-semibold text-zinc-900">Add field</span>
          </template>
          <div v-if="missingTemplates.length" class="space-y-2">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              From template
            </div>
            <button
              v-for="t in missingTemplates"
              :key="t.id"
              type="button"
              class="flex w-full rounded-[var(--ui-control-radius)] border border-zinc-100 bg-zinc-50 px-4 py-2.5 text-left text-[13px] font-medium text-zinc-800 hover:bg-white"
              @click="addTemplateField(t)"
            >
              <span>{{ t.label }}</span>
              <span class="ml-auto text-[11px] text-zinc-400">{{ t.fieldType }}</span>
            </button>
          </div>
          <div class="my-6 border-t border-zinc-100" />
          <div class="space-y-3">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Ad-hoc
            </div>
            <UFormField label="Label">
              <UInput v-model="newFieldLabel" class="rounded-[var(--ui-control-radius)]" />
            </UFormField>
            <UFormField label="Type">
              <select v-model="newFieldType" class="ui-select w-full">
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="url">URL</option>
                <option value="date">Date</option>
                <option value="address">Address</option>
                <option value="longtext">Long text</option>
              </select>
            </UFormField>
            <div class="flex justify-end gap-2 pt-2">
              <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="showAddField = false">
                Close
              </UButton>
              <UButton color="neutral" class="rounded-[var(--ui-control-radius)]" @click="addAdHocField">
                Add
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <div
        v-if="linkNoteModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 backdrop-blur-sm"
        @click.self="linkNoteModal = false"
      >
        <UCard class="ui-scrollbar max-h-[80vh] w-full max-w-md overflow-auto rounded-[var(--ui-panel-radius)]">
          <template #header>
            <span class="font-semibold text-zinc-900">Pick a note</span>
          </template>
          <ul class="space-y-1">
            <li v-for="n in noteSearchRows" :key="n.id">
              <button
                type="button"
                class="flex w-full rounded-[var(--ui-control-radius)] px-4 py-2.5 text-left text-[13px] hover:bg-zinc-100"
                :disabled="linking"
                @click="linkNote(n.id)"
              >
                {{ n.title || 'Untitled' }}
              </button>
            </li>
          </ul>
          <template #footer>
            <div class="flex justify-end">
              <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="linkNoteModal = false">
                Cancel
              </UButton>
            </div>
          </template>
        </UCard>
      </div>

      <div
        v-if="linkContactModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 backdrop-blur-sm"
        @click.self="linkContactModal = false"
      >
        <UCard class="ui-scrollbar max-h-[80vh] w-full max-w-md overflow-auto rounded-[var(--ui-panel-radius)]">
          <template #header>
            <span class="font-semibold text-zinc-900">Pick a contact</span>
          </template>
          <ul class="space-y-1">
            <li v-for="c in contactSearchRows" :key="c.id">
              <button
                type="button"
                class="flex w-full rounded-[var(--ui-control-radius)] px-4 py-2.5 text-left text-[13px] hover:bg-zinc-100"
                :disabled="linking"
                @click="linkContact(c.id)"
              >
                {{ c.displayName }}
              </button>
            </li>
          </ul>
          <template #footer>
            <div class="flex justify-end">
              <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="linkContactModal = false">
                Cancel
              </UButton>
            </div>
          </template>
        </UCard>
      </div>

      <div
        v-if="linkFileModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 backdrop-blur-sm"
        @click.self="linkFileModal = false"
      >
        <UCard class="ui-scrollbar max-h-[80vh] w-full max-w-md overflow-auto rounded-[var(--ui-panel-radius)]">
          <template #header>
            <span class="font-semibold text-zinc-900">Pick a file</span>
          </template>
          <ul class="space-y-1">
            <li v-for="f in fileSearchRows" :key="f.id">
              <button
                type="button"
                class="flex w-full rounded-[var(--ui-control-radius)] px-4 py-2.5 text-left text-[13px] hover:bg-zinc-100"
                :disabled="linking"
                @click="linkFile(f.id)"
              >
                {{ f.title && f.title.trim() ? f.title : f.originalName }}
              </button>
            </li>
          </ul>
          <template #footer>
            <div class="flex justify-end">
              <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="linkFileModal = false">
                Cancel
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </Teleport>

    <UiConfirmDeleteDialog
      v-model:open="showDeleteConfirm"
      title="Delete task"
      description="This task will be permanently removed. Subtasks become top-level tasks."
      :loading="deleting"
      @confirm="confirmDelete"
    />

    <UiConfirmDeleteDialog
      v-model:open="showDeleteFieldConfirm"
      title="Delete field"
      description="This custom field will be permanently removed from this task."
      :loading="removingField"
      @confirm="confirmRemoveField"
    />
  </main>
</template>
