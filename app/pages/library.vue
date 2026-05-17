<script setup lang="ts">
import AddressCreatePanel from '~/components/addresses/AddressCreatePanel.vue'
import AddressDetailPanel from '~/components/addresses/AddressDetailPanel.vue'
import type { LibraryAddressRow } from '~/composables/useLibraryAddressList'

const route = useRoute()

const {
  addressSearch,
  filteredAddresses,
  addressesLoading,
  lineSummary,
  listVersion,
  selectedAddressId,
  showNewAddress,
  selectAddress,
  openNewAddress,
  clearAddressPanel,
} = useLibraryAddressList()

const navItems: { to: string, label: string, icon: string }[] = [
  { to: '/library/addresses', label: 'Addresses', icon: 'i-lucide-map-pin' },
  { to: '/library/contact-fields', label: 'Contact fields', icon: 'i-lucide-contact' },
  { to: '/library/task-fields', label: 'Task fields', icon: 'i-lucide-list-checks' },
  { to: '/library/file-fields', label: 'File fields', icon: 'i-lucide-image' },
]

function isNavActive(to: string) {
  if (to === '/library/addresses')
    return route.path.startsWith('/library/addresses')
  return route.path === to
}

const showAddressRail = computed(() => route.path.startsWith('/library/addresses'))

const showFieldTemplatesRail = computed(() =>
  route.path.startsWith('/library/contact-fields')
  || route.path.startsWith('/library/task-fields')
  || route.path.startsWith('/library/file-fields'),
)

const viewMode = ref<'cards' | 'table'>('cards')
const fieldSearch = ref('')

watch(
  () => route.path,
  () => {
    viewMode.value = 'cards'
    fieldSearch.value = ''
  },
)

const searchPlaceholder = computed(() => {
  if (route.path.startsWith('/library/addresses'))
    return 'Search addresses…'
  if (route.path.startsWith('/library/contact-fields'))
    return 'Search contact fields…'
  if (route.path.startsWith('/library/task-fields'))
    return 'Search task fields…'
  if (route.path.startsWith('/library/file-fields'))
    return 'Search file fields…'
  return 'Search…'
})

const currentSearch = computed({
  get: () =>
    route.path.startsWith('/library/addresses')
      ? addressSearch.value
      : fieldSearch.value,
  set: (v: string) => {
    if (route.path.startsWith('/library/addresses'))
      addressSearch.value = v
    else fieldSearch.value = v
  },
})

function addressCardClasses(a: LibraryAddressRow) {
  const active = selectedAddressId.value === a.id && !!a.id
  const base =
    'group flex w-full flex-col items-start rounded-[var(--ui-control-radius)] border px-4 py-3 text-left ring-1 transition-all'
  if (active)
    return `${base} border-zinc-900/15 bg-white ring-zinc-900/[0.06]`

  return `${base} border-transparent bg-white ring-zinc-950/[0.03] hover:border-zinc-200/80`
}

function addressTableRowClasses(a: LibraryAddressRow) {
  const active = selectedAddressId.value === a.id && !!a.id
  const base = 'cursor-pointer transition-colors border-b border-zinc-100/90 text-[13px] text-left'
  if (active)
    return `${base} bg-zinc-900/8 font-medium text-zinc-900`
  return `${base} text-zinc-800 hover:bg-white/75`
}

function onAddressSaved(id: string) {
  listVersion.value++
  selectAddress(id)
}

function onAddressDeleted() {
  listVersion.value++
  clearAddressPanel()
}
</script>

<template>
  <LayoutAppThreeColumn folders-pinned right-pane-scrollable :view-mode="viewMode">
    <template #subheader>
      <div class="flex min-w-0 flex-1 justify-center">
        <UInput
          v-model="currentSearch"
          size="sm"
          icon="i-lucide-search"
          class="w-full max-w-sm"
          :placeholder="searchPlaceholder"
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
        <div class="min-w-0">
          <UiSectionLabel>Templates</UiSectionLabel>
        </div>
        <nav class="flex flex-col gap-1 text-[13px]" role="tablist" aria-label="Templates sections">
          <NuxtLink
            v-for="t in navItems"
            :key="t.to"
            :to="t.to"
            role="tab"
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
            :class="isNavActive(t.to)
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-600 hover:bg-white/70'"
            :aria-selected="isNavActive(t.to)"
          >
            <Icon :name="t.icon" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            <span class="truncate">{{ t.label }}</span>
          </NuxtLink>
        </nav>
      </div>
    </template>

    <template #cards>
      <template v-if="showAddressRail">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
          <UiSectionLabel class="mb-0 w-full sm:w-auto">
            Addresses
          </UiSectionLabel>
          <UButton
            size="xs"
            color="neutral"
            square
            class="shrink-0 rounded-[var(--ui-control-radius)] ring-1 ring-zinc-900/10"
            :class="showNewAddress ? 'ring-zinc-900/30 bg-zinc-100' : ''"
            icon="i-lucide-plus"
            aria-label="New address"
            @click="openNewAddress"
          />
        </div>
        <template v-if="addressesLoading">
          <div class="flex min-h-0 flex-1 flex-col px-3 pb-4">
            <p class="px-2 py-6 text-center text-[13px] text-zinc-400">
              Loading…
            </p>
          </div>
        </template>
        <template v-else>
          <template v-if="viewMode === 'cards'">
            <ul class="ui-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
              <li v-for="a in filteredAddresses" :key="a.id">
                <button
                  type="button"
                  :class="addressCardClasses(a)"
                  @click="selectAddress(a.id)"
                >
                  <div class="flex w-full items-start justify-between gap-2">
                    <span class="line-clamp-1 flex-1 text-[13px] font-semibold tracking-tight text-zinc-900">
                      {{ a.label.trim() || 'Untitled address' }}
                    </span>
                    <span
                      v-if="a.countryCode"
                      class="shrink-0 rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600"
                    >
                      {{ a.countryCode }}
                    </span>
                  </div>
                  <span class="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500">
                    {{ lineSummary(a) }}
                  </span>
                  <span class="mt-2 text-[10px] tabular-nums text-zinc-400">
                    {{ new Date(a.updatedAt as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
                    ·
                    {{ new Date(a.updatedAt as string).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }}
                  </span>
                </button>
              </li>
              <li
                v-if="!filteredAddresses.length"
                class="w-full rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
              >
                No addresses yet.
              </li>
            </ul>
          </template>
          <div v-else class="ui-scrollbar min-h-0 flex-1 overflow-auto px-2 pb-4 pt-0 sm:px-3">
            <table class="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr class="sticky top-0 z-[1] border-b border-zinc-200/80 bg-white/85 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 backdrop-blur-sm">
                  <th class="px-2 py-2 font-semibold">
                    Label
                  </th>
                  <th class="px-2 py-2 font-semibold">
                    City
                  </th>
                  <th class="hidden px-2 py-2 font-semibold sm:table-cell">
                    Country
                  </th>
                  <th class="hidden px-2 py-2 font-semibold md:table-cell">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="a in filteredAddresses"
                  :key="a.id"
                  :class="addressTableRowClasses(a)"
                  @click="selectAddress(a.id)"
                >
                  <td class="max-w-[9rem] truncate px-2 py-2 font-medium text-zinc-900">
                    {{ a.label.trim() || 'Untitled address' }}
                  </td>
                  <td class="truncate px-2 py-2 text-zinc-700">
                    {{ (a.city ?? '').trim() || '—' }}
                  </td>
                  <td class="hidden px-2 py-2 sm:table-cell">
                    <span
                      v-if="a.countryCode"
                      class="rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600"
                    >
                      {{ a.countryCode }}
                    </span>
                    <span v-else class="text-zinc-400">—</span>
                  </td>
                  <td class="hidden whitespace-nowrap tabular-nums px-2 py-2 text-zinc-500 md:table-cell">
                    {{ new Date(a.updatedAt as string).toLocaleString() }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-if="!filteredAddresses.length"
              class="rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-6 py-10 text-center text-sm text-zinc-400"
            >
              No addresses yet.
            </div>
          </div>
        </template>
      </template>
      <LibraryFieldTemplatesRail v-else-if="showFieldTemplatesRail" :search-query="fieldSearch" :view-mode="viewMode" />
      <div v-else class="p-4 pt-5 text-[13px] leading-relaxed text-zinc-500">
        <p>Edit field templates in the main panel.</p>
      </div>
    </template>

    <main class="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
      <AddressCreatePanel
        v-if="showAddressRail && showNewAddress"
        @cancel="clearAddressPanel"
        @saved="onAddressSaved"
      />
      <AddressDetailPanel
        v-else-if="showAddressRail && selectedAddressId"
        :key="selectedAddressId"
        :address-id="selectedAddressId"
        @deleted="onAddressDeleted"
        @not-found="clearAddressPanel"
      />
      <div
        v-else-if="showAddressRail"
        class="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-8 py-12 text-center"
      >
        <UiEmptyState
          title="Pick an address"
          description="Select an address from the list or create a new one."
        >
          <template #actions>
            <UButton
              color="neutral"
              size="md"
              icon="i-lucide-plus"
              class="rounded-[var(--ui-control-radius)] px-5 ring-1 ring-zinc-200/80"
              @click="openNewAddress"
            >
              New address
            </UButton>
          </template>
        </UiEmptyState>
      </div>
      <NuxtPage v-else />
    </main>
  </LayoutAppThreeColumn>
</template>
