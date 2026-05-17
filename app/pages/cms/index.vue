<script setup lang="ts">
const links = [
  { to: '/cms/folders', label: 'Folders', desc: 'All folders (any user)', icon: 'i-lucide-folder-tree' },
  { to: '/cms/notes', label: 'Notes', desc: 'All notes — no heavy editor payload', icon: 'i-lucide-file-text' },
  { to: '/cms/tasks', label: 'Tasks', desc: 'All tasks', icon: 'i-lucide-list-checks' },
]
</script>

<template>
  <div class="ui-page-wrap ui-page-wrap--narrow py-8">
    <UiSectionLabel>
      CMS
    </UiSectionLabel>
    <h1 class="mt-3 ui-page-title">
      Data (SQLite)
    </h1>
    <p class="ui-page-subtitle">
      Read-only lists for support and inspection. User management remains under Staff → Users.
    </p>
    <ul class="mt-8 space-y-3">
      <li v-for="l in links" :key="l.to">
        <NuxtLink
          :to="l.to"
          class="flex items-start gap-3 rounded-[var(--ui-panel-radius)] border border-zinc-200 bg-white/90 p-4 ring-1 ring-zinc-950/[0.03] transition hover:border-zinc-300 hover:bg-white"
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
    <UButton to="/staff" variant="ghost" class="mt-8" color="neutral">
      Back to staff
    </UButton>
  </div>
</template>
