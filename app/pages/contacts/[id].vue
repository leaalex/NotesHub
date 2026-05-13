<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'

type FieldRow = {
  id: string
  templateId: string | null
  label: string
  fieldType: string
  value: string
  position: number
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
  fields: FieldRow[]
  linkedNotes: { id: string, title: string }[]
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

const listVersion = useState<number>('contacts:listVersion', () => 0)

function bumpContactsList() {
  listVersion.value++
}

const hydrating = ref(true)
const detail = ref<ContactDetail | null>(null)

const templates = ref<TemplateRow[]>([])

const coreFirst = ref('')
const coreLast = ref('')
const coreOrg = ref('')
const coreNote = ref('')
const deleting = ref(false)

const fieldVals = reactive<Record<string, string>>({})

const showAddField = ref(false)
const newFieldLabel = ref('')
const newFieldType = ref('text')

const linkNoteModal = ref(false)
const noteSearchRows = ref<NoteSearch[]>([])
const linking = ref(false)

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
    detail.value = row
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
  () => { load() },
  { immediate: true },
)

const persistCore = useDebounceFn(async () => {
  if (!detail.value || hydrating.value)
    return
  try {
    const prevDisplay = detail.value.displayName
    const row = await apiFetch<Omit<ContactDetail, 'fields' | 'linkedNotes'>>(`/api/contacts/${detail.value.id}`, {
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
    }
    if (row.displayName !== prevDisplay)
      bumpContactsList()
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not save contact', color: 'error' })
  }
}, 600)

watch([coreFirst, coreLast, coreOrg, coreNote], () => persistCore())

const persistFieldDebounced = useDebounceFn(
  async (fieldId: string, value: string) => {
    if (!detail.value || hydrating.value)
      return
    const f = detail.value.fields.find(x => x.id === fieldId)
    if (!f || f.value === value)
      return
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
    }
    catch (e) {
      console.error(e)
      toast.add({ title: 'Could not save field', color: 'error' })
    }
  },
  500,
)

function onFieldUpdate(fieldId: string, next: string) {
  fieldVals[fieldId] = next
  persistFieldDebounced(fieldId, next)
}

async function removeField(fid: string) {
  if (!detail.value)
    return
  await apiFetch(`/api/contacts/${detail.value.id}/fields/${fid}`, { method: 'DELETE' })
  detail.value.fields = detail.value.fields.filter(f => f.id !== fid)
  delete fieldVals[fid]
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

async function deleteContact() {
  if (!detail.value || !confirm('Delete this contact?'))
    return
  deleting.value = true
  try {
    await apiFetch(`/api/contacts/${detail.value.id}`, { method: 'DELETE' })
    bumpContactsList()
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
  <div v-if="hydrating || !detail" class="flex flex-1 items-center justify-center p-16 text-zinc-400">
    Loading…
  </div>
  <div v-else class="relative min-h-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div class="flex min-w-0 items-center gap-4">
        <div
          class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-lg font-semibold text-white shadow-lg"
          aria-hidden="true"
        >
          {{ initials(detail.displayName) }}
        </div>
        <div class="min-w-0">
          <span
            class="mb-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600"
          >
            {{ kindLabel }}
          </span>
          <h1 class="truncate text-2xl font-semibold tracking-tight text-zinc-900">
            {{ detail.displayName }}
          </h1>
        </div>
      </div>
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        :loading="deleting"
        class="rounded-full"
        @click="deleteContact"
      >
        Delete
      </UButton>
    </div>

    <UCard class="overflow-hidden rounded-2xl shadow-sm ring-1 ring-zinc-950/[0.04]">
      <template #header>
        <span class="font-semibold text-zinc-900">Basics</span>
      </template>
      <div v-if="detail.type === 'person'" class="grid gap-3 sm:grid-cols-2">
        <UFormField label="First name">
          <UInput v-model="coreFirst" class="rounded-xl" />
        </UFormField>
        <UFormField label="Last name">
          <UInput v-model="coreLast" class="rounded-xl" />
        </UFormField>
      </div>
      <div v-else class="grid gap-3">
        <UFormField label="Organization name">
          <UInput v-model="coreOrg" class="rounded-xl" />
        </UFormField>
      </div>
      <UFormField label="Note" class="mt-5">
        <UTextarea v-model="coreNote" class="rounded-xl" autoresize :max-rows="8" />
      </UFormField>
    </UCard>

    <UCard class="mt-6 overflow-hidden rounded-2xl shadow-sm ring-1 ring-zinc-950/[0.04]">
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <span class="font-semibold text-zinc-900">Custom fields</span>
          <UButton size="xs" color="neutral" icon="i-lucide-plus" class="rounded-full" @click="showAddField = true">
            Add field
          </UButton>
        </div>
      </template>

      <div
        v-for="f in sortedFields()"
        :key="f.id"
        class="mb-4 flex flex-wrap items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3"
      >
        <div class="min-w-0 flex-1">
          <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {{ f.label }}
            <span class="normal-case opacity-70"> · {{ f.fieldType }}</span>
          </div>
          <UTextarea
            v-if="f.fieldType === 'longtext' || f.fieldType === 'address'"
            :model-value="fieldVals[f.id]"
            class="mt-2 w-full rounded-xl"
            autoresize
            :max-rows="8"
            @update:model-value="v => onFieldUpdate(f.id, v ?? '')"
          />
          <UInput
            v-else-if="f.fieldType === 'date'"
            :model-value="fieldVals[f.id]"
            type="date"
            class="mt-2 w-full rounded-xl"
            @update:model-value="v => onFieldUpdate(f.id, v ?? '')"
          />
          <UInput
            v-else
            :model-value="fieldVals[f.id]"
            class="mt-2 w-full rounded-xl"
            :type="f.fieldType === 'email' ? 'email' : f.fieldType === 'url' ? 'url' : 'text'"
            @update:model-value="v => onFieldUpdate(f.id, v ?? '')"
          />
        </div>
        <button
          type="button"
          class="rounded-full p-2 text-zinc-400 hover:bg-white hover:text-red-600"
          title="Remove"
          @click="removeField(f.id)"
        >
          <Icon name="i-lucide-x" class="size-4" aria-hidden="true" />
        </button>
      </div>
      <p v-if="!sortedFields().length" class="text-[13px] text-zinc-400">
        No custom fields yet.
      </p>
    </UCard>

    <UCard class="mt-6 overflow-hidden rounded-2xl shadow-sm ring-1 ring-zinc-950/[0.04]">
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <span class="font-semibold text-zinc-900">Linked notes</span>
          <UButton size="xs" color="neutral" icon="i-lucide-plus" class="rounded-full" @click="openLinkNotes">
            Link
          </UButton>
        </div>
      </template>

      <ul v-if="detail.linkedNotes.length" class="space-y-2">
        <li
          v-for="n in detail.linkedNotes"
          :key="n.id"
          class="flex items-center justify-between rounded-xl bg-zinc-50/80 px-3 py-2"
        >
          <NuxtLink :to="{ path: '/', query: { note: n.id } }" class="text-[13px] font-medium text-zinc-900 hover:underline">
            {{ n.title || 'Untitled' }}
          </NuxtLink>
          <button
            type="button"
            class="rounded-full p-1.5 text-zinc-400 hover:bg-white hover:text-red-600"
            aria-label="Unlink note"
            @click="unlinkNote(n.id)"
          >
            <Icon name="i-lucide-x" class="size-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <p v-else class="text-[13px] text-zinc-400">
        No linked notes yet.
      </p>
    </UCard>

    <Teleport to="body">
      <div
        v-if="showAddField"
        class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 backdrop-blur-sm"
        @click.self="showAddField = false"
      >
        <UCard class="ui-scrollbar max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl">
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
              class="flex w-full rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-2.5 text-left text-[13px] font-medium text-zinc-800 hover:bg-white"
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
              <UInput v-model="newFieldLabel" class="rounded-xl" />
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
              <UButton variant="ghost" color="neutral" class="rounded-full" @click="showAddField = false">
                Close
              </UButton>
              <UButton color="neutral" class="rounded-full" @click="addAdHocField">
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
        <UCard class="ui-scrollbar max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl">
          <template #header>
            <span class="font-semibold text-zinc-900">Pick a note</span>
          </template>
          <ul class="space-y-1">
            <li v-for="n in noteSearchRows" :key="n.id">
              <button
                type="button"
                class="flex w-full rounded-xl px-4 py-2.5 text-left text-[13px] hover:bg-zinc-100"
                :disabled="linking"
                @click="linkNote(n.id)"
              >
                {{ n.title || 'Untitled' }}
              </button>
            </li>
          </ul>
          <template #footer>
            <div class="flex justify-end">
              <UButton variant="ghost" color="neutral" class="rounded-full" @click="linkNoteModal = false">
                Cancel
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </Teleport>
  </div>
</template>
