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
  addTemplate,
} = useLibraryContactFieldTemplates()

const DEFAULT_NEW_LABEL = 'New field'

async function createPersonField() {
  const id = await addTemplate('person', DEFAULT_NEW_LABEL)
  if (id)
    selectContact('person', id)
}

async function createOrganizationField() {
  const id = await addTemplate('organization', DEFAULT_NEW_LABEL)
  if (id)
    selectContact('organization', id)
}

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
            <div class="flex flex-col items-center justify-center gap-2 sm:flex-row">
              <UButton
                color="neutral"
                size="md"
                icon="i-lucide-plus"
                class="rounded-[var(--ui-control-radius)] px-5 ring-1 ring-zinc-200/80"
                @click="createPersonField"
              >
                New person field
              </UButton>
              <UButton
                color="neutral"
                size="md"
                icon="i-lucide-plus"
                variant="soft"
                class="rounded-[var(--ui-control-radius)] px-5 ring-1 ring-zinc-200/80"
                @click="createOrganizationField"
              >
                New organization field
              </UButton>
            </div>
          </template>
        </UiEmptyState>
      </div>

      <div v-else class="min-h-0 min-w-0 max-w-xl flex-1 pt-4">
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
      </div>
    </template>

    <UiConfirmDeleteDialog
      v-model:open="contactDeleteOpen"
      title="Delete field template"
      description="This template will be permanently removed and unavailable for new contacts."
      :loading="contactDeleting"
      @confirm="confirmRemove"
    />
  </div>
</template>
