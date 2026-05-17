<script setup lang="ts">
import { FIELD_TYPE_OPTIONS } from '#shared/field-template-options'
import type { LibraryContactTplRow } from '~/composables/useLibraryContactFieldTemplates'

const route = useRoute()
const {
  sel,
  showContactCreate,
  selectContact,
  openContactCreate,
  closeContactCreate,
  neighborId,
  clearSelectedId,
} = useLibraryFieldTemplateSelection()

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

// ── create form state ─────────────────────────────────────────────────────────
const createTab = ref<'person' | 'organization'>('person')
const createLabel = ref('')
const createFieldType = ref('text')
const creating = ref(false)

async function submitCreate() {
  creating.value = true
  const subset = createTab.value
  try {
    const id = await addTemplate(subset, createLabel.value.trim() || 'New field', createFieldType.value)
    if (id) {
      createLabel.value = ''
      createFieldType.value = 'text'
      createTab.value = 'person'
      selectContact(subset, id)
    }
  }
  finally {
    creating.value = false
  }
}

function cancelCreate() {
  createLabel.value = ''
  createFieldType.value = 'text'
  createTab.value = 'person'
  closeContactCreate()
}

// ── edit / delete ─────────────────────────────────────────────────────────────
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
  const subset = sel.value.contactSubset
  if (!subset)
    return
  if (editingTpl.value)
    await doneEditingTpl()
  const r = selectedRow.value
  const sibs = subset === 'person' ? personRows.value : orgRows.value
  if (r)
    await moveTpl(r, delta, sibs)
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
    <!-- loading -->
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
      <!-- create form -->
      <template v-if="showContactCreate">
        <div class="ui-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto pt-4">
          <header class="space-y-1">
            <h1 class="text-xl font-semibold tracking-tight text-zinc-900">
              New contact field
            </h1>
            <p class="text-sm text-zinc-500">
              Choose a contact type and define the field details.
            </p>
          </header>

          <div class="flex rounded-[var(--ui-control-radius)] bg-zinc-100 p-1">
            <button
              type="button"
              class="flex-1 rounded-[var(--ui-control-radius)] px-3 py-2 text-[12px] font-semibold transition-all"
              :class="createTab === 'person' ? 'bg-white text-zinc-900' : 'text-zinc-500'"
              @click="createTab = 'person'"
            >
              Person
            </button>
            <button
              type="button"
              class="flex-1 rounded-[var(--ui-control-radius)] px-3 py-2 text-[12px] font-semibold transition-all"
              :class="createTab === 'organization' ? 'bg-white text-zinc-900' : 'text-zinc-500'"
              @click="createTab = 'organization'"
            >
              Organization
            </button>
          </div>

          <UiGlassPanel class="space-y-4 p-5">
            <UFormField label="Label">
              <UInput
                v-model="createLabel"
                class="rounded-[var(--ui-control-radius)]"
                placeholder="e.g. LinkedIn"
                autofocus
              />
            </UFormField>
            <UFormField label="Field type">
              <select
                v-model="createFieldType"
                class="ui-select w-full"
              >
                <option
                  v-for="opt in FIELD_TYPE_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </UFormField>
          </UiGlassPanel>

          <div class="flex justify-end gap-2 pb-2">
            <UButton
              variant="ghost"
              color="neutral"
              class="rounded-[var(--ui-control-radius)]"
              @click="cancelCreate"
            >
              Cancel
            </UButton>
            <UButton
              color="neutral"
              class="rounded-[var(--ui-control-radius)]"
              :loading="creating"
              icon="i-lucide-check"
              @click="submitCreate"
            >
              Create
            </UButton>
          </div>
        </div>
      </template>

      <!-- empty: nothing selected, not creating -->
      <div
        v-else-if="!selectedRow"
        class="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-8 py-12 text-center"
      >
        <UiEmptyState
          title="No field selected"
          description="Choose a template in the middle column to edit its label and type, or add a new one."
        >
          <template #actions>
            <UButton
              color="neutral"
              size="md"
              icon="i-lucide-plus"
              class="rounded-[var(--ui-control-radius)] px-5 ring-1 ring-zinc-200/80"
              @click="openContactCreate"
            >
              New field
            </UButton>
          </template>
        </UiEmptyState>
      </div>

      <!-- edit selected field -->
      <div v-else class="min-h-0 min-w-0 w-full flex-1 pt-4">
        <div class="overflow-hidden rounded-[var(--ui-panel-radius)] border border-zinc-100 bg-white ring-1 ring-zinc-950/[0.04]">
          <header class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100/90 px-4 py-3 sm:px-5">
            <span class="font-semibold text-zinc-900">
              {{ sel.contactSubset === 'person' ? 'Person field' : 'Organization field' }}
            </span>
            <div class="flex shrink-0 flex-wrap items-center gap-1.5 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]">
              <UButton
                v-if="!editingTpl"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                class="rounded-[var(--ui-control-radius)] px-3"
                @click="editingTpl = true"
              >
                Edit
              </UButton>
              <UButton
                v-else
                icon="i-lucide-check"
                color="neutral"
                variant="ghost"
                size="xs"
                class="rounded-[var(--ui-control-radius)] px-3"
                @click="doneEditingTpl"
              >
                Done
              </UButton>
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
            <div class="flex flex-wrap gap-2">
              <UButton variant="soft" color="neutral" size="xs" class="rounded-[var(--ui-control-radius)]" icon="i-lucide-chevron-up" @click="onMoveTpl(-1)">
                Move up
              </UButton>
              <UButton variant="soft" color="neutral" size="xs" class="rounded-[var(--ui-control-radius)]" icon="i-lucide-chevron-down" @click="onMoveTpl(1)">
                Move down
              </UButton>
              <UButton variant="soft" color="error" size="xs" class="rounded-[var(--ui-control-radius)]" icon="i-lucide-trash-2" @click="onDeleteTpl">
                Delete
              </UButton>
            </div>
          </div>
        </div>
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
