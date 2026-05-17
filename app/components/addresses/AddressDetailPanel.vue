<script setup lang="ts">
import { debouncedSchedule } from '#shared/debounced-schedule'

defineOptions({ name: 'AddressDetailPanel' })

type AddressDetail = {
  id: string
  userId: string
  folderId: string | null
  label: string
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  countryCode: string
  lat: string | null
  lng: string | null
  provider: string
  providerId: string | null
  rawJson: string | null
  createdAt: string | Date | number
  updatedAt: string | Date | number
}

type LinkedContactRow = {
  id: string
  displayName: string
  type: string
  role: string
  isPrimary: boolean
}

type ContactPick = { id: string, displayName: string }

const props = defineProps<{
  addressId: string
}>()

const emit = defineEmits<{
  deleted: []
  notFound: []
}>()

const toast = useToast()
const apiFetch = useRequestFetch()
const listVersion = useState<number>('addresses:listVersion', () => 0)

const hydrating = ref(true)
const detail = ref<AddressDetail | null>(null)
const linkedContacts = ref<LinkedContactRow[]>([])
const isEditing = ref(false)
const finishingEdit = ref(false)
const deletingAddr = ref(false)
const showDeleteAddr = ref(false)

const coreLabel = ref('')
const coreLine1 = ref('')
const coreLine2 = ref('')
const coreCity = ref('')
const coreRegion = ref('')
const corePostal = ref('')
const coreCountry = ref('')

const linkContactModal = ref(false)
const contactPickRows = ref<ContactPick[]>([])
const linking = ref(false)

function bumpList() {
  listVersion.value++
}

async function load() {
  const id = props.addressId
  if (!id) {
    detail.value = null
    hydrating.value = false
    return
  }
  hydrating.value = true
  try {
    const row = await apiFetch<AddressDetail>(`/api/addresses/${id}`)
    detail.value = row
    coreLabel.value = row.label ?? ''
    coreLine1.value = row.line1 ?? ''
    coreLine2.value = row.line2 ?? ''
    coreCity.value = row.city ?? ''
    coreRegion.value = row.region ?? ''
    corePostal.value = row.postalCode ?? ''
    coreCountry.value = row.countryCode ?? ''
    linkedContacts.value = await apiFetch<LinkedContactRow[]>(`/api/addresses/${id}/contacts`)
  }
  catch {
    toast.add({ title: 'Address not found', color: 'error' })
    detail.value = null
    emit('notFound')
  }
  finally {
    hydrating.value = false
  }
}

watch(() => props.addressId, () => {
  isEditing.value = false
  linkContactModal.value = false
  void load()
}, { immediate: true })

async function persistImmediate(): Promise<boolean> {
  if (!detail.value || hydrating.value)
    return true
  try {
    const row = await apiFetch<AddressDetail>(`/api/addresses/${detail.value.id}`, {
      method: 'PATCH',
      body: {
        label: coreLabel.value,
        line1: coreLine1.value,
        line2: coreLine2.value,
        city: coreCity.value,
        region: coreRegion.value,
        postalCode: corePostal.value,
        countryCode: coreCountry.value,
      },
    })
    detail.value = { ...detail.value, ...row }
    bumpList()
    return true
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not save address', color: 'error' })
    return false
  }
}

const persistDebounced = debouncedSchedule(() => persistImmediate(), 600)

watch(
  [coreLabel, coreLine1, coreLine2, coreCity, coreRegion, corePostal, coreCountry],
  () => {
    if (!isEditing.value || hydrating.value)
      return
    persistDebounced.schedule()
  },
)

async function finishEditing() {
  if (!detail.value)
    return
  finishingEdit.value = true
  try {
    persistDebounced.cancel()
    const ok = await persistImmediate()
    if (ok)
      isEditing.value = false
  }
  finally {
    finishingEdit.value = false
  }
}

async function confirmDelete() {
  if (!detail.value)
    return
  deletingAddr.value = true
  try {
    await apiFetch(`/api/addresses/${detail.value.id}`, { method: 'DELETE' })
    bumpList()
    showDeleteAddr.value = false
    emit('deleted')
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not delete address', color: 'error' })
  }
  finally {
    deletingAddr.value = false
  }
}

async function openLinkContacts() {
  const rows = await apiFetch<ContactPick[]>('/api/contacts')
  contactPickRows.value = rows
  linkContactModal.value = true
}

async function linkContact(contactId: string) {
  if (!detail.value)
    return
  linking.value = true
  try {
    await apiFetch(`/api/contacts/${contactId}/addresses`, {
      method: 'POST',
      body: { addressId: detail.value.id, role: 'other', isPrimary: false },
    })
    linkedContacts.value = await apiFetch(`/api/addresses/${detail.value.id}/contacts`)
    linkContactModal.value = false
  }
  catch {
    toast.add({ title: 'Could not link contact', color: 'error' })
  }
  finally {
    linking.value = false
  }
}

async function unlinkContact(contactId: string) {
  if (!detail.value)
    return
  await apiFetch(`/api/contacts/${contactId}/addresses/${detail.value.id}`, { method: 'DELETE' })
  linkedContacts.value = await apiFetch(`/api/addresses/${detail.value.id}/contacts`)
}
</script>

<template>
  <div class="address-detail-panel flex min-h-0 min-w-0 flex-1 flex-col">
    <div v-if="hydrating || !detail" class="flex flex-1 items-center justify-center p-16 text-zinc-400">
      Loading…
    </div>
    <main v-else class="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-md ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/45">
      <header class="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-zinc-100/90 px-4 py-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-4">
          <div
            class="flex size-14 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] bg-zinc-900 text-lg font-semibold text-white shadow-lg"
            aria-hidden="true"
          >
            <Icon name="i-lucide-map-pin" class="size-7" />
          </div>
          <div class="min-w-0">
            <span
              class="mb-1 inline-block rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600"
            >
              {{ detail.countryCode?.toUpperCase() || '—' }}
            </span>
            <h1 class="truncate text-2xl font-semibold tracking-tight text-zinc-900">
              {{ coreLabel.trim() || 'Untitled address' }}
            </h1>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-1.5 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]">
          <UButton
            v-if="!isEditing"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            class="rounded-[var(--ui-control-radius)] px-3"
            @click="isEditing = true"
          >
            Edit
          </UButton>
          <template v-else>
            <UButton
              icon="i-lucide-check"
              color="neutral"
              variant="ghost"
              size="xs"
              class="rounded-[var(--ui-control-radius)] px-3"
              :loading="finishingEdit"
              @click="finishEditing"
            >
              Done
            </UButton>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              class="rounded-[var(--ui-control-radius)] px-3"
              :loading="deletingAddr"
              @click="showDeleteAddr = true"
            >
              Delete
            </UButton>
          </template>
        </div>
      </header>

      <div class="relative flex min-h-0 flex-1 overflow-hidden">
        <div class="ui-scrollbar relative min-h-0 flex-1 overflow-y-auto px-3 pb-10 pt-2 sm:px-8">
          <UiSectionLabel>Address</UiSectionLabel>
          <div class="mt-3 space-y-3">
            <UFormField label="Label">
              <UInput v-model="coreLabel" :disabled="!isEditing" class="rounded-[var(--ui-control-radius)]" />
            </UFormField>
            <UFormField label="Line 1">
              <UInput v-model="coreLine1" :disabled="!isEditing" class="rounded-[var(--ui-control-radius)]" />
            </UFormField>
            <UFormField label="Line 2">
              <UInput v-model="coreLine2" :disabled="!isEditing" class="rounded-[var(--ui-control-radius)]" />
            </UFormField>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="City">
                <UInput v-model="coreCity" :disabled="!isEditing" class="rounded-[var(--ui-control-radius)]" />
              </UFormField>
              <UFormField label="Region">
                <UInput v-model="coreRegion" :disabled="!isEditing" class="rounded-[var(--ui-control-radius)]" />
              </UFormField>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Postal code">
                <UInput v-model="corePostal" :disabled="!isEditing" class="rounded-[var(--ui-control-radius)]" />
              </UFormField>
              <UFormField label="Country code">
                <UInput v-model="coreCountry" :disabled="!isEditing" class="rounded-[var(--ui-control-radius)]" />
              </UFormField>
            </div>
          </div>
        </div>

        <aside
          class="ui-scrollbar hidden w-[17rem] shrink-0 overflow-y-auto border-l border-zinc-100/90 bg-white/20 px-3 py-5 xl:flex xl:flex-col xl:gap-0"
        >
          <div class="flex items-center justify-between gap-2">
            <UiSectionLabel>
              Linked contacts
            </UiSectionLabel>
            <button
              v-if="isEditing"
              type="button"
              class="rounded-[var(--ui-control-radius)] px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-white/85"
              @click="openLinkContacts"
            >
              + Link
            </button>
          </div>
          <ul v-if="linkedContacts.length" class="mt-3 flex flex-col gap-1">
            <li
              v-for="c in linkedContacts"
              :key="c.id"
              class="flex items-start justify-between gap-1 rounded-[var(--ui-control-radius)] bg-white/50 px-2 py-1.5 ring-1 ring-zinc-950/[0.04]"
            >
              <NuxtLink
                class="flex min-w-0 flex-1 flex-col text-left hover:underline"
                :to="`/contacts/${c.id}`"
              >
                <span class="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">{{ c.displayName }}</span>
                <span class="text-[10px] uppercase text-zinc-400">{{ c.role }}<template v-if="c.isPrimary"> · primary</template></span>
              </NuxtLink>
              <button
                v-if="isEditing"
                type="button"
                class="shrink-0 rounded-[var(--ui-control-radius)] p-1 text-zinc-400 hover:bg-white hover:text-red-600"
                aria-label="Unlink contact"
                @click="unlinkContact(c.id)"
              >
                <Icon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
            No linked contacts. Use + Link while editing.
          </p>
        </aside>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="linkContactModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 backdrop-blur-sm"
        @click.self="linkContactModal = false"
      >
        <UCard class="ui-scrollbar max-h-[80vh] w-full max-w-md overflow-auto rounded-[var(--ui-panel-radius)]">
          <template #header>
            <span class="font-semibold text-zinc-900">Pick a contact</span>
          </template>
          <ul class="space-y-1">
            <li v-for="c in contactPickRows" :key="c.id">
              <button
                type="button"
                class="flex w-full rounded-[var(--ui-control-radius)] px-4 py-2.5 text-left text-[13px] hover:bg-zinc-100"
                :disabled="linking"
                @click="linkContact(c.id)"
              >
                {{ c.displayName }}
              </button>
            </li>
          </ul>
          <template #footer>
            <div class="flex justify-end">
              <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="linkContactModal = false">
                Cancel
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </Teleport>

    <UiConfirmDeleteDialog
      v-model:open="showDeleteAddr"
      title="Delete address"
      description="This address will be removed from your library and unlinked from all contacts."
      :loading="deletingAddr"
      @confirm="confirmDelete"
    />
    </main>
  </div>
</template>
