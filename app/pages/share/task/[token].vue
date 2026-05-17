<script setup lang="ts">
definePageMeta({ layout: false })

type FieldPub = {
  label: string
  fieldType: string
  value: string
  position: number
}

const route = useRoute()
const token = computed(() => String(route.params.token || ''))

const { data, error, pending } = await useAsyncData(
  'share-task',
  () => {
    const t = token.value
    if (!t)
      return Promise.resolve(null)
    return $fetch<{
      title: string
      description: string
      status: string
      priority: string
      dueAt: string | null
      completedAt: string | null
      updatedAt: string
      fields: FieldPub[]
      linkedNotes: { title: string, shareUrl: string | null }[]
      linkedContacts: { displayName: string, shareUrl: string | null }[]
      linkedFiles: { originalName: string, mimeType: string, size: number, shareUrl: string | null }[]
    }>(`/api/share/task/${t}`)
  },
  { watch: [token] },
)

function viewDash(v: string | null | undefined) {
  const s = String(v ?? '').trim()
  return s.length ? s : '—'
}

function sortedFields(rows: FieldPub[]) {
  return [...rows].sort((a, b) =>
    a.position !== b.position ? a.position - b.position : a.label.localeCompare(b.label),
  )
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
    <div class="relative z-10 mx-auto max-w-3xl">
      <UiGlassPanel v-if="pending" class="px-6 py-16 text-center text-sm text-zinc-500">
        Loading…
      </UiGlassPanel>
      <UiEmptyState
        v-else-if="error"
        icon="i-lucide-link-2-off"
        title="This task is not available"
        description="The share link is disabled or expired."
      />
      <div v-else-if="data">
        <UiSectionLabel>
          Shared task
        </UiSectionLabel>
        <h1 class="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          {{ data.title || 'Untitled task' }}
        </h1>
        <p v-if="data.description?.trim()" class="mt-3 whitespace-pre-wrap text-sm text-zinc-600">
          {{ data.description }}
        </p>
        <div class="mt-4 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
          <span class="rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-1">{{ data.status.replaceAll('_', ' ') }}</span>
          <span class="rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-1">{{ data.priority }}</span>
        </div>
        <p class="mt-2 text-xs text-zinc-500">
          Updated {{ new Date(data.updatedAt).toLocaleString() }}
        </p>

        <UiGlassPanel v-if="sortedFields(data.fields).length" class="mt-8 space-y-3 p-5">
          <UiSectionLabel>Fields</UiSectionLabel>
          <dl class="space-y-2 text-sm">
            <template v-for="f in sortedFields(data.fields)" :key="f.label + f.position">
              <div class="flex flex-col gap-0.5 border-b border-zinc-100 pb-2 last:border-0">
                <dt class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  {{ f.label }}
                </dt>
                <dd class="text-zinc-800">
                  {{ viewDash(f.value) }}
                </dd>
              </div>
            </template>
          </dl>
        </UiGlassPanel>

        <UiGlassPanel v-if="data.linkedNotes.length" class="mt-6 space-y-2 p-5">
          <UiSectionLabel>Linked notes</UiSectionLabel>
          <ul class="space-y-1 text-sm">
            <li v-for="(n, i) in data.linkedNotes" :key="i" class="flex items-center justify-between gap-2">
              <span>{{ n.title }}</span>
              <a
                v-if="n.shareUrl"
                :href="n.shareUrl"
                class="shrink-0 text-xs text-zinc-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >Open</a>
            </li>
          </ul>
        </UiGlassPanel>

        <UiGlassPanel v-if="data.linkedContacts.length" class="mt-6 space-y-2 p-5">
          <UiSectionLabel>Linked contacts</UiSectionLabel>
          <ul class="space-y-1 text-sm">
            <li v-for="(c, i) in data.linkedContacts" :key="i" class="flex items-center justify-between gap-2">
              <span>{{ c.displayName }}</span>
              <a
                v-if="c.shareUrl"
                :href="c.shareUrl"
                class="shrink-0 text-xs text-zinc-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >Open</a>
            </li>
          </ul>
        </UiGlassPanel>

        <UiGlassPanel v-if="data.linkedFiles.length" class="mt-6 space-y-2 p-5">
          <UiSectionLabel>Linked files</UiSectionLabel>
          <ul class="space-y-2 text-sm">
            <li v-for="(f, i) in data.linkedFiles" :key="i" class="flex flex-wrap items-center justify-between gap-2">
              <span>{{ f.originalName }} · {{ fileSizeLabel(f.size) }}</span>
              <a
                v-if="f.shareUrl"
                :href="f.shareUrl"
                class="text-xs text-zinc-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >Open</a>
            </li>
          </ul>
        </UiGlassPanel>
      </div>
    </div>
  </div>
</template>
