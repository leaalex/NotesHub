<script setup lang="ts">
import type { LibrarySimpleTplRow } from '~/composables/useLibraryTaskFieldTemplates'

const route = useRoute()
const { sel, selectTask, neighborId, clearSelectedId } = useLibraryFieldTemplateSelection()

const {
  rows,
  loading,
  sorted,
  fieldTypeOptions,
  patchRow,
  moveTpl,
  removeTpl,
  reload,
  addTemplate,
} = useLibraryTaskFieldTemplates()

const DEFAULT_NEW_LABEL = 'New field'

async function createField() {
  const id = await addTemplate(DEFAULT_NEW_LABEL)
  if (id)
    selectTask(id)
}

const deleteOpen = ref(false)
const deletePending = ref<string | null>(null)
const deleting = ref(false)

const selectedRow = computed((): LibrarySimpleTplRow | null => {
  if (sel.value.page !== 'task' || !sel.value.selectedId)
    return null
  return rows.value.find(r => r.id === sel.value.selectedId) ?? null
})

watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/library/task-fields'))
      void reload()
  },
  { immediate: true },
)

function requestRemove(id: string) {
  deletePending.value = id
  deleteOpen.value = true
}

async function confirmRemove() {
  const id = deletePending.value
  if (!id)
    return
  const sortedIds = sorted(rows.value).map(r => r.id)
  const next = neighborId(sortedIds, id)
  deleting.value = true
  try {
    await removeTpl(id)
    deleteOpen.value = false
    deletePending.value = null
    if (sel.value.selectedId === id) {
      if (next)
        selectTask(next)
      else
        clearSelectedId()
    }
  }
  finally {
    deleting.value = false
  }
}

const editingTpl = ref(false)
const tplDraftLabel = ref('')
const tplDraftFieldType = ref('text')

watch(() => selectedRow.value?.id, () => {
  editingTpl.value = false
})

watch(editingTpl, (on) => {
  const r = selectedRow.value
  if (on && r) {
    tplDraftLabel.value = r.label
    tplDraftFieldType.value = r.fieldType
  }
})

function viewDash(v: string | null | undefined) {
  const s = String(v ?? '').trim()
  return s.length ? s : '—'
}

function fieldTypeLabel(ft: string) {
  return fieldTypeOptions.find(o => o.value === ft)?.label ?? ft
}

async function doneEditingTpl() {
  const r = selectedRow.value
  if (!r)
    return
  const label = tplDraftLabel.value.trim()
  const fieldType = tplDraftFieldType.value
  if (label !== r.label.trim() || fieldType !== r.fieldType)
    await patchRow(r, { label, fieldType })
  editingTpl.value = false
}

async function onMoveTpl(delta: number) {
  if (editingTpl.value)
    await doneEditingTpl()
  const r = selectedRow.value
  if (r)
    await moveTpl(r, delta)
}

async function onDeleteTpl() {
  if (editingTpl.value)
    await doneEditingTpl()
  const r = selectedRow.value
  if (r)
    requestRemove(r.id)
}
</script>

<template>
  <div role="tabpanel" class="flex min-h-0 min-w-0 flex-1 flex-col">
    <div
      v-if="loading"
      class="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-8 py-12 text-center"
    >
      <UiEmptyState
        title="Loading templates"
        description="Please wait while field templates are fetched."
      />
    </div>
    <template v-else>
      <div
        v-if="!selectedRow"
        class="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-8 py-12 text-center"
      >
        <UiEmptyState
          title="No field selected"
          description="Choose a template in the middle column to edit its label and type, or add a new one there."
        >
          <template #actions>
            <UButton
              color="neutral"
              size="md"
              icon="i-lucide-plus"
              class="rounded-[var(--ui-control-radius)] px-5 ring-1 ring-zinc-200/80"
              @click="createField"
            >
              New field
            </UButton>
          </template>
        </UiEmptyState>
      </div>

      <div v-else class="min-h-0 min-w-0 w-full flex-1 pt-4">
        <div class="overflow-hidden rounded-[var(--ui-panel-radius)] border border-zinc-100 bg-white ring-1 ring-zinc-950/[0.04]">
          <header class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100/90 px-4 py-3 sm:px-5">
            <span class="font-semibold text-zinc-900">Custom field</span>
            <div class="flex shrink-0 flex-wrap items-center gap-2">
              <div
                v-if="editingTpl"
                class="flex shrink-0 flex-wrap items-center gap-1 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]"
              >
                <UButton
                  variant="soft"
                  color="neutral"
                  size="xs"
                  icon="i-lucide-chevron-up"
                  class="rounded-[var(--ui-control-radius)]"
                  @click="onMoveTpl(-1)"
                >
                  Move up
                </UButton>
                <UButton
                  variant="soft"
                  color="neutral"
                  size="xs"
                  icon="i-lucide-chevron-down"
                  class="rounded-[var(--ui-control-radius)]"
                  @click="onMoveTpl(1)"
                >
                  Move down
                </UButton>
                <UButton
                  icon="i-lucide-check"
                  color="success"
                  variant="soft"
                  size="xs"
                  class="ui-done-btn rounded-[var(--ui-control-radius)] px-3"
                  @click="doneEditingTpl"
                >
                  Done
                </UButton>
                <UButton
                  variant="soft"
                  color="error"
                  size="xs"
                  icon="i-lucide-trash-2"
                  class="rounded-[var(--ui-control-radius)]"
                  @click="onDeleteTpl"
                >
                  Delete
                </UButton>
              </div>
              <div
                v-else
                class="flex shrink-0 flex-wrap items-center gap-1.5 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]"
              >
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  class="rounded-[var(--ui-control-radius)] px-3"
                  @click="editingTpl = true"
                >
                  Edit
                </UButton>
              </div>
            </div>
          </header>
          <template v-if="!editingTpl">
            <div class="space-y-3 px-4 py-5 sm:px-5">
              <div class="rounded-[var(--ui-control-radius)] border border-zinc-100 bg-white p-3">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Label
                </div>
                <div class="mt-2 text-[13px] text-zinc-900">
                  {{ viewDash(selectedRow.label) }}
                </div>
              </div>
              <div class="rounded-[var(--ui-control-radius)] border border-zinc-100 bg-white p-3">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Field type
                </div>
                <div class="mt-2 text-[13px] text-zinc-900">
                  {{ fieldTypeLabel(selectedRow.fieldType) }}
                </div>
              </div>
            </div>
          </template>
          <div v-else class="space-y-4 px-4 py-5 sm:px-5">
            <UFormField label="Label">
              <UInput v-model="tplDraftLabel" class="rounded-[var(--ui-control-radius)]" />
            </UFormField>
            <UFormField label="Field type">
              <select v-model="tplDraftFieldType" class="ui-select w-full">
                <option
                  v-for="opt in fieldTypeOptions"
                  :key="selectedRow.id + opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </UFormField>
          </div>
        </div>
      </div>
    </template>

    <UiConfirmDeleteDialog
      v-model:open="deleteOpen"
      title="Delete field template"
      description="This template will be removed. Existing tasks keep their values until you edit them."
      :loading="deleting"
      @confirm="confirmRemove"
    />
  </div>
</template>
