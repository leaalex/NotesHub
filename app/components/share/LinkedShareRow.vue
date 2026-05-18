<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { EntityShareKind } from '~/composables/useEntityShareToggle'

const props = withDefaults(
  defineProps<{
    kind: EntityShareKind
    entityId: string
    title: string
    subtitle?: string
    to?: string | RouteLocationRaw
    shareEnabled: boolean
    shareToken: string | null | undefined
    busy?: boolean
  }>(),
  { subtitle: '', to: undefined, busy: false },
)

const emit = defineEmits<{
  toggle: [nextEnabled: boolean]
}>()

const toast = useToast()
const runtimeConfig = useRuntimeConfig()

const publicShareHref = computed(() => {
  const t = String(props.shareToken ?? '').trim()
  if (!t || !props.shareEnabled)
    return ''
  const base = String(runtimeConfig.public.siteUrl ?? '').replace(/\/$/, '')
  if (!base)
    return ''
  switch (props.kind) {
    case 'note':
      return `${base}/share/${encodeURIComponent(t)}`
    case 'contact':
      return `${base}/share/contact/${encodeURIComponent(t)}`
    case 'file':
      return `${base}/share/file/${encodeURIComponent(t)}`
    case 'task':
      return `${base}/share/task/${encodeURIComponent(t)}`
    default:
      return ''
  }
})

async function copyPublicLink() {
  const href = publicShareHref.value
  if (!href) {
    toast.add({
      title: 'No public link',
      description: 'Enable sharing first.',
      color: 'neutral',
    })
    return
  }
  try {
    await navigator.clipboard.writeText(href)
    toast.add({ title: 'Link copied', color: 'success' })
  }
  catch {
    toast.add({
      title: 'Could not copy',
      description: 'Clipboard permission may be blocked.',
      color: 'error',
    })
  }
}

const kindIcon = computed(() => {
  switch (props.kind) {
    case 'note':
      return 'i-lucide-file-text'
    case 'contact':
      return 'i-lucide-user'
    case 'file':
      return 'i-lucide-paperclip'
    case 'task':
      return 'i-lucide-circle-check-big'
    default:
      return 'i-lucide-link'
  }
})
</script>

<template>
  <div
    class="flex items-start gap-2 rounded-[var(--ui-control-radius)] bg-white px-2 py-1.5 ring-1 ring-zinc-950/[0.04]"
  >
    <Icon
      :name="kindIcon"
      class="mt-0.5 size-3.5 shrink-0 text-zinc-400"
      aria-hidden="true"
    />
    <div class="min-w-0 flex-1">
      <NuxtLink
        v-if="to"
        :to="to"
        class="block min-w-0 text-left hover:underline"
      >
        <span class="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">{{ title }}</span>
        <span
          v-if="subtitle"
          class="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-400"
        >{{ subtitle }}</span>
      </NuxtLink>
      <div v-else class="min-w-0 text-left">
        <span class="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">{{ title }}</span>
        <span
          v-if="subtitle"
          class="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-400"
        >{{ subtitle }}</span>
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <UButton
        v-if="shareEnabled && publicShareHref"
        type="button"
        size="xs"
        variant="ghost"
        color="neutral"
        square
        class="rounded-[var(--ui-control-radius)]"
        icon="i-lucide-copy"
        :aria-label="'Copy public link'"
        @click="copyPublicLink"
      />
      <USwitch
        :model-value="shareEnabled"
        size="xs"
        :disabled="busy"
        :loading="busy"
        :aria-label="`Share ${kind} ${title}`"
        @update:model-value="emit('toggle', $event)"
      />
    </div>
  </div>
</template>
