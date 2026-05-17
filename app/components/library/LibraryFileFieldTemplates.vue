<script setup lang="ts">
import type { LibrarySimpleTplRow } from '~/composables/useLibraryTaskFieldTemplates'

const route = useRoute()
const { sel, selectFile, neighborId, clearSelectedId } = useLibraryFieldTemplateSelection()

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
} = useLibraryFileFieldTemplates()

const DEFAULT_NEW_LABEL = 'New field'

async function createField() {
  const id = await addTemplate(DEFAULT_NEW_LABEL)
  if (id)
    selectFile(id)
}

const deleteOpen = ref(false)
const deletePending = ref<string | null>(null)
const deleting = ref(false)

const selectedRow = computed((): LibrarySimpleTplRow | null => {
  if (sel.value.page !== 'file' || !sel.value.selectedId)
    return null
  return rows.value.find(r => r.id === sel.value.selectedId) ?? null
})

watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/library/file-fields'))
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
        selectFile(next)
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

      <div v-else class="min-h-0 min-w-0 max-w-xl flex-1 pt-4">
        <UCard class="rounded-[var(--ui-panel-radius)] ring-1 ring-zinc-950/[0.04]">
          <template #header>
            <span class="font-semibold text-zinc-900">File field template</span>
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
      </div>
    </template>

    <UiConfirmDeleteDialog
      v-model:open="deleteOpen"
      title="Delete field template"
      description="This template will be removed. Existing files keep their values until you edit them."
      :loading="deleting"
      @confirm="confirmRemove"
    />
  </div>
</template>
