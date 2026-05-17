<script setup lang="ts">
type ContactRow = {
  id: string
  displayName: string
}

const router = useRouter()
const toast = useToast()
const apiFetch = useRequestFetch()

const folderFilter = useState<'all' | 'unfiled' | string>('contacts:folderFilter', () => 'all')
const listVersion = useState<number>('contacts:listVersion', () => 0)

const newTab = ref<'person' | 'organization'>('person')
const newFirst = ref('')
const newLast = ref('')
const newOrg = ref('')
const newNote = ref('')
const creating = ref(false)

async function createContact() {
  creating.value = true
  try {
    const body: Record<string, unknown> = {
      type: newTab.value,
      note: newNote.value.trim(),
    }
    if (folderFilter.value !== 'all' && folderFilter.value !== 'unfiled')
      body.folderId = folderFilter.value
    else if (folderFilter.value === 'unfiled')
      body.folderId = null

    if (newTab.value === 'person') {
      body.firstName = newFirst.value.trim()
      body.lastName = newLast.value.trim()
    }
    else {
      body.orgName = newOrg.value.trim()
    }

    const row = await apiFetch<ContactRow>('/api/contacts', { method: 'POST', body })
    newFirst.value = ''
    newLast.value = ''
    newOrg.value = ''
    newNote.value = ''
    listVersion.value++
    if (row?.id)
      await router.replace(`/contacts/${row.id}`)
    else
      await router.replace('/contacts')
  }
  catch (e: unknown) {
    toast.add({ title: 'Could not create contact', color: 'error' })
    console.error(e)
  }
  finally {
    creating.value = false
  }
}

function cancel() {
  router.push('/contacts')
}
</script>

<template>
  <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
    <div class="ui-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto">
      <header class="space-y-1">
        <h1 class="text-xl font-semibold tracking-tight text-zinc-900">
          New contact
        </h1>
        <p class="text-sm text-zinc-500">
          Choose a type and fill in the basics. Folder follows the sidebar filter.
        </p>
      </header>

      <div class="flex rounded-[var(--ui-control-radius)] bg-zinc-100 p-1">
        <button
          type="button"
          class="flex-1 rounded-[var(--ui-control-radius)] px-3 py-2 text-[12px] font-semibold transition-all"
          :class="newTab === 'person' ? 'bg-white text-zinc-900' : 'text-zinc-500'"
          @click="newTab = 'person'"
        >
          Person
        </button>
        <button
          type="button"
          class="flex-1 rounded-[var(--ui-control-radius)] px-3 py-2 text-[12px] font-semibold transition-all"
          :class="newTab === 'organization' ? 'bg-white text-zinc-900' : 'text-zinc-500'"
          @click="newTab = 'organization'"
        >
          Organization
        </button>
      </div>

      <UiGlassPanel class="space-y-3 p-5">
        <template v-if="newTab === 'person'">
          <UFormField label="First name">
            <UInput v-model="newFirst" class="rounded-[var(--ui-control-radius)]" />
          </UFormField>
          <UFormField label="Last name">
            <UInput v-model="newLast" class="rounded-[var(--ui-control-radius)]" />
          </UFormField>
        </template>
        <template v-else>
          <UFormField label="Organization">
            <UInput v-model="newOrg" class="rounded-[var(--ui-control-radius)]" />
          </UFormField>
        </template>
        <UFormField label="Note (optional)">
          <UTextarea v-model="newNote" class="rounded-[var(--ui-control-radius)]" autoresize :max-rows="6" />
        </UFormField>
      </UiGlassPanel>

      <div class="flex justify-end gap-2 pb-2">
        <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="cancel">
          Cancel
        </UButton>
        <UButton color="neutral" class="rounded-[var(--ui-control-radius)]" :loading="creating" icon="i-lucide-check" @click="createContact">
          Create
        </UButton>
      </div>
    </div>
  </main>
</template>
