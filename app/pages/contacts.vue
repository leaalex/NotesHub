<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'

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
const typeFilter = useState<'all' | 'person' | 'organization'>('contacts:typeFilter', () => 'all')
const search = useState<string>('contacts:search', () => '')

/** Bump after create/update/delete detail so lists refresh display name. */
const listVersion = useState<number>('contacts:listVersion', () => 0)

const folders = ref<FolderRow[]>([])
const contacts = ref<ContactRow[]>([])

const isTemplatesOnly = computed(() => route.path === '/contacts/templates')
const isNewRoute = computed(() => route.path === '/contacts/new')
/** Parent layout route may omit child `:id`; parse from path so list highlight works. */
const selectedContactId = computed(() => {
  const m = route.path.match(/^\/contacts\/([^/]+)\/?$/)
  if (!m?.[1])
    return ''
  const seg = m[1]
  if (seg === 'new' || seg === 'templates')
    return ''
  return seg
})

async function refreshFolders() {
  folders.value = await apiFetch<FolderRow[]>('/api/folders')
}

async function refreshContacts() {
  const q: Record<string, string> = {}
  const s = search.value.trim()
  if (s)
    q.q = s
  if (typeFilter.value !== 'all')
    q.type = typeFilter.value
  if (folderFilter.value === 'unfiled')
    q.folderId = 'unfiled'
  else if (folderFilter.value !== 'all')
    q.folderId = folderFilter.value

  contacts.value = await apiFetch<ContactRow[]>('/api/contacts', { query: q })
}

watchDebounced(search, () => { refreshContacts() }, { debounce: 300 })
watch([folderFilter, typeFilter], () => {
  router.push('/contacts').catch(() => {})
  refreshContacts()
})
watch(listVersion, () => {
  refreshContacts()
})

watch(isTemplatesOnly, (only, was) => {
  if (was && !only)
    ensureTreeData()
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
  router.push('/contacts/templates')
}

function cardClasses(c: ContactRow) {
  const active = selectedContactId.value === c.id
    && !isNewRoute.value
    && !isTemplatesOnly.value
    && !!c.id

  const base =
    'flex w-full flex-col items-start rounded-2xl border px-4 py-3 text-left shadow-sm ring-1 transition-all'
  if (active)
    return `${base} border-zinc-900/15 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-18px_rgba(24,24,27,0.35)] ring-zinc-900/[0.06]`

  return `${base} border-transparent bg-white/50 ring-zinc-950/[0.03] hover:border-zinc-200/80 hover:bg-white/80 hover:shadow-md`
}
</script>

<template>
  <NuxtPage v-if="isTemplatesOnly" />
  <LayoutAppThreeColumn v-else right-pane-scrollable>
    <template #folders>
      <div class="flex flex-col gap-4 border-b border-zinc-200/40 p-4 pb-3">
        <div class="min-w-0">
          <UiSectionLabel>
            Folders
          </UiSectionLabel>
        </div>
        <nav class="flex flex-col gap-1 text-[13px]">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left font-medium transition-colors"
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
            class="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left font-medium transition-colors"
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
            class="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left font-medium transition-colors"
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
        <div class="flex flex-wrap items-center gap-2">
          <UiSectionLabel>
            Directory
          </UiSectionLabel>
          <select
            v-model="typeFilter"
            class="rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-[12px] font-medium text-zinc-700"
          >
            <option value="all">
              All types
            </option>
            <option value="person">
              People
            </option>
            <option value="organization">
              Organizations
            </option>
          </select>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <UButton variant="ghost" color="neutral" size="xs" class="rounded-full" @click="manageFields">
            Manage fields
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            class="rounded-full px-4 shadow-sm ring-1 ring-zinc-900/10"
            :class="isNewRoute ? 'ring-zinc-900/30 bg-zinc-100' : ''"
            icon="i-lucide-plus"
            @click="openNewContact"
          >
            New
          </UButton>
        </div>
      </div>
      <div class="px-4 pb-2">
        <UInput v-model="search" placeholder="Search…" icon="i-lucide-search" size="sm" class="w-full rounded-2xl" />
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
              <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                {{ c.type }}
              </span>
            </div>
            <span class="mt-1 text-[10px] tabular-nums text-zinc-400">
              {{ new Date(c.updatedAt as string).toLocaleString() }}
            </span>
          </button>
        </li>
        <li v-if="contacts.length === 0" class="rounded-2xl border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400">
          No contacts match your filters.
        </li>
      </ul>
    </template>

    <NuxtPage />
  </LayoutAppThreeColumn>
</template>
