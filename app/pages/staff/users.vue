<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'

type Row = {
  id: string
  name: string
  email: string
  role?: string | null
  createdAt: string | Date
}

const config = useRuntimeConfig()
const site = computed(() => String(config.public.siteUrl || '').replace(/\/$/, ''))

const users = ref<Row[]>([])
const loading = ref(true)
const q = ref('')

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ users: Row[], total: number }>(
      `${site.value}/api/auth/admin/list-users`,
      {
        credentials: 'include',
        query: {
          limit: 100,
          offset: 0,
          searchValue: q.value || undefined,
        },
      },
    )
    users.value = res.users ?? []
  }
  catch {
    users.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

watchDebounced(q, () => load(), { debounce: 400 })

async function setRole(id: string, role: string) {
  await $fetch(`${site.value}/api/auth/admin/set-role`, {
    method: 'POST',
    credentials: 'include',
    body: { userId: id, role },
  })
  await load()
}
</script>

<template>
  <div class="mx-auto max-w-4xl p-6">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-lg font-semibold">
          Users &amp; roles
        </h1>
        <p class="text-sm text-zinc-500">
          Better Auth admin plugin
        </p>
      </div>
      <div class="flex gap-2">
        <UInput v-model="q" placeholder="Search…" icon="i-lucide-search" class="w-48" />
        <UButton to="/staff" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="text-sm text-zinc-500">
      Loading…
    </div>
    <div v-else class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-zinc-100 bg-zinc-50">
          <tr>
            <th class="px-3 py-2 font-medium">
              Name
            </th>
            <th class="px-3 py-2 font-medium">
              Email
            </th>
            <th class="px-3 py-2 font-medium">
              Role
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-b border-zinc-50">
            <td class="px-3 py-2">
              {{ u.name }}
            </td>
            <td class="px-3 py-2 text-zinc-600">
              {{ u.email }}
            </td>
            <td class="px-3 py-2">
              <select
                class="rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
                :value="u.role || 'user'"
                @change="setRole(u.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="user">
                  user
                </option>
                <option value="admin">
                  admin
                </option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
