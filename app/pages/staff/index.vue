<script setup lang="ts">
const links = [
  { to: '/cms', label: 'Data CMS', desc: 'Folders & notes (SQLite, read-only lists)', icon: 'i-lucide-database' },
  { to: '/staff/users', label: 'Users & roles', desc: 'Better Auth admin', icon: 'i-lucide-users' },
]
</script>

<template>
  <div class="mx-auto max-w-2xl p-8">
    <h1 class="text-xl font-semibold">
      Administration
    </h1>
    <p class="mt-1 text-sm text-zinc-500">
      Manage application data and accounts (admin only).
    </p>
    <ul class="mt-8 space-y-3">
      <li v-for="l in links" :key="l.to">
        <NuxtLink
          :to="l.to"
          class="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow"
        >
          <Icon :name="l.icon" class="mt-0.5 size-5 text-zinc-500" aria-hidden="true" />
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
    <UButton to="/" variant="ghost" class="mt-8" color="neutral">
      Back to notes
    </UButton>
  </div>
</template>
