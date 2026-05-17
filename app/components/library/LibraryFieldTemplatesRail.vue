<script setup lang="ts">
import { FIELD_TYPE_OPTIONS } from '#shared/field-template-options'

const route = useRoute()
const {
  sel,
  selectContact,
  selectTask,
  selectFile,
} = useLibraryFieldTemplateSelection()

const {
  personRows,
  orgRows,
  loading: contactLoading,
  sorted: contactSorted,
  addTemplate: contactAddTemplate,
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

const newPerson = ref('')
const newOrg = ref('')
const newTask = ref('')
const newFile = ref('')

function rowClasses(active: boolean) {
  const base =
    'flex w-full flex-col items-start rounded-[var(--ui-control-radius)] border px-3 py-2.5 text-left shadow-sm ring-1 transition-all'
  if (active)
    return `${base} border-zinc-900/15 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-18px_rgba(24,24,27,0.35)] ring-zinc-900/[0.06]`
  return `${base} border-transparent bg-white/50 ring-zinc-950/[0.03] hover:border-zinc-200/80 hover:bg-white/80 hover:shadow-md`
}

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

async function addPerson() {
  const lb = newPerson.value.trim() || DEFAULT_FIELD_LABEL
  const id = await contactAddTemplate('person', lb)
  newPerson.value = ''
  if (id)
    selectContact('person', id)
}

async function addOrg() {
  const lb = newOrg.value.trim() || DEFAULT_FIELD_LABEL
  const id = await contactAddTemplate('organization', lb)
  newOrg.value = ''
  if (id)
    selectContact('organization', id)
}

async function addTask() {
  const lb = newTask.value.trim() || DEFAULT_FIELD_LABEL
  const id = await taskAddTemplate(lb)
  newTask.value = ''
  if (id)
    selectTask(id)
}

async function addFile() {
  const lb = newFile.value.trim() || DEFAULT_FIELD_LABEL
  const id = await fileAddTemplate(lb)
  newFile.value = ''
  if (id)
    selectFile(id)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <template v-if="route.path.startsWith('/library/contact-fields')">
      <div class="ui-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-4">
        <template v-if="contactLoading">
          <p class="px-2 py-6 text-center text-[13px] text-zinc-400">
            Loading…
          </p>
        </template>
        <template v-else>
          <div>
            <UiSectionLabel class="mb-2 px-1">
              People
            </UiSectionLabel>
            <form class="flex gap-1.5 px-1" @submit.prevent="addPerson">
              <UInput v-model="newPerson" size="xs" class="min-w-0 flex-1 rounded-[var(--ui-control-radius)]" placeholder="New label…" />
              <UButton type="submit" color="neutral" size="xs" class="shrink-0 rounded-[var(--ui-control-radius)]" icon="i-lucide-plus" aria-label="Add person field" />
            </form>
            <ul class="mt-2 flex flex-col gap-1.5">
              <li v-for="row in contactSorted(personRows)" :key="row.id">
                <button
                  type="button"
                  :class="rowClasses(sel.page === 'contact' && sel.contactSubset === 'person' && sel.selectedId === row.id)"
                  class="w-full"
                  @click="selectContact('person', row.id)"
                >
                  <span class="line-clamp-2 text-left text-[13px] font-semibold text-zinc-900">{{ row.label.trim() || 'Untitled' }}</span>
                  <span class="mt-0.5 text-[11px] text-zinc-500">{{ typeLabel(row.fieldType) }}</span>
                </button>
              </li>
            </ul>
          </div>
          <div>
            <UiSectionLabel class="mb-2 px-1">
              Organizations
            </UiSectionLabel>
            <form class="flex gap-1.5 px-1" @submit.prevent="addOrg">
              <UInput v-model="newOrg" size="xs" class="min-w-0 flex-1 rounded-[var(--ui-control-radius)]" placeholder="New label…" />
              <UButton type="submit" color="neutral" size="xs" class="shrink-0 rounded-[var(--ui-control-radius)]" icon="i-lucide-plus" aria-label="Add organization field" />
            </form>
            <ul class="mt-2 flex flex-col gap-1.5">
              <li v-for="row in contactSorted(orgRows)" :key="row.id">
                <button
                  type="button"
                  :class="rowClasses(sel.page === 'contact' && sel.contactSubset === 'organization' && sel.selectedId === row.id)"
                  class="w-full"
                  @click="selectContact('organization', row.id)"
                >
                  <span class="line-clamp-2 text-left text-[13px] font-semibold text-zinc-900">{{ row.label.trim() || 'Untitled' }}</span>
                  <span class="mt-0.5 text-[11px] text-zinc-500">{{ typeLabel(row.fieldType) }}</span>
                </button>
              </li>
            </ul>
          </div>
        </template>
      </div>
    </template>

    <template v-else-if="route.path.startsWith('/library/task-fields')">
      <div class="flex min-h-0 flex-1 flex-col px-3 pb-4 pt-4">
        <UiSectionLabel class="mb-2 px-1">
          Task fields
        </UiSectionLabel>
        <form class="flex gap-1.5 px-1" @submit.prevent="addTask">
          <UInput v-model="newTask" size="xs" class="min-w-0 flex-1 rounded-[var(--ui-control-radius)]" placeholder="New label…" />
          <UButton type="submit" color="neutral" size="xs" class="shrink-0 rounded-[var(--ui-control-radius)]" icon="i-lucide-plus" aria-label="Add task field" />
        </form>
        <template v-if="taskLoading">
          <p class="px-2 py-6 text-center text-[13px] text-zinc-400">
            Loading…
          </p>
        </template>
        <ul v-else class="ui-scrollbar mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          <li v-for="row in taskSorted(taskRows)" :key="row.id">
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
      </div>
    </template>

    <template v-else-if="route.path.startsWith('/library/file-fields')">
      <div class="flex min-h-0 flex-1 flex-col px-3 pb-4 pt-4">
        <UiSectionLabel class="mb-2 px-1">
          File fields
        </UiSectionLabel>
        <form class="flex gap-1.5 px-1" @submit.prevent="addFile">
          <UInput v-model="newFile" size="xs" class="min-w-0 flex-1 rounded-[var(--ui-control-radius)]" placeholder="New label…" />
          <UButton type="submit" color="neutral" size="xs" class="shrink-0 rounded-[var(--ui-control-radius)]" icon="i-lucide-plus" aria-label="Add file field" />
        </form>
        <template v-if="fileLoading">
          <p class="px-2 py-6 text-center text-[13px] text-zinc-400">
            Loading…
          </p>
        </template>
        <ul v-else class="ui-scrollbar mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          <li v-for="row in fileSorted(fileRows)" :key="row.id">
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
      </div>
    </template>
  </div>
</template>
