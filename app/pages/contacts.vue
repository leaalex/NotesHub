<script setup lang="ts">
type FolderRow = {
  id: string
  name: string
  parentId: string | null
  position: number
}

type ContactRow = {
  id: string
  displayName: string
  type: string
  folderId: string | null
  updatedAt: string | Date | number
}

const route = useRoute()
const router = useRouter()
const apiFetch = useRequestFetch()

/** Shared with child routes (e.g. `/contacts/new`). */
const folderFilter = useState<'all' | 'unfiled' | string>('contacts:folderFilter', () => 'all')

/** Bump after create/update/delete detail so lists refresh display name. */
const listVersion = useState<number>('contacts:listVersion', () => 0)

const folders = ref<FolderRow[]>([])
const contacts = ref<ContactRow[]>([])

const { open: foldersRailOpen, toggle: toggleFoldersRail } = useFoldersRail()

const searchQuery = ref('')
const viewMode = ref<'cards' | 'table'>('cards')

const filteredContacts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q)
    return contacts.value
  return contacts.value.filter((c) => {
    const name = String(c.displayName ?? '').toLowerCase()
    const type = String(c.type ?? '').toLowerCase()
    return name.includes(q) || type.includes(q)
  })
})

const {
  newFolderName,
  showNewFolder,
  creatingFolder,
  createFolder,
} = useNewFolderModal(folders)

const isNewRoute = computed(() => route.path === '/contacts/new')
/** Parent layout route may omit child `:id`; parse from path so list highlight works. */
const selectedContactId = computed(() => {
  const m = route.path.match(/^\/contacts\/([^/]+)\/?$/)
  if (!m?.[1])
    return ''
  const seg = m[1]
  if (seg === 'new')
    return ''
  return seg
})

async function refreshFolders() {
  folders.value = await apiFetch<FolderRow[]>('/api/folders')
}

async function refreshContacts() {
  const q: Record<string, string> = {}
  if (folderFilter.value === 'unfiled')
    q.folderId = 'unfiled'
  else if (folderFilter.value !== 'all')
    q.folderId = folderFilter.value

  contacts.value = await apiFetch<ContactRow[]>('/api/contacts', { query: q })
}

watch(folderFilter, () => {
  router.push('/contacts').catch(() => {})
  refreshContacts()
})
watch(listVersion, () => {
  refreshContacts()
})

async function ensureTreeData() {
  await Promise.all([refreshFolders(), refreshContacts()])
}

onMounted(ensureTreeData)

function openContact(c: ContactRow) {
  router.push(`/contacts/${c.id}`)
}

function openNewContact() {
  router.push('/contacts/new')
}

function manageFields() {
  void router.push('/library/contact-fields')
}

function cardClasses(c: ContactRow) {
  const active = selectedContactId.value === c.id
    && !isNewRoute.value
    && !!c.id

  const base =
    'flex w-full flex-col items-start rounded-[var(--ui-control-radius)] border px-4 py-3 text-left shadow-sm ring-1 transition-all'
  if (active)
    return `${base} border-zinc-900/15 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-18px_rgba(24,24,27,0.35)] ring-zinc-900/[0.06]`

  return `${base} border-transparent bg-white/50 ring-zinc-950/[0.03] hover:border-zinc-200/80 hover:bg-white/80 hover:shadow-md`
}
</script>

<template>
  <LayoutAppThreeColumn right-pane-scrollable>
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
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4">
        <UiSectionLabel>
          Library
        </UiSectionLabel>
        <div class="flex shrink-0 items-center gap-2">
          <UButton variant="ghost" color="neutral" size="xs" class="rounded-[var(--ui-control-radius)]" @click="manageFields">
            Manage fields
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            class="rounded-[var(--ui-control-radius)] px-4 shadow-sm ring-1 ring-zinc-900/10"
            :class="isNewRoute ? 'ring-zinc-900/30 bg-zinc-100' : ''"
            icon="i-lucide-plus"
            @click="openNewContact"
          >
            New
          </UButton>
        </div>
      </div>
      <ul class="ui-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6">
        <li v-for="c in contacts" :key="c.id">
          <button
            type="button"
            :class="cardClasses(c)"
            @click="openContact(c)"
          >
            <div class="flex w-full items-center justify-between gap-2">
              <span class="line-clamp-1 text-[13px] font-semibold tracking-tight text-zinc-900">{{ c.displayName }}</span>
              <span class="rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                {{ c.type }}
              </span>
            </div>
            <span class="mt-1 text-[10px] tabular-nums text-zinc-400">
              {{ new Date(c.updatedAt as string).toLocaleString() }}
            </span>
          </button>
        </li>
        <li v-if="contacts.length === 0" class="rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400">
          No contacts match your filters.
        </li>
      </ul>
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
