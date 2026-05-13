<script setup lang="ts">
type Row = {
  id: string
  userId: string
  parentId: string | null
  name: string
  position: number
  createdAt: Date
  updatedAt: Date
}

const rows = ref<Row[]>([])
const loading = ref(true)

function fmt(d: Date | string) {
  const x = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleString()
}

async function load() {
  loading.value = true
  try {
    rows.value = await $fetch<Row[]>('/api/admin/folders', { credentials: 'include' })
  }
  catch {
    rows.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="ui-page-wrap ui-page-wrap--wide py-8">
    <div class="ui-toolbar">
      <div>
        <UiSectionLabel>
          CMS
        </UiSectionLabel>
        <h1 class="mt-3 ui-page-title">
          Folders (admin)
        </h1>
        <p class="ui-page-subtitle">
          SQLite table <code class="rounded bg-zinc-100 px-1">folders</code>
        </p>
      </div>
      <div class="flex gap-2">
        <UButton color="neutral" variant="soft" class="rounded-full px-4" icon="i-lucide-refresh-cw" @click="load">
          Refresh
        </UButton>
        <UButton to="/cms" color="neutral" variant="soft" class="rounded-full px-4" icon="i-lucide-arrow-left">
          CMS home
        </UButton>
      </div>
    </div>

    <UiEmptyState
      v-if="loading"
      icon="i-lucide-loader-circle"
      title="Loading folders"
      description="Fetching rows from SQLite."
    />
    <div v-else class="ui-table-shell">
      <table class="w-full min-w-[56rem] text-left text-sm">
        <thead class="ui-table-head">
          <tr>
            <th class="px-3 py-2 font-medium">
              Name
            </th>
            <th class="px-3 py-2 font-medium">
              User
            </th>
            <th class="px-3 py-2 font-medium">
              Parent
            </th>
            <th class="px-3 py-2 font-medium">
              Pos.
            </th>
            <th class="px-3 py-2 font-medium">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="border-b border-zinc-50">
            <td class="px-3 py-2 font-mono text-xs text-zinc-800">
              {{ r.name }}
            </td>
            <td class="px-3 py-2 font-mono text-xs text-zinc-600">
              {{ r.userId }}
            </td>
            <td class="px-3 py-2 font-mono text-xs text-zinc-500">
              {{ r.parentId ?? '—' }}
            </td>
            <td class="px-3 py-2 text-zinc-600">
              {{ r.position }}
            </td>
            <td class="px-3 py-2 text-zinc-600">
              {{ fmt(r.updatedAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
