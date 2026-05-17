<script setup lang="ts">
import type { LibraryContactTplRow } from '~/composables/useLibraryContactFieldTemplates'

const route = useRoute()
const { sel, selectContact, neighborId, clearSelectedId } = useLibraryFieldTemplateSelection()

const {
  personRows,
  orgRows,
  loading,
  sorted,
  fieldTypeOptions,
  patchRow,
  moveTpl,
  removeTpl,
  reload,
} = useLibraryContactFieldTemplates()

const contactDeleteOpen = ref(false)
const contactDeletePending = ref<string | null>(null)
const contactDeleting = ref(false)

const selectedRow = computed((): LibraryContactTplRow | null => {
  if (sel.value.page !== 'contact' || !sel.value.selectedId || !sel.value.contactSubset)
    return null
  const list = sel.value.contactSubset === 'person' ? personRows.value : orgRows.value
  return list.find(r => r.id === sel.value.selectedId) ?? null
})

const siblings = computed(() => {
  if (sel.value.contactSubset === 'person')
    return personRows.value
  if (sel.value.contactSubset === 'organization')
    return orgRows.value
  return [] as LibraryContactTplRow[]
})

watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/library/contact-fields'))
      void reload()
  },
  { immediate: true },
)

function requestRemove(id: string) {
  contactDeletePending.value = id
  contactDeleteOpen.value = true
}

async function confirmRemove() {
  const id = contactDeletePending.value
  const subset = sel.value.contactSubset
  if (!id || !subset)
    return
  const sortedIds = sorted(subset === 'person' ? personRows.value : orgRows.value).map(r => r.id)
  const next = neighborId(sortedIds, id)
  contactDeleting.value = true
  try {
    await removeTpl(id)
    contactDeleteOpen.value = false
    contactDeletePending.value = null
    if (sel.value.selectedId === id) {
      if (next)
        selectContact(subset, next)
      else
        clearSelectedId()
    }
  }
  finally {
    contactDeleting.value = false
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
        Templates define which extra fields appear on contact forms for people and organizations. You can reorder fields; changes apply to new and existing contacts when they are edited.
      </p>

      <template v-if="!selectedRow">
        <UiEmptyState
          title="No field selected"
          description="Choose a template in the middle column to edit its label and type, or add a new one there."
        />
      </template>

      <template v-else>
        <UCard class="rounded-[var(--ui-panel-radius)] ring-1 ring-zinc-950/[0.04]">
          <template #header>
            <span class="font-semibold text-zinc-900">
              {{ sel.contactSubset === 'person' ? 'Person field' : 'Organization field' }}
            </span>
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
              <UButton variant="soft" color="neutral" size="xs" class="rounded-[var(--ui-control-radius)]" icon="i-lucide-chevron-up" @click="moveTpl(selectedRow, -1, siblings)">
                Move up
              </UButton>
              <UButton variant="soft" color="neutral" size="xs" class="rounded-[var(--ui-control-radius)]" icon="i-lucide-chevron-down" @click="moveTpl(selectedRow, 1, siblings)">
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
      v-model:open="contactDeleteOpen"
      title="Delete field template"
      description="This template will be permanently removed and unavailable for new contacts."
      :loading="contactDeleting"
      @confirm="confirmRemove"
    />
  </div>
</template>
