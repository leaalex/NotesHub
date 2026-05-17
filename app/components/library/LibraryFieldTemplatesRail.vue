<script setup lang="ts">
import { FIELD_TYPE_OPTIONS } from '#shared/field-template-options'
import type { LibraryContactTplRow } from '~/composables/useLibraryContactFieldTemplates'

const route = useRoute()
const {
  sel,
  selectContact,
  selectTask,
  selectFile,
  openContactCreate,
} = useLibraryFieldTemplateSelection()

const {
  personRows,
  orgRows,
  loading: contactLoading,
  sorted: contactSorted,
  reload: contactReload,
} = useLibraryContactFieldTemplates()

const {
  rows: taskRows,
  loading: taskLoading,
  sorted: taskSorted,
  addTemplate: taskAddTemplate,
  reload: taskReload,
} = useLibraryTaskFieldTemplates()

const {
  rows: fileRows,
  loading: fileLoading,
  sorted: fileSorted,
  addTemplate: fileAddTemplate,
  reload: fileReload,
} = useLibraryFileFieldTemplates()

interface Props {
  searchQuery?: string
  viewMode?: 'cards' | 'table'
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  viewMode: 'cards',
})

function rowClasses(active: boolean) {
  const base =
    'group flex w-full flex-col items-start rounded-[var(--ui-control-radius)] border px-4 py-3 text-left ring-1 transition-all'
  if (active)
    return `${base} border-zinc-900/15 bg-white ring-zinc-900/[0.06]`
  return `${base} border-transparent bg-white ring-zinc-950/[0.03] hover:border-zinc-200/80`
}

function tableRowClasses(active: boolean) {
  const base = 'cursor-pointer transition-colors border-b border-zinc-100/90 text-[13px] text-left'
  if (active)
    return `${base} bg-zinc-900/8 font-medium text-zinc-900`
  return `${base} text-zinc-800 hover:bg-white/75`
}

function filterRows<T extends { label?: string | null }>(rows: readonly T[]): T[] {
  const q = props.searchQuery.trim().toLowerCase()
  if (!q)
    return [...rows]
  return rows.filter(r => String(r.label ?? '').toLowerCase().includes(q))
}

const filteredPersonRows = computed(() => filterRows(contactSorted(personRows.value)))
const filteredOrgRows = computed(() => filterRows(contactSorted(orgRows.value)))

type ContactFieldRailEntry = {
  row: LibraryContactTplRow
  subset: 'person' | 'organization'
}

/** Person templates first, then organization (same order as before the rail merged into one list). */
const contactFieldsMergedRows = computed((): ContactFieldRailEntry[] => [
  ...filteredPersonRows.value.map(row => ({ row, subset: 'person' as const })),
  ...filteredOrgRows.value.map(row => ({ row, subset: 'organization' as const })),
])

const filteredTaskRows = computed(() => filterRows(taskSorted(taskRows.value)))
const filteredFileRows = computed(() => filterRows(fileSorted(fileRows.value)))

function typeLabel(v: string) {
  const o = FIELD_TYPE_OPTIONS.find(x => x.value === v)
  return o?.label ?? v
}

watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/library/contact-fields'))
      void contactReload()
    else if (path.startsWith('/library/task-fields'))
      void taskReload()
    else if (path.startsWith('/library/file-fields'))
      void fileReload()
  },
  { immediate: true },
)

const DEFAULT_FIELD_LABEL = 'New field'

async function addTask() {
  const id = await taskAddTemplate(DEFAULT_FIELD_LABEL)
  if (id)
    selectTask(id)
}

async function addFile() {
  const id = await fileAddTemplate(DEFAULT_FIELD_LABEL)
  if (id)
    selectFile(id)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <template v-if="route.path.startsWith('/library/contact-fields')">
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden pb-4">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
          <UiSectionLabel class="mb-0">
            Contact fields
          </UiSectionLabel>
          <UButton
            type="button"
            color="neutral"
            size="xs"
            class="shrink-0 rounded-[var(--ui-control-radius)]"
            icon="i-lucide-plus"
            aria-label="New contact field"
            @click="openContactCreate"
          />
        </div>
        <template v-if="contactLoading">
          <p class="px-2 py-6 text-center text-[13px] text-zinc-400">
            Loading…
          </p>
        </template>
        <ul
          v-else-if="props.viewMode === 'cards'"
          class="ui-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4"
        >
          <li v-for="{ row, subset } in contactFieldsMergedRows" :key="`${subset}-${row.id}`">
            <button
              type="button"
              :class="rowClasses(sel.page === 'contact' && sel.contactSubset === subset && sel.selectedId === row.id)"
              class="w-full"
              @click="selectContact(subset, row.id)"
            >
              <div class="flex w-full items-center justify-between gap-2">
                <span class="line-clamp-1 flex-1 text-left text-[13px] font-semibold tracking-tight text-zinc-900">
                  {{ row.label.trim() || 'Untitled' }}
                </span>
                <span
                  class="shrink-0 rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600"
                >
                  {{ subset }}
                </span>
              </div>
              <span class="mt-0.5 block text-left text-[11px] text-zinc-500">{{ typeLabel(row.fieldType) }}</span>
            </button>
          </li>
          <li
            v-if="contactFieldsMergedRows.length === 0"
            class="w-full rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
          >
            No contact fields match your search.
          </li>
        </ul>
        <div v-else class="ui-scrollbar flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto px-3 pb-4">
          <table class="w-full min-w-[17rem] border-collapse text-left text-[13px]">
            <thead>
              <tr class="sticky top-0 z-[1] border-b border-zinc-200/80 bg-white/85 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 backdrop-blur-sm">
                <th class="px-2 py-2 font-semibold">
                  Label
                </th>
                <th class="px-2 py-2 font-semibold">
                  Field type
                </th>
                <th class="px-2 py-2 font-semibold">
                  Contact
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="{ row, subset } in contactFieldsMergedRows"
                :key="`${subset}-${row.id}`"
                :class="tableRowClasses(sel.page === 'contact' && sel.contactSubset === subset && sel.selectedId === row.id)"
                @click="selectContact(subset, row.id)"
              >
                <td class="max-w-[10rem] truncate px-2 py-2 font-medium text-zinc-900">
                  {{ row.label.trim() || 'Untitled' }}
                </td>
                <td class="whitespace-nowrap px-2 py-2 text-zinc-600">
                  {{ typeLabel(row.fieldType) }}
                </td>
                <td class="whitespace-nowrap px-2 py-2">
                  <span
                    class="rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600"
                  >
                    {{ subset }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="contactFieldsMergedRows.length === 0"
            class="mt-4 rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
          >
            No contact fields match your search.
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="route.path.startsWith('/library/task-fields')">
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden pb-4">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
          <UiSectionLabel class="mb-0">
            Task fields
          </UiSectionLabel>
          <UButton
            type="button"
            color="neutral"
            size="xs"
            class="shrink-0 rounded-[var(--ui-control-radius)]"
            icon="i-lucide-plus"
            aria-label="Add task field"
            @click="addTask"
          />
        </div>
        <template v-if="taskLoading">
          <p class="px-2 py-6 text-center text-[13px] text-zinc-400">
            Loading…
          </p>
        </template>
        <ul v-else-if="props.viewMode === 'cards'" class="ui-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
          <li v-for="row in filteredTaskRows" :key="row.id">
            <button
              type="button"
              :class="rowClasses(sel.page === 'task' && sel.selectedId === row.id)"
              class="w-full"
              @click="selectTask(row.id)"
            >
              <span class="line-clamp-2 text-left text-[13px] font-semibold text-zinc-900">{{ row.label.trim() || 'Untitled' }}</span>
              <span class="mt-0.5 text-[11px] text-zinc-500">{{ typeLabel(row.fieldType) }}</span>
            </button>
          </li>
        </ul>
        <div v-else class="ui-scrollbar flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto px-3 pb-4">
          <table class="w-full min-w-[12rem] border-collapse text-left text-[13px]">
            <thead>
              <tr class="sticky top-0 z-[1] border-b border-zinc-200/80 bg-white/85 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 backdrop-blur-sm">
                <th class="px-2 py-2 font-semibold">
                  Label
                </th>
                <th class="px-2 py-2 font-semibold">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredTaskRows"
                :key="row.id"
                :class="tableRowClasses(sel.page === 'task' && sel.selectedId === row.id)"
                @click="selectTask(row.id)"
              >
                <td class="max-w-[11rem] truncate px-2 py-2 font-medium text-zinc-900">
                  {{ row.label.trim() || 'Untitled' }}
                </td>
                <td class="whitespace-nowrap px-2 py-2 text-zinc-600">
                  {{ typeLabel(row.fieldType) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="filteredTaskRows.length === 0"
            class="mt-4 rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
          >
            No task fields match your search.
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="route.path.startsWith('/library/file-fields')">
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden pb-4">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
          <UiSectionLabel class="mb-0">
            File fields
          </UiSectionLabel>
          <UButton
            type="button"
            color="neutral"
            size="xs"
            class="shrink-0 rounded-[var(--ui-control-radius)]"
            icon="i-lucide-plus"
            aria-label="Add file field"
            @click="addFile"
          />
        </div>
        <template v-if="fileLoading">
          <p class="px-2 py-6 text-center text-[13px] text-zinc-400">
            Loading…
          </p>
        </template>
        <ul v-else-if="props.viewMode === 'cards'" class="ui-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
          <li v-for="row in filteredFileRows" :key="row.id">
            <button
              type="button"
              :class="rowClasses(sel.page === 'file' && sel.selectedId === row.id)"
              class="w-full"
              @click="selectFile(row.id)"
            >
              <span class="line-clamp-2 text-left text-[13px] font-semibold text-zinc-900">{{ row.label.trim() || 'Untitled' }}</span>
              <span class="mt-0.5 text-[11px] text-zinc-500">{{ typeLabel(row.fieldType) }}</span>
            </button>
          </li>
        </ul>
        <div v-else class="ui-scrollbar flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto px-3 pb-4">
          <table class="w-full min-w-[12rem] border-collapse text-left text-[13px]">
            <thead>
              <tr class="sticky top-0 z-[1] border-b border-zinc-200/80 bg-white/85 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 backdrop-blur-sm">
                <th class="px-2 py-2 font-semibold">
                  Label
                </th>
                <th class="px-2 py-2 font-semibold">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredFileRows"
                :key="row.id"
                :class="tableRowClasses(sel.page === 'file' && sel.selectedId === row.id)"
                @click="selectFile(row.id)"
              >
                <td class="max-w-[11rem] truncate px-2 py-2 font-medium text-zinc-900">
                  {{ row.label.trim() || 'Untitled' }}
                </td>
                <td class="whitespace-nowrap px-2 py-2 text-zinc-600">
                  {{ typeLabel(row.fieldType) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="filteredFileRows.length === 0"
            class="mt-4 rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
          >
            No file fields match your search.
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
