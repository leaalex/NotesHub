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
  description?: string
  mimeType: string
  size: number
  shareEnabled: boolean
  shareToken: string | null
  shareUrl: string | null
  downloadUrl: string
}

type ContactDetail = {
  id: string
  type: string
  firstName: string
  lastName: string
  orgName: string
  displayName: string
  note: string
  folderId: string | null
  shareEnabled?: boolean
  shareToken?: string | null
  shareExpiresAt?: string | Date | null
  fields: FieldRow[]
  linkedNotes: { id: string, title: string }[]
  linkedFiles: AppFile[]
  linkedTasks: { id: string, title: string, status: string, priority: string }[]
  linkedAddresses: {
    id: string
    label: string
    line1: string
    city: string
    countryCode: string
    role: string
    isPrimary: boolean
  }[]
}

type TemplateRow = {
  id: string
  label: string
  fieldType: string
}

type NoteSearch = {
  id: string
  title: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const apiFetch = useRequestFetch()
const runtimeConfig = useRuntimeConfig()

const contactShareUrl = ref('')

const listVersion = useState<number>('contacts:listVersion', () => 0)

function bumpContactsList() {
  listVersion.value++
}

const hydrating = ref(true)
const detail = ref<ContactDetail | null>(null)

/** Default read-only until Edit; resetting when switching contacts. */
const isEditing = ref(false)
const finishingEdit = ref(false)

const templates = ref<TemplateRow[]>([])

const coreFirst = ref('')
const coreLast = ref('')
const coreOrg = ref('')
const coreNote = ref('')
const deleting = ref(false)
const showDeleteContactConfirm = ref(false)
const showDeleteFieldConfirm = ref(false)
const pendingFieldId = ref<string | null>(null)
const removingField = ref(false)

const fieldVals = reactive<Record<string, string>>({})

const showAddField = ref(false)
const newFieldLabel = ref('')
const newFieldType = ref('text')

const linkNoteModal = ref(false)
const linkTaskModal = ref(false)
const linkAddressModal = ref(false)
const noteSearchRows = ref<NoteSearch[]>([])
const taskSearchRows = ref<{ id: string, title: string }[]>([])
const addressSearchRows = ref<{ id: string, label: string, city: string, countryCode: string }[]>([])
const linking = ref(false)
const linkingTask = ref(false)
const linkingAddress = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const contactDetailScroll = ref<HTMLElement | null>(null)

function syncContactShareUrl() {
  const d = detail.value
  if (!d?.shareEnabled || !d.shareToken) {
    contactShareUrl.value = ''
    return
  }
  const base = String(runtimeConfig.public.siteUrl ?? '').replace(/\/$/, '')
  contactShareUrl.value = base ? `${base}/share/contact/${d.shareToken}` : ''
}

async function copyContactShareLink() {
  syncContactShareUrl()
  const url = contactShareUrl.value.trim()
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

async function enableContactShare() {
  if (!detail.value)
    return
  try {
    const r = await apiFetch<{ url: string, shareToken: string }>(`/api/contacts/${detail.value.id}/share`, { method: 'POST', body: {} })
    contactShareUrl.value = r.url
    detail.value.shareEnabled = true
    detail.value.shareToken = r.shareToken
  }
  catch (e: unknown) {
    console.error(e)
    toast.add({ title: 'Could not enable share link', color: 'error' })
  }
}

async function disableContactShare() {
  if (!detail.value)
    return
  try {
    await apiFetch(`/api/contacts/${detail.value.id}/share`, { method: 'DELETE' })
    contactShareUrl.value = ''
    detail.value.shareEnabled = false
    detail.value.shareToken = null
    detail.value.shareExpiresAt = null
  }
  catch (e: unknown) {
    console.error(e)
    toast.add({ title: 'Could not disable share link', color: 'error' })
  }
}

watch(detail, syncContactShareUrl, { deep: true })

function scrollToContactSection(sectionId: string) {
  contactDetailScroll.value?.querySelector(`#${sectionId}`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  return p.slice(0, 2) || '?'
}

function refreshFieldVals(rows: FieldRow[]) {
  for (const k of Object.keys(fieldVals))
    delete fieldVals[k]
  rows.forEach(f => fieldVals[f.id] = f.value ?? '')
}

const missingTemplates = computed(() =>
  templates.value.filter(t =>
    !(detail.value?.fields.some(v => v.templateId === t.id)),
  ))

async function loadTemplates(type: string) {
  const t = type === 'organization' ? 'organization' : 'person'
  templates.value = await apiFetch<TemplateRow[]>('/api/contact-field-templates', {
    query: { type: t },
  })
}

async function load() {
  const id = route.params.id as string
  if (!id)
    return
  hydrating.value = true
  try {
    const row = await apiFetch<ContactDetail>(`/api/contacts/${id}`)
    detail.value = {
      ...row,
      linkedFiles: row.linkedFiles ?? [],
      linkedTasks: row.linkedTasks ?? [],
      linkedAddresses: row.linkedAddresses ?? [],
    }
    coreFirst.value = row.firstName ?? ''
    coreLast.value = row.lastName ?? ''
    coreOrg.value = row.orgName ?? ''
    coreNote.value = row.note ?? ''
    refreshFieldVals(row.fields)
    await loadTemplates(row.type)
  }
  catch {
    toast.add({ title: 'Contact not found', color: 'error' })
    await router.replace('/contacts')
    detail.value = null
  }
  finally {
    hydrating.value = false
  }
}

watch(
  () => route.params.id as string,
  () => {
    isEditing.value = false
    showAddField.value = false
    linkNoteModal.value = false
    linkTaskModal.value = false
    linkAddressModal.value = false
    load()
  },
  { immediate: true },
)

async function persistCoreImmediate(): Promise<boolean> {
  if (!detail.value || hydrating.value)
    return true
  try {
    const prevDisplay = detail.value.displayName
    const row = await apiFetch<Omit<ContactDetail, 'fields' | 'linkedNotes' | 'linkedFiles' | 'linkedTasks' | 'linkedAddresses'>>(`/api/contacts/${detail.value.id}`, {
      method: 'PATCH',
      body: {
        firstName: coreFirst.value,
        lastName: coreLast.value,
        orgName: coreOrg.value,
        note: coreNote.value,
      },
    })
    detail.value = {
      ...detail.value,
      ...row,
      fields: detail.value.fields,
      linkedNotes: detail.value.linkedNotes,
      linkedFiles: detail.value.linkedFiles,
      linkedTasks: detail.value.linkedTasks,
      linkedAddresses: detail.value.linkedAddresses,
    }
    if (row.displayName !== prevDisplay)
      bumpContactsList()
    return true
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not save contact', color: 'error' })
    return false
  }
}

const persistCoreDebounced = debouncedSchedule(() => persistCoreImmediate(), 600)

watch([coreFirst, coreLast, coreOrg, coreNote], () => {
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
      `/api/contacts/${detail.value.id}/fields/${fieldId}`,
      {
        method: 'PATCH',
        body: { value },
      },
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

    const fieldBaseline = sortedFields().map(f => ({
      id: f.id,
      baseline: f.value ?? '',
    }))

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
    linkTaskModal.value = false
    linkAddressModal.value = false
  }
  finally {
    finishingEdit.value = false
  }
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
    await apiFetch(`/api/contacts/${detail.value.id}/fields/${fid}`, { method: 'DELETE' })
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

async function addTemplateField(tpl: TemplateRow) {
  if (!detail.value)
    return
  try {
    const row = await apiFetch<FieldRow>(`/api/contacts/${detail.value.id}/fields`, {
      method: 'POST',
      body: { templateId: tpl.id },
    })
    detail.value.fields.push(row)
    fieldVals[row.id] = row.value ?? ''
    showAddField.value = false
  }
  catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({
      title: err.data?.statusMessage ?? 'Could not add field',
      color: 'error',
    })
    console.error(e)
  }
}

async function addAdHocField() {
  if (!detail.value)
    return
  const lb = newFieldLabel.value.trim()
  if (!lb)
    return
  const row = await apiFetch<FieldRow>(`/api/contacts/${detail.value.id}/fields`, {
    method: 'POST',
    body: { label: lb, fieldType: newFieldType.value },
  })
  detail.value.fields.push(row)
  fieldVals[row.id] = row.value ?? ''
  newFieldLabel.value = ''
  showAddField.value = false
}

async function unlinkNote(noteId: string) {
  if (!detail.value)
    return
  await apiFetch(`/api/notes/${noteId}/contacts/${detail.value.id}`, {
    method: 'DELETE',
  })
  detail.value.linkedNotes = detail.value.linkedNotes.filter(n => n.id !== noteId)
}

async function openLinkNotes() {
  linkNoteModal.value = true
  noteSearchRows.value = await apiFetch<NoteSearch[]>('/api/notes')
}

async function linkNote(noteId: string) {
  if (!detail.value)
    return
  linking.value = true
  try {
    await apiFetch(`/api/notes/${noteId}/contacts/${detail.value.id}`, { method: 'POST' })
    const refreshed = await apiFetch<ContactDetail>(`/api/contacts/${detail.value.id}`)
    detail.value.linkedNotes = refreshed.linkedNotes
    linkNoteModal.value = false
  }
  catch (e) {
    toast.add({ title: 'Could not link note', color: 'error' })
    console.error(e)
  }
  finally {
    linking.value = false
  }
}

async function openLinkTasks() {
  linkTaskModal.value = true
  taskSearchRows.value = await apiFetch<{ id: string, title: string }[]>('/api/tasks')
}

async function linkTask(taskId: string) {
  if (!detail.value)
    return
  linkingTask.value = true
  try {
    await apiFetch(`/api/contacts/${detail.value.id}/tasks/${taskId}`, { method: 'POST' })
    const refreshed = await apiFetch<ContactDetail>(`/api/contacts/${detail.value.id}`)
    detail.value.linkedTasks = refreshed.linkedTasks ?? []
    linkTaskModal.value = false
  }
  catch (e) {
    toast.add({ title: 'Could not link task', color: 'error' })
    console.error(e)
  }
  finally {
    linkingTask.value = false
  }
}

async function unlinkTask(taskId: string) {
  if (!detail.value)
    return
  await apiFetch(`/api/contacts/${detail.value.id}/tasks/${taskId}`, { method: 'DELETE' })
  detail.value.linkedTasks = (detail.value.linkedTasks ?? []).filter(t => t.id !== taskId)
}

async function openLinkAddresses() {
  linkAddressModal.value = true
  const rows = await apiFetch<{ id: string, label: string, city: string, countryCode: string }[]>('/api/addresses')
  const linked = new Set((detail.value?.linkedAddresses ?? []).map(a => a.id))
  addressSearchRows.value = rows.filter(a => !linked.has(a.id))
}

async function linkAddress(addrId: string) {
  if (!detail.value)
    return
  linkingAddress.value = true
  try {
    await apiFetch(`/api/contacts/${detail.value.id}/addresses`, {
      method: 'POST',
      body: { addressId: addrId, role: 'other', isPrimary: false },
    })
    const refreshed = await apiFetch<ContactDetail>(`/api/contacts/${detail.value.id}`)
    detail.value.linkedAddresses = refreshed.linkedAddresses ?? []
    linkAddressModal.value = false
  }
  catch (e) {
    toast.add({ title: 'Could not link address', color: 'error' })
    console.error(e)
  }
  finally {
    linkingAddress.value = false
  }
}

async function unlinkAddress(addressId: string) {
  if (!detail.value)
    return
  await apiFetch(`/api/contacts/${detail.value.id}/addresses/${addressId}`, { method: 'DELETE' })
  detail.value.linkedAddresses = (detail.value.linkedAddresses ?? []).filter(a => a.id !== addressId)
}

async function patchContactAddress(addressId: string, patch: { role?: string, isPrimary?: boolean }) {
  if (!detail.value || !isEditing.value)
    return
  try {
    await apiFetch(`/api/contacts/${detail.value.id}/addresses/${addressId}`, {
      method: 'PATCH',
      body: patch,
    })
    const refreshed = await apiFetch<ContactDetail>(`/api/contacts/${detail.value.id}`)
    detail.value.linkedAddresses = refreshed.linkedAddresses ?? []
  }
  catch (e) {
    toast.add({ title: 'Could not update address link', color: 'error' })
    console.error(e)
  }
}

async function refreshLinkedFiles() {
  if (!detail.value)
    return
  detail.value.linkedFiles = await apiFetch<AppFile[]>(`/api/contacts/${detail.value.id}/files`)
}

function openFilePicker() {
  fileInput.value?.click()
}

async function onFilePicked(event: Event) {
  if (!detail.value)
    return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  const form = new FormData()
  form.append('file', file, file.name)

  try {
    const uploaded = await apiFetch<AppFile>('/api/files/upload', {
      method: 'POST',
      body: form,
    })
    await apiFetch(`/api/contacts/${detail.value.id}/files`, {
      method: 'POST',
      body: { fileId: uploaded.id },
    })
    await refreshLinkedFiles()
  }
  catch (e) {
    toast.add({ title: 'Could not upload file', color: 'error' })
    console.error(e)
  }
  finally {
    input.value = ''
  }
}

async function unlinkFile(fileId: string) {
  if (!detail.value)
    return
  await apiFetch(`/api/contacts/${detail.value.id}/files/${fileId}`, { method: 'DELETE' })
  await refreshLinkedFiles()
}

async function deleteFileEverywhere(fileId: string) {
  await apiFetch(`/api/files/${fileId}`, { method: 'DELETE' })
  await refreshLinkedFiles()
}

async function toggleFileShare(fileId: string, nextEnabled: boolean) {
  if (nextEnabled)
    await apiFetch(`/api/files/${fileId}/share`, { method: 'POST', body: {} })
  else
    await apiFetch(`/api/files/${fileId}/share`, { method: 'DELETE' })
  await refreshLinkedFiles()
}

function requestDeleteContact() {
  if (!detail.value)
    return
  showDeleteContactConfirm.value = true
}

async function confirmDeleteContact() {
  if (!detail.value)
    return
  deleting.value = true
  try {
    await apiFetch(`/api/contacts/${detail.value.id}`, { method: 'DELETE' })
    bumpContactsList()
    showDeleteContactConfirm.value = false
    await router.push('/contacts')
  }
  catch {
    toast.add({ title: 'Could not delete', color: 'error' })
  }
  finally {
    deleting.value = false
  }
}

function sortedFields() {
  return [...(detail.value?.fields ?? [])].sort((a, b) =>
    a.position !== b.position ? a.position - b.position : a.label.localeCompare(b.label),
  )
}

const kindLabel = computed(() =>
  detail.value?.type === 'organization' ? 'Organization' : 'Person',
)
</script>

<template>
  <div v-if="hydrating || !detail" class="flex min-w-0 flex-1 flex-col items-center justify-center px-8 py-12 text-center text-[13px] text-zinc-400">
    Loading…
  </div>
  <main v-else class="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/70 bg-white/55 backdrop-blur-md ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/45">
      <header class="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-zinc-100/90 px-4 py-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-4">
          <div
            class="flex size-14 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] bg-zinc-900 text-lg font-semibold text-white"
            aria-hidden="true"
          >
            {{ initials(detail.displayName) }}
          </div>
          <div class="min-w-0">
            <span
              class="mb-1 inline-block rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600"
            >
              {{ kindLabel }}
            </span>
            <h1 class="truncate text-2xl font-semibold tracking-tight text-zinc-900">
              {{ detail.displayName }}
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
            @click="enableContactShare"
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
              @click="copyContactShareLink"
            >
              Copy link
            </UButton>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-link-2-off"
              class="rounded-[var(--ui-control-radius)] px-3"
              @click="disableContactShare"
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
              @click="requestDeleteContact"
            >
              Delete
            </UButton>
          </template>
        </div>
      </header>

      <div
        v-if="contactShareUrl"
        class="shrink-0 border-b border-emerald-100/90 bg-emerald-50/80 px-4 py-2 text-[11px] text-emerald-950 sm:px-6"
      >
        <span class="font-semibold text-emerald-900">Shared · </span>
        <span class="break-all font-mono text-emerald-900/90">{{ contactShareUrl }}</span>
      </div>

      <div class="relative flex min-h-0 flex-1 overflow-hidden">
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          @change="onFilePicked"
        >
        <div
          ref="contactDetailScroll"
          class="ui-scrollbar relative min-h-0 flex-1 overflow-y-auto px-3 pb-10 pt-2 sm:px-8"
        >
          <div id="contact-section-basics">
            <UiSectionLabel>
              Basics
            </UiSectionLabel>
            <div class="mt-3">
              <template v-if="!isEditing">
                <div v-if="detail.type === 'person'" class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      First name
                    </div>
                    <div class="mt-1 text-[13px] text-zinc-900">
                      {{ viewDash(detail.firstName) }}
                    </div>
                  </div>
                  <div>
                    <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      Last name
                    </div>
                    <div class="mt-1 text-[13px] text-zinc-900">
                      {{ viewDash(detail.lastName) }}
                    </div>
                  </div>
                </div>
                <div v-else>
                  <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Organization name
                  </div>
                  <div class="mt-1 text-[13px] text-zinc-900">
                    {{ viewDash(detail.orgName) }}
                  </div>
                </div>
                <div class="mt-5">
                  <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Note
                  </div>
                  <p class="mt-1 whitespace-pre-wrap text-[13px] text-zinc-900">
                    {{ viewDash(detail.note) }}
                  </p>
                </div>
              </template>
              <template v-else>
                <div v-if="detail.type === 'person'" class="grid gap-3 sm:grid-cols-2">
                  <UFormField label="First name">
                    <UInput v-model="coreFirst" class="rounded-[var(--ui-control-radius)]" />
                  </UFormField>
                  <UFormField label="Last name">
                    <UInput v-model="coreLast" class="rounded-[var(--ui-control-radius)]" />
                  </UFormField>
                </div>
                <div v-else class="grid gap-3">
                  <UFormField label="Organization name">
                    <UInput v-model="coreOrg" class="rounded-[var(--ui-control-radius)]" />
                  </UFormField>
                </div>
                <UFormField label="Note" class="mt-5">
                  <UTextarea v-model="coreNote" class="rounded-[var(--ui-control-radius)]" autoresize :max-rows="8" />
                </UFormField>
              </template>
            </div>
          </div>

          <div id="contact-section-fields" class="mt-8 border-t border-zinc-100/90 pt-6">
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
                    <p v-else-if="f.fieldType === 'longtext'" class="whitespace-pre-wrap">
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
              On this contact
            </UiSectionLabel>
            <nav class="mt-3 space-y-0.5" aria-label="Contact sections">
              <button
                type="button"
                class="flex w-full max-w-full rounded-[var(--ui-control-radius)] px-2 py-1.5 text-left text-[12px] leading-snug text-zinc-600 transition-colors hover:bg-white/85 hover:text-zinc-900"
                @click="scrollToContactSection('contact-section-basics')"
              >
                Basics
              </button>
              <button
                type="button"
                class="flex w-full max-w-full rounded-[var(--ui-control-radius)] px-2 py-1.5 text-left text-[12px] leading-snug text-zinc-600 transition-colors hover:bg-white/85 hover:text-zinc-900"
                @click="scrollToContactSection('contact-section-fields')"
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
                Linked files
              </UiSectionLabel>
              <button
                v-if="isEditing"
                type="button"
                class="rounded-[var(--ui-control-radius)] px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-white/85"
                @click="openFilePicker"
              >
                + File
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

          <div class="mt-8 shrink-0 border-t border-zinc-100/80 pt-5">
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
            <ul v-if="(detail.linkedTasks ?? []).length" class="mt-3 flex flex-col gap-1">
              <li
                v-for="t in detail.linkedTasks"
                :key="t.id"
                class="flex items-start justify-between gap-1 rounded-[var(--ui-control-radius)] bg-white/50 px-2 py-1.5 ring-1 ring-zinc-950/[0.04]"
              >
                <NuxtLink
                  class="flex min-w-0 flex-1 flex-col text-left hover:underline"
                  :to="`/tasks/${t.id}`"
                >
                  <span class="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">{{ t.title || 'Untitled' }}</span>
                  <span class="text-[10px] uppercase text-zinc-400">{{ t.status.replaceAll('_', ' ') }}</span>
                </NuxtLink>
                <button
                  v-if="isEditing"
                  type="button"
                  class="shrink-0 rounded-[var(--ui-control-radius)] p-1 text-zinc-400 hover:bg-white hover:text-red-600"
                  aria-label="Unlink task"
                  @click="unlinkTask(t.id)"
                >
                  <Icon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
                </button>
              </li>
            </ul>
            <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
              No linked tasks yet.
            </p>
          </div>

          <div class="mt-8 shrink-0 border-t border-zinc-100/80 pt-5">
            <div class="flex items-center justify-between gap-2">
              <UiSectionLabel>
                Linked addresses
              </UiSectionLabel>
              <button
                v-if="isEditing"
                type="button"
                class="rounded-[var(--ui-control-radius)] px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-white/85"
                @click="openLinkAddresses"
              >
                + Link
              </button>
            </div>
            <ul v-if="(detail.linkedAddresses ?? []).length" class="mt-3 flex flex-col gap-2">
              <li
                v-for="a in detail.linkedAddresses"
                :key="a.id"
                class="flex flex-col gap-1.5 rounded-[var(--ui-control-radius)] bg-white/50 px-2 py-2 ring-1 ring-zinc-950/[0.04]"
              >
                <div class="flex items-start justify-between gap-1">
                  <NuxtLink
                    class="flex min-w-0 flex-1 flex-col text-left hover:underline"
                    :to="`/addresses/${a.id}`"
                  >
                    <span class="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">{{ a.label || a.line1 || 'Address' }}</span>
                    <span class="text-[10px] text-zinc-500">{{ [a.city, a.countryCode?.toUpperCase()].filter(Boolean).join(' · ') }}</span>
                  </NuxtLink>
                  <button
                    v-if="isEditing"
                    type="button"
                    class="shrink-0 rounded-[var(--ui-control-radius)] p-1 text-zinc-400 hover:bg-white hover:text-red-600"
                    aria-label="Unlink address"
                    @click="unlinkAddress(a.id)"
                  >
                    <Icon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div v-if="isEditing" class="flex flex-wrap items-center gap-2 text-[11px]">
                  <label class="flex items-center gap-1 text-zinc-600">
                    <span class="shrink-0 text-zinc-400">Role</span>
                    <select
                      class="ui-select max-w-[8rem] rounded-[var(--ui-control-radius)] py-0.5 text-[11px]"
                      :value="a.role"
                      @change="patchContactAddress(a.id, { role: ($event.target as HTMLSelectElement).value })"
                    >
                      <option value="shipping">
                        Shipping
                      </option>
                      <option value="billing">
                        Billing
                      </option>
                      <option value="production">
                        Production
                      </option>
                      <option value="other">
                        Other
                      </option>
                    </select>
                  </label>
                  <label class="flex cursor-pointer items-center gap-1.5 text-zinc-600">
                    <input
                      type="checkbox"
                      class="size-3.5 rounded border-zinc-300"
                      :checked="a.isPrimary"
                      @change="patchContactAddress(a.id, { isPrimary: ($event.target as HTMLInputElement).checked })"
                    >
                    <span>Primary</span>
                  </label>
                </div>
                <div v-else class="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-zinc-400">
                  <span>{{ a.role }}</span>
                  <span v-if="a.isPrimary">· primary</span>
                </div>
              </li>
            </ul>
            <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
              No saved addresses linked. Use + Link while editing.
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
        v-if="linkTaskModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 backdrop-blur-sm"
        @click.self="linkTaskModal = false"
      >
        <UCard class="ui-scrollbar max-h-[80vh] w-full max-w-md overflow-auto rounded-[var(--ui-panel-radius)]">
          <template #header>
            <span class="font-semibold text-zinc-900">Pick a task</span>
          </template>
          <ul class="space-y-1">
            <li v-for="t in taskSearchRows" :key="t.id">
              <button
                type="button"
                class="flex w-full rounded-[var(--ui-control-radius)] px-4 py-2.5 text-left text-[13px] hover:bg-zinc-100"
                :disabled="linkingTask"
                @click="linkTask(t.id)"
              >
                {{ t.title || 'Untitled' }}
              </button>
            </li>
          </ul>
          <template #footer>
            <div class="flex justify-end">
              <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="linkTaskModal = false">
                Cancel
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
      <div
        v-if="linkAddressModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 backdrop-blur-sm"
        @click.self="linkAddressModal = false"
      >
        <UCard class="ui-scrollbar max-h-[80vh] w-full max-w-md overflow-auto rounded-[var(--ui-panel-radius)]">
          <template #header>
            <span class="font-semibold text-zinc-900">Link a saved address</span>
          </template>
          <p v-if="!addressSearchRows.length" class="px-1 py-2 text-[13px] text-zinc-500">
            No addresses left to link. Create one in Addresses first.
          </p>
          <ul v-else class="space-y-1">
            <li v-for="addr in addressSearchRows" :key="addr.id">
              <button
                type="button"
                class="flex w-full flex-col rounded-[var(--ui-control-radius)] px-4 py-2.5 text-left text-[13px] hover:bg-zinc-100"
                :disabled="linkingAddress"
                @click="linkAddress(addr.id)"
              >
                <span class="font-medium text-zinc-900">{{ addr.label || 'Address' }}</span>
                <span class="text-[11px] text-zinc-500">{{ [addr.city, addr.countryCode?.toUpperCase()].filter(Boolean).join(' · ') }}</span>
              </button>
            </li>
          </ul>
          <template #footer>
            <div class="flex justify-end">
              <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="linkAddressModal = false">
                Cancel
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </Teleport>

    <UiConfirmDeleteDialog
      v-model:open="showDeleteContactConfirm"
      title="Delete contact"
      description="This contact will be permanently removed. This action cannot be undone."
      :loading="deleting"
      @confirm="confirmDeleteContact"
    />

    <UiConfirmDeleteDialog
      v-model:open="showDeleteFieldConfirm"
      title="Delete field"
      description="This custom field will be permanently removed from this contact."
      :loading="removingField"
      @confirm="confirmRemoveField"
    />
  </main>
</template>
