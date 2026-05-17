<script setup lang="ts">
type TemplateRow = {
  id: string
  label: string
  fieldType: string
  position: number
}

const toast = useToast()
const apiFetch = useRequestFetch()

const rows = ref<TemplateRow[]>([])
const loading = ref(true)
const newLabel = ref('')
const showDeleteTemplateConfirm = ref(false)
const pendingTemplateId = ref<string | null>(null)
const deletingTemplate = ref(false)

const fieldOpts = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
  { value: 'address', label: 'Address' },
  { value: 'longtext', label: 'Long text' },
]

async function reload() {
  loading.value = true
  try {
    rows.value = await apiFetch<TemplateRow[]>('/api/task-field-templates')
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not load templates', color: 'error' })
  }
  finally {
    loading.value = false
  }
}

onMounted(reload)

function sorted(list: TemplateRow[]) {
  return [...list].sort((a, b) =>
    a.position !== b.position ? a.position - b.position : a.label.localeCompare(b.label),
  )
}

async function addTemplate() {
  const lb = newLabel.value.trim()
  if (!lb)
    return
  await apiFetch<TemplateRow>('/api/task-field-templates', {
    method: 'POST',
    body: { label: lb, fieldType: 'text' },
  })
  newLabel.value = ''
  await reload()
}

async function patchRemote(
  row: TemplateRow,
  patch: Partial<Pick<TemplateRow, 'label' | 'fieldType' | 'position'>>,
) {
  await apiFetch(`/api/task-field-templates/${row.id}`, {
    method: 'PATCH',
    body: patch,
  })
}

async function patchRow(
  row: TemplateRow,
  patch: Partial<Pick<TemplateRow, 'label' | 'fieldType' | 'position'>>,
) {
  await patchRemote(row, patch)
  await reload()
}

async function moveTpl(row: TemplateRow, delta: number) {
  const list = sorted(rows.value)
  const ix = list.findIndex(t => t.id === row.id)
  const nx = ix + delta
  if (ix < 0 || nx < 0 || nx >= list.length)
    return
  const a = list[ix]!
  const b = list[nx]!
  await patchRemote(a, { position: b.position })
  await patchRemote(b, { position: a.position })
  await reload()
}

async function removeTpl(id: string) {
  await apiFetch(`/api/task-field-templates/${id}`, { method: 'DELETE' })
  await reload()
}

function requestRemoveTpl(id: string) {
  pendingTemplateId.value = id
  showDeleteTemplateConfirm.value = true
}

async function confirmRemoveTpl() {
  const id = pendingTemplateId.value
  if (!id)
    return
  deletingTemplate.value = true
  try {
    await removeTpl(id)
    showDeleteTemplateConfirm.value = false
    pendingTemplateId.value = null
  }
  finally {
    deletingTemplate.value = false
  }
}
</script>

<template>
  <div class="relative mx-auto min-h-full w-full max-w-5xl px-4 py-10 sm:px-8">
    <div class="mb-10 flex flex-wrap items-center gap-4">
      <NuxtLink
        to="/tasks"
        class="inline-flex items-center rounded-[var(--ui-control-radius)] border border-zinc-200 px-4 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
      >
        ← Tasks
      </NuxtLink>
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900">
          Field templates
        </h1>
        <p class="mt-1 text-sm text-zinc-500">
          New tasks get editable values for each template field.
        </p>
      </div>
    </div>

    <div v-if="loading">
      <UiEmptyState title="Loading templates" description="Please wait while field templates are fetched." />
    </div>

    <div v-else>
      <UCard class="rounded-[var(--ui-panel-radius)] ring-1 ring-zinc-950/[0.04]">
        <template #header>
          <span class="font-semibold text-zinc-900">Custom fields</span>
        </template>
        <div class="flex gap-2">
          <UInput v-model="newLabel" class="flex-1 rounded-[var(--ui-control-radius)]" placeholder="New label…" />
          <UButton color="neutral" class="rounded-[var(--ui-control-radius)]" size="xs" icon="i-lucide-plus" @click="addTemplate">
            Add
          </UButton>
        </div>
        <ul class="mt-5 space-y-2">
          <li v-for="row in sorted(rows)" :key="row.id" class="rounded-[var(--ui-control-radius)] border border-zinc-100 bg-zinc-50/70 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <UInput
                size="xs"
                :model-value="row.label"
                class="min-w-[10rem] flex-1 rounded-[var(--ui-control-radius)]"
                @blur="
                  evt => patchRow(row, {
                    label: ((evt.target as HTMLInputElement)?.value ?? row.label).trim(),
                  })"
              />
              <select
                class="ui-select"
                @change="
                  evt => patchRow(row, {
                    fieldType: (evt.target as HTMLSelectElement).value,
                  })"
              >
                <option
                  v-for="opt in fieldOpts"
                  :key="row.id + opt.value"
                  :value="opt.value"
                  :selected="opt.value === row.fieldType"
                >
                  {{ opt.label }}
                </option>
              </select>
              <UButton variant="ghost" color="neutral" square size="xs" icon="i-lucide-chevron-up" @click="moveTpl(row, -1)" />
              <UButton variant="ghost" color="neutral" square size="xs" icon="i-lucide-chevron-down" @click="moveTpl(row, 1)" />
              <UButton variant="ghost" color="error" square size="xs" icon="i-lucide-trash-2" @click="requestRemoveTpl(row.id)" />
            </div>
          </li>
        </ul>
      </UCard>
    </div>

    <UiConfirmDeleteDialog
      v-model:open="showDeleteTemplateConfirm"
      title="Delete field template"
      description="This template will be removed. Existing tasks keep their values until you edit them."
      :loading="deletingTemplate"
      @confirm="confirmRemoveTpl"
    />
  </div>
</template>
