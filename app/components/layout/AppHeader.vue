<script setup lang="ts">
const route = useRoute()
const auth = useNotesAuth()
const sessionQuery = auth.useSession()

const { open: foldersRailOpen, toggle: toggleFoldersRail } = useFoldersRail()

const showFoldersRailToggle = computed(() => {
  if (route.path === '/contacts/templates')
    return false
  return route.path === '/'
    || route.path.startsWith('/contacts')
    || route.path.startsWith('/files')
})

const user = computed(() => sessionQuery.value?.data?.user)
const isAdmin = computed(() => (user.value as { role?: string } | undefined)?.role === 'admin')

const links = [
  { to: '/', label: 'Notes', icon: 'i-lucide-notebook-text' },
  { to: '/files', label: 'Files', icon: 'i-lucide-image' },
  { to: '/contacts', label: 'Contacts', icon: 'i-lucide-contact' },
] as const

function isActive(to: string) {
  if (to === '/')
    return route.path === '/'
  return route.path.startsWith(to)
}

async function signOut() {
  await auth.signOut()
  await navigateTo('/login')
}

const displayName = computed(() => {
  const u = user.value
  if (!u)
    return ''
  return u.name || u.email || 'Account'
})

const avatarSrc = computed(() => {
  const u = user.value as { image?: string | null } | undefined
  const src = u?.image
  return typeof src === 'string' && src.length ? src : undefined
})

const menuItems = computed(() => {
  const u = user.value
  if (!u)
    return []

  const email = u.email ?? ''

  type LabelRow = { type: 'label', label: string }
  type LinkRow = { label: string, icon: string, to: string }
  type ActionRow = { label: string, icon: string, onSelect: () => void }

  const groups: Array<Array<LabelRow | LinkRow | ActionRow>> = [
    [{ type: 'label', label: email || displayName.value }],
  ]

  if (isAdmin.value) {
    groups.push([
      { label: 'Admin', icon: 'i-lucide-shield', to: '/staff' },
    ])
  }

  groups.push([
    {
      label: 'Sign out',
      icon: 'i-lucide-log-out',
      onSelect: () => {
        void signOut()
      },
    },
  ])

  return groups
})
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-white/60 bg-white/55 backdrop-blur-xl ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/45"
  >
    <div class="flex h-14 w-full items-center gap-3 px-4 sm:gap-4 sm:px-6">
      <div class="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
        <NuxtLink
          to="/"
          class="-m-1 flex min-w-0 shrink-0 items-center rounded-[var(--ui-control-radius)] px-2 py-1 text-zinc-900 outline-none hover:bg-white/65 focus-visible:ring-2 focus-visible:ring-zinc-900/25"
          aria-label="Archivarius — Home"
        >
          <BrandLockup />
        </NuxtLink>
        <div v-if="showFoldersRailToggle" class="flex shrink-0">
          <UButton
            variant="ghost"
            color="neutral"
            square
            size="sm"
            class="rounded-[var(--ui-control-radius)] ring-1 ring-zinc-200/80 hover:bg-white/80"
            :icon="foldersRailOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
            :aria-label="foldersRailOpen ? 'Hide folders' : 'Show folders'"
            :aria-pressed="foldersRailOpen"
            @click="toggleFoldersRail()"
          />
        </div>
      </div>

      <nav class="flex min-w-0 flex-1 justify-center" aria-label="Main">
        <div class="flex items-center gap-1 rounded-[var(--ui-control-radius)] bg-zinc-50/90 p-1 ring-1 ring-zinc-950/[0.04]">
          <NuxtLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="flex items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-1.5 text-[13px] font-medium transition-colors"
            :class="isActive(l.to)
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-white/70'"
          >
            <Icon :name="l.icon" class="size-4 shrink-0 opacity-90" aria-hidden="true" />
            <span class="truncate">{{ l.label }}</span>
          </NuxtLink>
        </div>
      </nav>

      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <LogoColorPicker />

        <UButton
          v-if="!user"
          to="/login"
          color="neutral"
          size="sm"
          class="rounded-[var(--ui-control-radius)] px-4 shadow-sm ring-1 ring-zinc-900/10"
        >
          Sign in
        </UButton>
        <UDropdownMenu v-else :items="menuItems" :content="{ align: 'end' }">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            class="max-w-[14rem] rounded-[var(--ui-control-radius)] px-2 py-1.5 ring-1 ring-zinc-200/80 hover:bg-white/80"
          >
            <span class="flex min-w-0 items-center gap-2">
              <UAvatar
                :src="avatarSrc"
                :alt="displayName"
                :text="displayName.slice(0, 2).toUpperCase()"
                size="xs"
                class="shrink-0"
              />
              <span class="truncate text-left text-[13px] font-semibold text-zinc-800">
                {{ displayName }}
              </span>
            </span>
          </UButton>
        </UDropdownMenu>
      </div>
    </div>
  </header>
</template>
