<script setup lang="ts">
type TaskRow = {
  id: string
  title: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const apiFetch = useRequestFetch()

const folderFilter = useState<'all' | 'unfiled' | string>('tasks:folderFilter', () => 'all')
const listVersion = useState<number>('tasks:listVersion', () => 0)

const title = ref('')
const description = ref('')
const status = ref('todo')
const priority = ref('normal')
const creating = ref(false)

const statusOpts = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

const priorityOpts = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
]

async function createTask() {
  creating.value = true
  try {
    const body: Record<string, unknown> = {
      title: title.value.trim(),
      description: description.value.trim(),
      status: status.value,
      priority: priority.value,
    }
    if (folderFilter.value !== 'all' && folderFilter.value !== 'unfiled')
      body.folderId = folderFilter.value
    else if (folderFilter.value === 'unfiled')
      body.folderId = null

    if (typeof route.query.parent === 'string' && route.query.parent.length)
      body.parentId = route.query.parent

    const row = await apiFetch<TaskRow>('/api/tasks', { method: 'POST', body })
    title.value = ''
    description.value = ''
    listVersion.value++
    if (row?.id)
      await router.replace(`/tasks/${row.id}`)
    else
      await router.replace('/tasks')
  }
  catch (e: unknown) {
    const err = e as {
      data?: { statusMessage?: string, message?: string }
      statusMessage?: string
      message?: string
    }
    const description
      = err.data?.statusMessage
        ?? err.data?.message
        ?? err.statusMessage
        ?? err.message
        ?? (typeof e === 'object' && e !== null && 'toString' in e ? String(e) : '')
    toast.add({
      title: 'Could not create task',
      ...(description ? { description } : {}),
      color: 'error',
    })
    console.error(e)
  }
  finally {
    creating.value = false
  }
}

function cancel() {
  router.push('/tasks')
}
</script>

<template>
  <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
    <div class="ui-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto">
      <header class="space-y-1">
        <h1 class="text-xl font-semibold tracking-tight text-zinc-900">
          New task
        </h1>
        <p class="text-sm text-zinc-500">
          Folder follows the sidebar filter. You can link notes, contacts, and files after saving.
        </p>
      </header>

      <UiGlassPanel class="space-y-3 p-5">
        <UFormField label="Title">
          <UInput v-model="title" class="rounded-[var(--ui-control-radius)]" />
        </UFormField>
        <UFormField label="Description">
          <UTextarea v-model="description" class="rounded-[var(--ui-control-radius)]" autoresize :max-rows="8" />
        </UFormField>
        <UFormField label="Status">
          <select v-model="status" class="ui-select w-full">
            <option v-for="o in statusOpts" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </UFormField>
        <UFormField label="Priority">
          <select v-model="priority" class="ui-select w-full">
            <option v-for="o in priorityOpts" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </UFormField>
      </UiGlassPanel>

      <div class="flex justify-end gap-2 pb-2">
        <UButton variant="ghost" color="neutral" class="rounded-[var(--ui-control-radius)]" @click="cancel">
          Cancel
        </UButton>
        <UButton color="neutral" class="rounded-[var(--ui-control-radius)]" :loading="creating" icon="i-lucide-check" @click="createTask">
          Create
        </UButton>
      </div>
    </div>
  </main>
</template>
