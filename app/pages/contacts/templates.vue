<script setup lang="ts">
type TemplateRow = {
  id: string
  contactType: string
  label: string
  fieldType: string
  position: number
}

const toast = useToast()
const apiFetch = useRequestFetch()

const personRows = ref<TemplateRow[]>([])
const orgRows = ref<TemplateRow[]>([])
const loading = ref(true)
const newPersonLabel = ref('')
const newOrgLabel = ref('')

const fieldOpts = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
  { value: 'address', label: 'Address' },
  { value: 'longtext', label: 'Long text' },
]

async function reload() {
  loading.value = true
  try {
    const [person, org] = await Promise.all([
      apiFetch<TemplateRow[]>('/api/contact-field-templates', {
        query: { type: 'person' },
      }),
      apiFetch<TemplateRow[]>('/api/contact-field-templates', {
        query: { type: 'organization' },
      }),
    ])
    personRows.value = person
    orgRows.value = org
  }
  catch (e) {
    console.error(e)
    toast.add({ title: 'Could not load templates', color: 'error' })
  }
  finally {
    loading.value = false
  }
}

onMounted(reload)

function sorted(rows: TemplateRow[]) {
  return [...rows].sort((a, b) =>
    a.position !== b.position ? a.position - b.position : a.label.localeCompare(b.label),
  )
}

async function addTemplate(contactType: 'person' | 'organization') {
  const lb = (
    contactType === 'person' ? newPersonLabel.value : newOrgLabel.value
  ).trim()
  if (!lb)
    return
  await apiFetch<TemplateRow>('/api/contact-field-templates', {
    method: 'POST',
    body: { contactType, label: lb, fieldType: 'text' },
  })
  if (contactType === 'person')
    newPersonLabel.value = ''
  else
    newOrgLabel.value = ''
  await reload()
}

async function patchRemote(
  row: TemplateRow,
  patch: Partial<Pick<TemplateRow, 'label' | 'fieldType' | 'position'>>,
) {
  await apiFetch(`/api/contact-field-templates/${row.id}`, {
    method: 'PATCH',
    body: patch,
  })
}

async function patchRow(
  row: TemplateRow,
  patch: Partial<Pick<TemplateRow, 'label' | 'fieldType' | 'position'>>,
) {
  await patchRemote(row, patch)
  await reload()
}

async function moveTpl(row: TemplateRow, delta: number, siblings: TemplateRow[]) {
  const list = sorted(siblings)
  const ix = list.findIndex(t => t.id === row.id)
  const nx = ix + delta
  if (ix < 0 || nx < 0 || nx >= list.length)
    return
  const a = list[ix]!
  const b = list[nx]!
  await patchRemote(a, { position: b.position })
  await patchRemote(b, { position: a.position })
  await reload()
}

async function removeTpl(id: string) {
  await apiFetch(`/api/contact-field-templates/${id}`, { method: 'DELETE' })
  await reload()
}
</script>

<template>
  <div class="relative mx-auto min-h-full w-full max-w-5xl px-4 py-10 sm:px-8">
    <div class="mb-10 flex flex-wrap items-center gap-4">
      <NuxtLink
        to="/contacts"
        class="inline-flex items-center rounded-full border border-zinc-200 px-4 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
      >
        ← Contacts
      </NuxtLink>
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-zinc-900">
          Field templates
        </h1>
        <p class="mt-1 text-sm text-zinc-500">
          Templates per contact type — new contacts get empty values for each field.
        </p>
      </div>
    </div>

    <div v-if="loading" class="rounded-2xl border border-dashed border-zinc-200 p-14 text-center text-zinc-400">
      Loading…
    </div>

    <div v-else class="grid gap-8 lg:grid-cols-2">
      <UCard class="rounded-2xl ring-1 ring-zinc-950/[0.04]">
        <template #header>
          <span class="font-semibold text-zinc-900">People</span>
        </template>
        <div class="flex gap-2">
          <UInput v-model="newPersonLabel" class="flex-1 rounded-xl" placeholder="New label…" />
          <UButton class="rounded-full" size="xs" icon="i-lucide-plus" @click="addTemplate('person')">
            Add
          </UButton>
        </div>
        <ul class="mt-5 space-y-2">
          <li v-for="row in sorted(personRows)" :key="row.id" class="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <UInput
                size="xs"
                :model-value="row.label"
                class="min-w-[10rem] flex-1 rounded-lg"
                @blur="
                  evt => patchRow(row, {
                    label: ((evt.target as HTMLInputElement)?.value ?? row.label).trim(),
                  })"
              />
              <select
                class="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px]"
                @change="
                  evt => patchRow(row, {
                    fieldType: (evt.target as HTMLSelectElement).value,
                  })"
              >
                <option
                  v-for="opt in fieldOpts"
                  :key="'p-' + row.id + opt.value"
                  :value="opt.value"
                  :selected="opt.value === row.fieldType"
                >
                  {{ opt.label }}
                </option>
              </select>
              <UButton variant="ghost" color="neutral" square size="xs" icon="i-lucide-chevron-up" @click="moveTpl(row, -1, personRows)" />
              <UButton variant="ghost" color="neutral" square size="xs" icon="i-lucide-chevron-down" @click="moveTpl(row, 1, personRows)" />
              <UButton variant="ghost" color="error" square size="xs" icon="i-lucide-trash-2" @click="removeTpl(row.id)" />
            </div>
          </li>
        </ul>
      </UCard>

      <UCard class="rounded-2xl ring-1 ring-zinc-950/[0.04]">
        <template #header>
          <span class="font-semibold text-zinc-900">Organizations</span>
        </template>
        <div class="flex gap-2">
          <UInput v-model="newOrgLabel" class="flex-1 rounded-xl" placeholder="New label…" />
          <UButton class="rounded-full" size="xs" icon="i-lucide-plus" @click="addTemplate('organization')">
            Add
          </UButton>
        </div>
        <ul class="mt-5 space-y-2">
          <li v-for="row in sorted(orgRows)" :key="row.id" class="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <UInput
                size="xs"
                :model-value="row.label"
                class="min-w-[10rem] flex-1 rounded-lg"
                @blur="
                  evt => patchRow(row, {
                    label: ((evt.target as HTMLInputElement)?.value ?? row.label).trim(),
                  })"
              />
              <select
                class="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px]"
                @change="
                  evt => patchRow(row, {
                    fieldType: (evt.target as HTMLSelectElement).value,
                  })"
              >
                <option
                  v-for="opt in fieldOpts"
                  :key="'o-' + row.id + opt.value"
                  :value="opt.value"
                  :selected="opt.value === row.fieldType"
                >
                  {{ opt.label }}
                </option>
              </select>
              <UButton variant="ghost" color="neutral" square size="xs" icon="i-lucide-chevron-up" @click="moveTpl(row, -1, orgRows)" />
              <UButton variant="ghost" color="neutral" square size="xs" icon="i-lucide-chevron-down" @click="moveTpl(row, 1, orgRows)" />
              <UButton variant="ghost" color="error" square size="xs" icon="i-lucide-trash-2" @click="removeTpl(row.id)" />
            </div>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
