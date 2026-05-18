<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const token = computed(() => String(route.params.token || ''))

const { data, error, pending } = await useAsyncData(
  'share-file',
  () => {
    const t = token.value
    if (!t)
      return Promise.resolve(null)
    return $fetch<{
      originalName: string
      title: string
      description: string
      mimeType: string
      size: number
      updatedAt: string
      downloadUrl: string
      linkedNotes: { title: string, shareUrl: string | null }[]
      linkedContacts: { displayName: string, shareUrl: string | null }[]
      linkedTasks: { title: string, shareUrl: string | null }[]
    }>(`/api/share/file/${encodeURIComponent(t)}/meta`)
  },
  { watch: [token] },
)

function viewDash(v: string | null | undefined) {
  const s = String(v ?? '').trim()
  return s.length ? s : '—'
}

function fileSizeLabel(size: number) {
  const units = ['B', 'KB', 'MB', 'GB']
  let v = size
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const rounded = i === 0 ? Math.round(v).toString() : v.toFixed(v >= 10 ? 1 : 2)
  return `${rounded} ${units[i]}`
}

const displayTitle = computed(() => {
  const d = data.value
  if (!d)
    return ''
  const t = String(d.title ?? '').trim()
  return t.length ? t : d.originalName
})

const hasSidebarLinks = computed(() => {
  const d = data.value
  if (!d)
    return false
  return (
    d.linkedNotes.length > 0
    || d.linkedContacts.length > 0
    || d.linkedTasks.length > 0
  )
})
</script>

<template>
  <div class="relative min-h-dvh overflow-hidden bg-slate-100 px-4 py-12 sm:py-16">
    <div class="relative z-10 mx-auto max-w-3xl lg:max-w-5xl">
      <UiGlassPanel v-if="pending" class="px-6 py-16 text-center text-sm text-zinc-500">
        Loading…
      </UiGlassPanel>
      <UiEmptyState
        v-else-if="error"
        icon="i-lucide-link-2-off"
        title="This file is not available"
        description="The share link is disabled or expired."
      />
      <div v-else-if="data">
        <UiSectionLabel>
          Shared file
        </UiSectionLabel>
        <div class="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,18rem)] lg:gap-10 lg:items-start">
          <div class="min-w-0">
            <div class="flex items-start gap-4">
              <div
                class="flex size-14 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] bg-zinc-900 text-white"
                aria-hidden="true"
              >
                <UIcon name="i-lucide-paperclip" class="size-7" />
              </div>
              <div class="min-w-0 flex-1">
                <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                  {{ displayTitle }}
                </h1>
                <p class="mt-1 text-sm text-zinc-500">
                  {{ data.originalName }}
                </p>
                <p class="mt-2 text-xs tabular-nums text-zinc-400">
                  {{ data.mimeType }} · {{ fileSizeLabel(data.size) }}
                  · Updated {{ new Date(data.updatedAt).toLocaleString() }}
                </p>
                <div class="mt-6">
                  <UButton
                    :to="data.downloadUrl"
                    external
                    icon="i-lucide-download"
                    size="md"
                  >
                    Download
                  </UButton>
                </div>
              </div>
            </div>

            <div class="mt-10 overflow-hidden rounded-[var(--ui-panel-radius)] border border-zinc-100 bg-white ring-1 ring-zinc-950/[0.04]">
              <div class="ui-scrollbar max-h-[min(70vh,48rem)] overflow-y-auto px-3 py-6 sm:px-8 sm:py-8">
                <UiSectionLabel>
                  Description
                </UiSectionLabel>
                <p class="mt-3 whitespace-pre-wrap text-[13px] text-zinc-900">
                  {{ viewDash(data.description) }}
                </p>
              </div>
            </div>
          </div>

          <aside
            v-if="hasSidebarLinks"
            class="mt-10 lg:mt-0 lg:sticky lg:top-8 space-y-8"
          >
            <div
              v-if="data.linkedNotes.length"
              class="overflow-hidden rounded-[var(--ui-panel-radius)] border border-zinc-100 bg-white p-4 ring-1 ring-zinc-950/[0.04] sm:p-5"
            >
              <UiSectionLabel>
                Linked notes
              </UiSectionLabel>
              <ul class="mt-3 space-y-2">
                <li
                  v-for="(n, i) in data.linkedNotes"
                  :key="i"
                  class="rounded-[var(--ui-control-radius)] bg-zinc-50/80 px-3 py-2 ring-1 ring-zinc-950/[0.04]"
                >
                  <a
                    v-if="n.shareUrl"
                    :href="n.shareUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[13px] font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700"
                  >
                    {{ n.title }}
                  </a>
                  <span v-else class="text-[13px] font-medium text-zinc-900">{{ n.title }}</span>
                  <p v-if="!n.shareUrl" class="mt-1 text-[10px] text-zinc-400">
                    Sharing is off for this note.
                  </p>
                </li>
              </ul>
            </div>

            <div
              v-if="data.linkedContacts.length"
              class="overflow-hidden rounded-[var(--ui-panel-radius)] border border-zinc-100 bg-white p-4 ring-1 ring-zinc-950/[0.04] sm:p-5"
            >
              <UiSectionLabel>
                Linked contacts
              </UiSectionLabel>
              <ul class="mt-3 space-y-2">
                <li
                  v-for="(c, i) in data.linkedContacts"
                  :key="i"
                  class="rounded-[var(--ui-control-radius)] bg-zinc-50/80 px-3 py-2 ring-1 ring-zinc-950/[0.04]"
                >
                  <a
                    v-if="c.shareUrl"
                    :href="c.shareUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[13px] font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700"
                  >
                    {{ c.displayName }}
                  </a>
                  <span v-else class="text-[13px] font-medium text-zinc-900">{{ c.displayName }}</span>
                  <p v-if="!c.shareUrl" class="mt-1 text-[10px] text-zinc-400">
                    Sharing is off for this contact.
                  </p>
                </li>
              </ul>
            </div>

            <div
              v-if="data.linkedTasks.length"
              class="overflow-hidden rounded-[var(--ui-panel-radius)] border border-zinc-100 bg-white p-4 ring-1 ring-zinc-950/[0.04] sm:p-5"
            >
              <UiSectionLabel>
                Linked tasks
              </UiSectionLabel>
              <ul class="mt-3 space-y-2">
                <li
                  v-for="(task, i) in data.linkedTasks"
                  :key="i"
                  class="rounded-[var(--ui-control-radius)] bg-zinc-50/80 px-3 py-2 ring-1 ring-zinc-950/[0.04]"
                >
                  <a
                    v-if="task.shareUrl"
                    :href="task.shareUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[13px] font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700"
                  >
                    {{ task.title }}
                  </a>
                  <span v-else class="text-[13px] font-medium text-zinc-900">{{ task.title }}</span>
                  <p v-if="!task.shareUrl" class="mt-1 text-[10px] text-zinc-400">
                    Sharing is off for this task.
                  </p>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </div>
</template>
