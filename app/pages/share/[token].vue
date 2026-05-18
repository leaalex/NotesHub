<script setup lang="ts">
import { EMPTY_TIPTAP_DOC_JSON } from '#shared/tiptap-empty-doc'
import type { NoteOutlineItem } from '#shared/note-outline'

definePageMeta({ layout: false })

const route = useRoute()
const token = computed(() => String(route.params.token || ''))

const shareOutline = ref<NoteOutlineItem[]>([])

type ShareNotePayload = {
  title: string
  content: string
  updatedAt: string
  linkedContacts: { displayName: string, shareUrl: string | null }[]
  linkedFiles: { originalName: string, mimeType: string, size: number, shareUrl: string | null }[]
  linkedTasks: { title: string, shareUrl: string | null }[]
}

const { data, error, pending, refresh } = await useAsyncData(
  'share-note',
  () => {
    const t = token.value
    if (!t) return Promise.resolve(null)
    return $fetch<ShareNotePayload>(`/api/share/${encodeURIComponent(t)}`)
  },
  { watch: [token] },
)

watch(token, () => refresh())

const shareEditorKey = computed(() => {
  const d = data.value
  if (!d) return `share-${token.value}-none`
  return `share-${token.value}-${d.updatedAt}-${String(d.content?.length ?? 0)}`
})

const hasSidebarLinks = computed(() => {
  const d = data.value
  if (!d) return false
  return (
    d.linkedContacts.length > 0
    || d.linkedFiles.length > 0
    || d.linkedTasks.length > 0
  )
})

function onShareOutline(items: NoteOutlineItem[]) {
  shareOutline.value = items
}

function scrollShareToHeading(id: string) {
  nextTick(() => {
    const el = document.querySelector(`[data-note-heading-id="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
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
        title="This note is not available"
        description="The share link is disabled or expired."
      />
      <div v-else-if="data">
        <UiSectionLabel>
          Shared
        </UiSectionLabel>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-[2rem]">
          {{ data.title || 'Untitled' }}
        </h1>
        <p class="mt-2 text-xs tabular-nums text-zinc-400">
          Updated {{ new Date(data.updatedAt).toLocaleString() }}
        </p>

        <div class="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,18rem)] lg:gap-10 lg:items-start">
          <div class="min-w-0">
            <div class="overflow-hidden rounded-[var(--ui-panel-radius)] border border-zinc-100 bg-white ring-1 ring-zinc-950/[0.04]">
              <div class="max-h-[min(72vh,52rem)] min-h-[min(28vh,20rem)] overflow-hidden">
                <div class="ui-scrollbar max-h-[min(56vh,44rem)] min-h-[min(28vh,20rem)] overflow-y-auto p-5 sm:p-8">
                  <ClientOnly>
                    <NotesLexicalNoteEditor
                      :note-key="shareEditorKey"
                      :model-value="data.content || EMPTY_TIPTAP_DOC_JSON"
                      read-only
                      placeholder=""
                      class="w-full"
                      @update:outline="onShareOutline"
                    />
                    <template #fallback>
                      <div class="py-16 text-center text-sm text-zinc-400">
                        Loading…
                      </div>
                    </template>
                  </ClientOnly>
                </div>
                <div class="border-t border-zinc-100/90 bg-white/40 px-4 py-4 sm:px-6">
                  <UiSectionLabel>
                    On this page
                  </UiSectionLabel>
                  <nav v-if="shareOutline.length" class="mt-3 space-y-0.5" aria-label="Outline">
                    <button
                      v-for="item in shareOutline"
                      :key="item.id"
                      type="button"
                      class="flex w-full max-w-full rounded-[var(--ui-control-radius)] px-2 py-1.5 text-left text-[12px] leading-snug text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                      :style="{ paddingLeft: `${8 + (item.level - 1) * 12}px` }"
                      @click="scrollShareToHeading(item.id)"
                    >
                      <span class="line-clamp-2">{{ item.text }}</span>
                    </button>
                  </nav>
                  <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
                    No headings in this note.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside
            v-if="hasSidebarLinks"
            class="mt-10 space-y-8 lg:mt-0 lg:sticky lg:top-8"
          >
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
              v-if="data.linkedFiles.length"
              class="overflow-hidden rounded-[var(--ui-panel-radius)] border border-zinc-100 bg-white p-4 ring-1 ring-zinc-950/[0.04] sm:p-5"
            >
              <UiSectionLabel>
                Linked files
              </UiSectionLabel>
              <ul class="mt-3 space-y-2">
                <li
                  v-for="(file, i) in data.linkedFiles"
                  :key="i"
                  class="rounded-[var(--ui-control-radius)] border border-zinc-200/80 bg-white px-3 py-2 ring-1 ring-zinc-950/[0.03]"
                >
                  <a
                    v-if="file.shareUrl"
                    :href="file.shareUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[13px] font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700"
                  >
                    {{ file.originalName }}
                  </a>
                  <span v-else class="text-[13px] font-medium text-zinc-900">{{ file.originalName }}</span>
                  <p class="mt-1 text-[11px] text-zinc-500">
                    {{ file.mimeType }} · {{ fileSizeLabel(file.size) }}
                  </p>
                  <p v-if="!file.shareUrl" class="mt-1 text-[10px] text-zinc-400">
                    File sharing is off.
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
