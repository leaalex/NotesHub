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
} = useLibraryTaskFieldTemplates()

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
</script>

<template>
  <div role="tabpanel">
    <UiEmptyState
      v-if="loading"
      title="Loading templates"
      description="Please wait while field templates are fetched."
    />
    <div v-else class="max-w-xl space-y-6">
      <p class="text-sm leading-relaxed text-zinc-500">
        New tasks get editable values for each template field.
      </p>

      <template v-if="!selectedRow">
        <UiEmptyState
          title="No field selected"
          description="Pick a field in the middle column to edit it, or add a new template there."
        />
      </template>

      <template v-else>
        <UCard class="rounded-[var(--ui-panel-radius)] ring-1 ring-zinc-950/[0.04]">
          <template #header>
            <span class="font-semibold text-zinc-900">Custom field</span>
          </template>
          <div class="space-y-4">
            <UFormField label="Label">
              <UInput
                :model-value="selectedRow.label"
                class="rounded-[var(--ui-control-radius)]"
                @blur="
                  evt => patchRow(selectedRow!, {
                    label: ((evt.target as HTMLInputElement)?.value ?? selectedRow!.label).trim(),
                  })"
              />
            </UFormField>
            <UFormField label="Field type">
              <select
                class="ui-select w-full max-w-md"
                :value="selectedRow.fieldType"
                @change="
                  evt => patchRow(selectedRow!, {
                    fieldType: (evt.target as HTMLSelectElement).value,
                  })"
              >
                <option
                  v-for="opt in fieldTypeOptions"
                  :key="selectedRow.id + opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </UFormField>
            <div class="flex flex-wrap gap-2">
              <UButton variant="soft" color="neutral" size="xs" class="rounded-[var(--ui-control-radius)]" icon="i-lucide-chevron-up" @click="moveTpl(selectedRow, -1)">
                Move up
              </UButton>
              <UButton variant="soft" color="neutral" size="xs" class="rounded-[var(--ui-control-radius)]" icon="i-lucide-chevron-down" @click="moveTpl(selectedRow, 1)">
                Move down
              </UButton>
              <UButton variant="soft" color="error" size="xs" class="rounded-[var(--ui-control-radius)]" icon="i-lucide-trash-2" @click="requestRemove(selectedRow.id)">
                Delete
              </UButton>
            </div>
          </div>
        </UCard>
      </template>
    </div>

    <UiConfirmDeleteDialog
      v-model:open="deleteOpen"
      title="Delete field template"
      description="This template will be removed. Existing tasks keep their values until you edit them."
      :loading="deleting"
      @confirm="confirmRemove"
    />
  </div>
</template>
