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

function addressCardClasses(a: LibraryAddressRow) {
  const active = selectedAddressId.value === a.id && !!a.id
  const base =
    'group flex w-full flex-col items-start rounded-[var(--ui-control-radius)] border px-4 py-3 text-left shadow-sm ring-1 transition-all'
  if (active)
    return `${base} border-zinc-900/15 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-18px_rgba(24,24,27,0.35)] ring-zinc-900/[0.06]`

  return `${base} border-transparent bg-white/50 ring-zinc-950/[0.03] hover:border-zinc-200/80 hover:bg-white/80 hover:shadow-md`
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
  <LayoutAppThreeColumn folders-pinned right-pane-scrollable>
    <template #folders>
      <div class="flex flex-col gap-4 border-b border-zinc-200/40 p-4 pb-3">
        <div class="min-w-0">
          <UiSectionLabel>Library</UiSectionLabel>
        </div>
        <nav class="flex flex-col gap-1 text-[13px]" role="tablist" aria-label="Library sections">
          <NuxtLink
            v-for="t in navItems"
            :key="t.to"
            :to="t.to"
            role="tab"
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
            :class="isNavActive(t.to)
              ? 'bg-zinc-900 text-white shadow-sm'
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
            class="shrink-0 rounded-[var(--ui-control-radius)] px-4 shadow-sm ring-1 ring-zinc-900/10"
            :class="showNewAddress ? 'ring-zinc-900/30 bg-zinc-100' : ''"
            icon="i-lucide-plus"
            @click="openNewAddress"
          >
            New
          </UButton>
        </div>
        <div class="px-4 pb-3">
          <UInput
            v-model="addressSearch"
            class="w-full rounded-[var(--ui-control-radius)]"
            placeholder="Search…"
          />
        </div>
        <ul class="ui-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
          <template v-if="addressesLoading">
            <li class="px-2 py-6 text-center text-[13px] text-zinc-400">
              Loading…
            </li>
          </template>
          <template v-else>
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
            <li v-if="!filteredAddresses.length" class="rounded-[var(--ui-panel-radius)] border border-dashed border-zinc-200/80 px-4 py-8 text-center text-[12px] text-zinc-400">
              {{ addressSearch.trim() ? 'No matches.' : 'No addresses yet.' }}
            </li>
          </template>
        </ul>
      </template>
      <LibraryFieldTemplatesRail v-else-if="showFieldTemplatesRail" />
      <div v-else class="p-4 pt-5 text-[13px] leading-relaxed text-zinc-500">
        <p>Edit field templates in the main panel.</p>
      </div>
    </template>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <div class="ui-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-5 pb-10 pt-5 sm:px-8">
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
        <NuxtPage v-else />
      </div>
    </div>
  </LayoutAppThreeColumn>
</template>
