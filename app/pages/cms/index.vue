<script setup lang="ts">
const links = [
  { to: '/cms/folders', label: 'Folders', desc: 'All folders (any user)', icon: 'i-lucide-folder-tree' },
  { to: '/cms/notes', label: 'Notes', desc: 'All notes — no heavy editor payload', icon: 'i-lucide-file-text' },
]
</script>

<template>
  <div class="mx-auto max-w-2xl p-8">
    <h1 class="text-xl font-semibold">
      Data (SQLite)
    </h1>
    <p class="mt-1 text-sm text-zinc-500">
      Read-only lists for support and inspection. User management remains under Staff → Users.
    </p>
    <ul class="mt-8 space-y-3">
      <li v-for="l in links" :key="l.to">
        <NuxtLink
          :to="l.to"
          class="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:shadow"
        >
          <span :class="l.icon" class="mt-0.5 size-5 text-amber-700" />
          <div>
            <div class="font-medium text-zinc-900">
              {{ l.label }}
            </div>
            <div class="text-sm text-zinc-500">
              {{ l.desc }}
            </div>
          </div>
        </NuxtLink>
      </li>
    </ul>
    <UButton to="/staff" variant="ghost" class="mt-8" color="neutral">
      Back to staff
    </UButton>
  </div>
</template>
