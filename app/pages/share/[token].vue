<script setup lang="ts">
import { EMPTY_TIPTAP_DOC_JSON } from '#shared/tiptap-empty-doc'
import type { NoteOutlineItem } from '#shared/note-outline'

definePageMeta({ layout: false })

const route = useRoute()
const token = computed(() => String(route.params.token || ''))

const shareOutline = ref<NoteOutlineItem[]>([])

const { data, error, pending, refresh } = await useAsyncData(
  'share-note',
  () => {
    const t = token.value
    if (!t) return Promise.resolve(null)
    return $fetch<{
      title: string
      content: string
      updatedAt: string
    }>(`/api/share/${t}`)
  },
  { watch: [token] },
)

watch(token, () => refresh())

function onShareOutline(items: NoteOutlineItem[]) {
  shareOutline.value = items
}

function scrollShareToHeading(id: string) {
  nextTick(() => {
    const el = document.querySelector(`[data-note-heading-id="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
</script>

<template>
  <div class="relative min-h-dvh overflow-hidden px-4 py-12 sm:py-16">
    <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-50 via-white to-zinc-100" />
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_-15%,rgba(24,24,27,0.06),transparent)]" />

    <div class="relative z-10 mx-auto max-w-5xl">
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

        <div class="mt-10 overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-md ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/45">
          <div class="flex max-h-[min(72vh,52rem)] min-h-[min(40vh,28rem)] overflow-hidden">
            <div class="ui-scrollbar min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
              <ClientOnly>
                <NotesLexicalNoteEditor
                  :note-key="`share-${token}-${data.updatedAt}`"
                  :model-value="data.content || EMPTY_TIPTAP_DOC_JSON"
                  read-only
                  placeholder=""
                  class="mx-auto max-w-[42rem]"
                  @update:outline="onShareOutline"
                />
                <template #fallback>
                  <div class="py-16 text-center text-sm text-zinc-400">
                    Loading…
                  </div>
                </template>
              </ClientOnly>
            </div>

            <aside
              class="ui-scrollbar hidden w-[13.5rem] shrink-0 overflow-y-auto border-l border-zinc-100/90 bg-white/25 px-3 py-5 xl:block"
            >
              <UiSectionLabel>
                On this page
              </UiSectionLabel>
              <nav v-if="shareOutline.length" class="mt-3 space-y-0.5" aria-label="Outline">
                <button
                  v-for="item in shareOutline"
                  :key="item.id"
                  type="button"
                  class="flex w-full max-w-full rounded-xl px-2 py-1.5 text-left text-[12px] leading-snug text-zinc-600 transition-colors hover:bg-white/85 hover:text-zinc-900"
                  :style="{ paddingLeft: `${8 + (item.level - 1) * 12}px` }"
                  @click="scrollShareToHeading(item.id)"
                >
                  <span class="line-clamp-2">{{ item.text }}</span>
                </button>
              </nav>
              <p v-else class="mt-3 text-[11px] leading-relaxed text-zinc-400">
                No headings in this note.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
