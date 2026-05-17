<script setup lang="ts">
type FolderRow = {
  id: string
  name: string
  parentId: string | null
  position: number
}

type TaskRow = {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  folderId: string | null
  shareEnabled?: boolean
  updatedAt: string | Date | number
}

const route = useRoute()
const router = useRouter()
const apiFetch = useRequestFetch()

const folderFilter = useState<'all' | 'unfiled' | string>('tasks:folderFilter', () => 'all')
const listVersion = useState<number>('tasks:listVersion', () => 0)

const folders = ref<FolderRow[]>([])
const taskList = ref<TaskRow[]>([])

const { open: foldersRailOpen, toggle: toggleFoldersRail } = useFoldersRail()

const searchQuery = ref('')
const viewMode = ref<'cards' | 'table'>('cards')

const filteredTasks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q)
    return taskList.value
  return taskList.value.filter((t) => {
    const title = String(t.title ?? '').toLowerCase()
    const desc = String(t.description ?? '').toLowerCase()
    const status = statusLabel(t.status).toLowerCase()
    const priority = String(t.priority ?? '').toLowerCase()
    return title.includes(q) || desc.includes(q) || status.includes(q) || priority.includes(q)
  })
})

const {
  newFolderName,
  showNewFolder,
  creatingFolder,
  createFolder,
} = useNewFolderModal(folders)

const isNewRoute = computed(() => route.path === '/tasks/new')
const selectedTaskId = computed(() => {
  const m = route.path.match(/^\/tasks\/([^/]+)\/?$/)
  if (!m?.[1])
    return ''
  const seg = m[1]
  if (seg === 'new')
    return ''
  return seg
})

function statusLabel(s: string) {
  return s.replaceAll('_', ' ')
}

function taskExcerpt(t: TaskRow) {
  const d = (t.description ?? '').trim().replace(/\s+/g, ' ')
  if (d.length)
    return d
  return 'No description yet'
}

function formatUpdated(ua: string | Date | number) {
  const d = new Date(ua as string)
  return {
    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  }
}

async function refreshFolders() {
  folders.value = await apiFetch<FolderRow[]>('/api/folders')
}

async function refreshTasks() {
  const q: Record<string, string> = {}
  if (folderFilter.value === 'unfiled')
    q.folderId = 'unfiled'
  else if (folderFilter.value !== 'all')
    q.folderId = folderFilter.value

  taskList.value = await apiFetch<TaskRow[]>('/api/tasks', { query: q })
}

watch(folderFilter, () => {
  router.push('/tasks').catch(() => {})
  refreshTasks()
})
watch(listVersion, () => {
  refreshTasks()
})

async function ensureTreeData() {
  await Promise.all([refreshFolders(), refreshTasks()])
}

onMounted(ensureTreeData)

function openTask(t: TaskRow) {
  router.push(`/tasks/${t.id}`)
}

function openNewTask() {
  router.push('/tasks/new')
}

function manageFields() {
  void router.push('/library/task-fields')
}

function cardClasses(t: TaskRow) {
  const active = selectedTaskId.value === t.id
    && !isNewRoute.value
    && !!t.id

  const base =
    'group flex w-full flex-col items-start rounded-[var(--ui-control-radius)] border px-4 py-3 text-left shadow-sm ring-1 transition-all'
  if (active)
    return `${base} border-zinc-900/15 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-18px_rgba(24,24,27,0.35)] ring-zinc-900/[0.06]`

  return `${base} border-transparent bg-white/50 ring-zinc-950/[0.03] hover:border-zinc-200/80 hover:bg-white/80 hover:shadow-md`
}

function tableRowClasses(t: TaskRow) {
  const active = selectedTaskId.value === t.id
    && !isNewRoute.value
    && !!t.id
  const base = 'cursor-pointer transition-colors text-left text-[13px]'
  if (active)
    return `${base} bg-zinc-900/8 font-medium text-zinc-900`
  return `${base} text-zinc-800 hover:bg-white/75`
}
</script>

<template>
  <LayoutAppThreeColumn right-pane-scrollable :view-mode="viewMode">
    <template #subheader>
      <UButton
        variant="ghost"
        color="neutral"
        square
        size="sm"
        class="shrink-0 rounded-[var(--ui-control-radius)] ring-1 ring-zinc-200/80 hover:bg-white/80"
        :icon="foldersRailOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
        :aria-label="foldersRailOpen ? 'Hide folders' : 'Show folders'"
        :aria-pressed="foldersRailOpen"
        @click="toggleFoldersRail()"
      />
      <div class="flex min-w-0 flex-1 justify-center">
        <UInput
          v-model="searchQuery"
          placeholder="Search tasks…"
          size="sm"
          icon="i-lucide-search"
          class="w-full max-w-sm"
          :ui="{ base: 'rounded-[var(--ui-control-radius)]' }"
        />
      </div>
      <div class="flex shrink-0 items-center gap-1 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]">
        <UButton
          size="xs"
          :variant="viewMode === 'cards' ? 'solid' : 'ghost'"
          color="neutral"
          icon="i-lucide-layout-list"
          square
          class="rounded-[var(--ui-control-radius)]"
          aria-label="Card view"
          @click="viewMode = 'cards'"
        />
        <UButton
          size="xs"
          :variant="viewMode === 'table' ? 'solid' : 'ghost'"
          color="neutral"
          icon="i-lucide-table-2"
          square
          class="rounded-[var(--ui-control-radius)]"
          aria-label="Table view"
          @click="viewMode = 'table'"
        />
      </div>
    </template>

    <template #folders>
      <div class="flex flex-col gap-4 border-b border-zinc-200/40 p-4 pb-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <UiSectionLabel>
              Folders
            </UiSectionLabel>
          </div>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            square
            class="rounded-[var(--ui-control-radius)] ring-1 ring-zinc-200/80 hover:bg-white/80"
            icon="i-lucide-folder-plus"
            aria-label="New folder"
            @click="showNewFolder = true"
          />
        </div>
        <nav class="flex flex-col gap-1 text-[13px]">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === 'all'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = 'all'"
          >
            <Icon name="i-lucide-layout-grid" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            All
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === 'unfiled'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = 'unfiled'"
          >
            <Icon name="i-lucide-folder-x" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            Unfiled
          </button>
          <button
            v-for="f in folders"
            :key="f.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === f.id
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = f.id"
          >
            <Icon name="i-lucide-folder" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            <span class="truncate">{{ f.name }}</span>
          </button>
        </nav>
      </div>
    </template>

    <template #cards>
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
        <UiSectionLabel>
          Tasks
        </UiSectionLabel>
        <div class="flex shrink-0 items-center gap-2">
          <UButton variant="ghost" color="neutral" size="xs" class="rounded-[var(--ui-control-radius)]" @click="manageFields">
            Manage fields
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            square
            class="rounded-[var(--ui-control-radius)] shadow-sm ring-1 ring-zinc-900/10"
            :class="isNewRoute ? 'ring-zinc-900/30 bg-zinc-100' : ''"
            icon="i-lucide-plus"
            aria-label="New task"
            @click="openNewTask"
          />
        </div>
      </div>
      <template v-if="viewMode === 'cards'">
        <ul class="ui-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
          <li v-for="t in filteredTasks" :key="t.id">
            <button
              type="button"
              :class="cardClasses(t)"
              @click="openTask(t)"
            >
              <div class="flex w-full items-start justify-between gap-2">
                <span class="line-clamp-1 flex-1 text-[13px] font-semibold tracking-tight text-zinc-900">
                  {{ t.title || 'Untitled task' }}
                </span>
                <div class="flex shrink-0 items-center gap-1.5">
                  <span class="rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    {{ statusLabel(t.status) }}
                  </span>
                  <Icon
                    v-if="t.shareEnabled"
                    name="i-lucide-link-2"
                    class="mt-0.5 size-3.5 shrink-0 text-zinc-400 opacity-70 group-hover:opacity-100"
                    aria-hidden="true"
                    title="Shared"
                  />
                </div>
              </div>
              <span class="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500">
                {{ taskExcerpt(t) }}
              </span>
              <span class="mt-2 text-[10px] tabular-nums text-zinc-400">
                {{ formatUpdated(t.updatedAt).date }}
                ·
                {{ formatUpdated(t.updatedAt).time }}
              </span>
            </button>
          </li>
          <li v-if="filteredTasks.length === 0" class="rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400">
            No tasks match your filters.
          </li>
        </ul>
      </template>
      <div v-else class="ui-scrollbar min-h-0 flex-1 overflow-auto px-2 pb-4 pt-2 sm:px-3">
        <table class="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr class="sticky top-0 z-[1] border-b border-zinc-200/80 bg-white/85 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 backdrop-blur-sm">
              <th class="px-2 py-2 font-semibold">
                Title
              </th>
              <th class="px-2 py-2 font-semibold">
                Status
              </th>
              <th class="hidden px-2 py-2 font-semibold lg:table-cell">
                Priority
              </th>
              <th class="hidden px-2 py-2 font-semibold md:table-cell">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in filteredTasks"
              :key="t.id"
              class="border-b border-zinc-100/90"
              :class="tableRowClasses(t)"
              @click="openTask(t)"
            >
              <td class="max-w-[8rem] px-2 py-2 lg:max-w-none">
                <div class="flex min-w-0 items-center gap-1.5">
                  <Icon
                    v-if="t.shareEnabled"
                    name="i-lucide-link-2"
                    class="size-3 shrink-0 text-zinc-400"
                    aria-hidden="true"
                  />
                  <span class="truncate font-medium text-zinc-900">{{ t.title || 'Untitled task' }}</span>
                </div>
              </td>
              <td class="whitespace-nowrap px-2 py-2">
                <span class="rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                  {{ statusLabel(t.status) }}
                </span>
              </td>
              <td class="hidden px-2 py-2 text-zinc-600 lg:table-cell">
                {{ statusLabel(t.priority) }}
              </td>
              <td class="hidden whitespace-nowrap tabular-nums px-2 py-2 text-zinc-500 md:table-cell">
                {{ formatUpdated(t.updatedAt).date }}
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="filteredTasks.length === 0"
          class="rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
        >
          No tasks match your filters.
        </div>
      </div>
    </template>

    <NuxtPage />
  </LayoutAppThreeColumn>

  <UiNewFolderDialog
    v-model:open="showNewFolder"
    v-model:name="newFolderName"
    :creating="creatingFolder"
    @submit="createFolder"
  />
</template>
