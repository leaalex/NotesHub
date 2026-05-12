<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const token = computed(() => String(route.params.token || ''))

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
</script>

<template>
  <div class="min-h-dvh bg-[#fbfbfa] px-4 py-10">
    <div class="mx-auto max-w-3xl">
      <div v-if="pending" class="text-sm text-zinc-500">
        Loading…
      </div>
      <div v-else-if="error" class="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800">
        This note is not available (link disabled or expired).
      </div>
      <div v-else-if="data">
        <p class="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Shared note
        </p>
        <h1 class="mt-2 text-2xl font-semibold text-zinc-900">
          {{ data.title || 'Untitled' }}
        </h1>
        <p class="mt-1 text-xs text-zinc-400">
          Updated {{ new Date(data.updatedAt).toLocaleString() }}
        </p>
        <div class="mt-8 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <ClientOnly>
            <NotesLexicalNoteEditor
              :note-key="`share-${token}-${data.updatedAt}`"
              :model-value="data.content"
              read-only
              placeholder=""
            />
            <template #fallback>
              <div class="text-sm text-zinc-500">
                Loading…
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>
    </div>
  </div>
</template>
