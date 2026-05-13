<script setup lang="ts">
type Row = {
  id: string
  userId: string
  folderId: string | null
  title: string
  excerpt: string
  shareEnabled: boolean
  shareToken: string | null
  createdAt: Date
  updatedAt: Date
}

const rows = ref<Row[]>([])
const loading = ref(true)

function fmt(d: Date | string) {
  const x = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleString()
}

function shortToken(t: string | null) {
  if (!t) return '—'
  return `${t.slice(0, 8)}…`
}

async function load() {
  loading.value = true
  try {
    rows.value = await $fetch<Row[]>('/api/admin/notes', { credentials: 'include' })
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
          Notes (admin)
        </h1>
        <p class="ui-page-subtitle">
          SQLite table <code class="rounded bg-zinc-100 px-1">notes</code> — content column omitted
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
      title="Loading notes"
      description="Fetching rows from SQLite."
    />
    <div v-else class="ui-table-shell">
      <table class="w-full min-w-[56rem] text-left text-sm">
        <thead class="ui-table-head">
          <tr>
            <th class="px-3 py-2 font-medium">
              Title
            </th>
            <th class="px-3 py-2 font-medium">
              User
            </th>
            <th class="px-3 py-2 font-medium">
              Folder
            </th>
            <th class="px-3 py-2 font-medium">
              Share
            </th>
            <th class="px-3 py-2 font-medium">
              Token
            </th>
            <th class="px-3 py-2 font-medium">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="border-b border-zinc-50">
            <td class="max-w-[14rem] truncate px-3 py-2 text-zinc-800" :title="r.title">
              {{ r.title || '—' }}
            </td>
            <td class="px-3 py-2 font-mono text-xs text-zinc-600">
              {{ r.userId }}
            </td>
            <td class="px-3 py-2 font-mono text-xs text-zinc-500">
              {{ r.folderId ?? '—' }}
            </td>
            <td class="px-3 py-2 text-zinc-600">
              {{ r.shareEnabled ? 'on' : 'off' }}
            </td>
            <td class="px-3 py-2 font-mono text-xs text-zinc-500">
              {{ shortToken(r.shareToken) }}
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
