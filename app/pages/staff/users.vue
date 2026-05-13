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
  <div class="ui-page-wrap ui-page-wrap--wide py-8">
    <div class="ui-toolbar">
      <div>
        <UiSectionLabel>
          Staff
        </UiSectionLabel>
        <h1 class="mt-3 ui-page-title">
          Users &amp; roles
        </h1>
        <p class="ui-page-subtitle">
          Better Auth admin plugin
        </p>
      </div>
      <div class="flex gap-2">
        <UInput v-model="q" placeholder="Search…" icon="i-lucide-search" class="w-48" />
        <UButton to="/staff" color="neutral" variant="soft" class="rounded-full px-4" icon="i-lucide-arrow-left">
          Back
        </UButton>
      </div>
    </div>

    <UiEmptyState
      v-if="loading"
      icon="i-lucide-loader-circle"
      title="Loading users"
      description="Fetching accounts and roles."
    />
    <div v-else class="ui-table-shell">
      <table class="w-full text-left text-sm">
        <thead class="ui-table-head">
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
                class="ui-select"
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
