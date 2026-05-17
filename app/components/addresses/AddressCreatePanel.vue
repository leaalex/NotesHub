<script setup lang="ts">
type AddressRow = { id: string }

const emit = defineEmits<{
  cancel: []
  saved: [id: string]
}>()

const toast = useToast()
const apiFetch = useRequestFetch()
const folderFilter = useState<'all' | 'unfiled' | string>('addresses:folderFilter', () => 'all')

const label = ref('')
const line1 = ref('')
const line2 = ref('')
const city = ref('')
const region = ref('')
const postalCode = ref('')
const countryCode = ref('')

const creating = ref(false)

async function submit() {
  creating.value = true
  try {
    const body: Record<string, unknown> = {
      label: label.value.trim(),
      line1: line1.value.trim(),
      line2: line2.value.trim(),
      city: city.value.trim(),
      region: region.value.trim(),
      postalCode: postalCode.value.trim(),
      countryCode: countryCode.value.trim(),
    }
    if (folderFilter.value !== 'all' && folderFilter.value !== 'unfiled')
      body.folderId = folderFilter.value
    else if (folderFilter.value === 'unfiled')
      body.folderId = null

    const row = await apiFetch<AddressRow>('/api/addresses', { method: 'POST', body })
    if (row?.id)
      emit('saved', row.id)
    else
      emit('cancel')
  }
  catch (e: unknown) {
    toast.add({ title: 'Could not save address', color: 'error' })
    console.error(e)
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="flex w-full min-w-0 flex-col gap-6">
    <header class="space-y-1">
      <h2 class="text-xl font-semibold tracking-tight text-zinc-900">
        New address
      </h2>
      <p class="text-sm text-zinc-500">
        Enter the address manually. Folder follows the sidebar filter on the Addresses screen.
      </p>
    </header>

    <UiGlassPanel class="space-y-3 p-5">
      <UFormField label="Label / display">
        <UInput v-model="label" class="rounded-[var(--ui-control-radius)]" />
      </UFormField>
      <UFormField label="Street / line 1">
        <UInput v-model="line1" class="rounded-[var(--ui-control-radius)]" />
      </UFormField>
      <UFormField label="Line 2">
        <UInput v-model="line2" class="rounded-[var(--ui-control-radius)]" />
      </UFormField>
      <UFormField label="City">
        <UInput v-model="city" class="w-full rounded-[var(--ui-control-radius)]" />
      </UFormField>
      <UFormField label="Region / state">
        <UInput v-model="region" class="w-full rounded-[var(--ui-control-radius)]" />
      </UFormField>
      <UFormField label="Postal code">
        <UInput v-model="postalCode" class="w-full rounded-[var(--ui-control-radius)]" />
      </UFormField>
      <UFormField label="Country code">
        <UInput v-model="countryCode" class="w-full rounded-[var(--ui-control-radius)]" placeholder="ru, cn…" />
      </UFormField>
    </UiGlassPanel>

    <div class="flex justify-end gap-2 pb-2">
      <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="emit('cancel')">
        Cancel
      </UButton>
      <UButton color="neutral" class="rounded-[var(--ui-control-radius)]" :loading="creating" icon="i-lucide-check" @click="submit">
        Save
      </UButton>
    </div>
  </div>
</template>
