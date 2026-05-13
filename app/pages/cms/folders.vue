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
  <div class="mx-auto max-w-6xl p-6">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-lg font-semibold">
          Folders (admin)
        </h1>
        <p class="text-sm text-zinc-500">
          SQLite table <code class="rounded bg-zinc-100 px-1">folders</code>
        </p>
      </div>
      <div class="flex gap-2">
        <UButton variant="soft" icon="i-lucide-refresh-cw" @click="load">
          Refresh
        </UButton>
        <UButton to="/cms" variant="soft" icon="i-lucide-arrow-left">
          CMS home
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="text-sm text-zinc-500">
      Loading…
    </div>
    <div v-else class="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table class="w-full min-w-[56rem] text-left text-sm">
        <thead class="border-b border-zinc-100 bg-zinc-50">
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
