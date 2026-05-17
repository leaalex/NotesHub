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

const { data, error, pending, refresh } = await useAsyncData(
  'share-contact',
  () => {
    const t = token.value
    if (!t)
      return Promise.resolve(null)
    return $fetch<{
      type: string
      displayName: string
      firstName: string
      lastName: string
      orgName: string
      note: string
      updatedAt: string
      fields: FieldPub[]
      linkedNotes: { title: string, shareUrl: string | null }[]
      linkedFiles: { originalName: string, mimeType: string, size: number, shareUrl: string | null }[]
    }>(`/api/share/contact/${t}`)
  },
  { watch: [token] },
)

function viewDash(v: string | null | undefined) {
  const s = String(v ?? '').trim()
  return s.length ? s : '—'
}

function resolvedUrlHref(raw: string) {
  const t = raw.trim()
  if (!t)
    return ''
  try {
    const u = new URL(t.startsWith('//') ? `https:${t}` : t)
    if (u.protocol === 'http:' || u.protocol === 'https:')
      return u.href
    return ''
  }
  catch {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(t))
      return t
    return `https://${t}`
  }
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

function initials(name: string) {
  const p = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  return p.slice(0, 2) || '?'
}

const kindLabel = computed(() =>
  data.value?.type === 'organization' ? 'Organization' : 'Person',
)
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
        title="This contact is not available"
        description="The share link is disabled or expired."
      />
      <div v-else-if="data">
        <UiSectionLabel>
          Shared contact
        </UiSectionLabel>
        <div class="mt-4 flex items-start gap-4">
          <div
            class="flex size-14 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] bg-zinc-900 text-lg font-semibold text-white"
            aria-hidden="true"
          >
            {{ initials(data.displayName) }}
          </div>
          <div class="min-w-0">
            <span
              class="mb-1 inline-block rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600"
            >
              {{ kindLabel }}
            </span>
            <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {{ data.displayName }}
            </h1>
            <p class="mt-2 text-xs tabular-nums text-zinc-400">
              Updated {{ new Date(data.updatedAt).toLocaleString() }}
            </p>
          </div>
        </div>

        <div class="mt-10 overflow-hidden rounded-[var(--ui-panel-radius)] border border-zinc-100 bg-white ring-1 ring-zinc-950/[0.04]">
          <div class="ui-scrollbar max-h-[min(70vh,48rem)] overflow-y-auto px-3 py-6 sm:px-8 sm:py-8">
            <UiSectionLabel>
              Basics
            </UiSectionLabel>
            <div class="mt-3">
              <div v-if="data.type === 'person'" class="grid gap-4 sm:grid-cols-2">
                <div>
                  <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    First name
                  </div>
                  <div class="mt-1 text-[13px] text-zinc-900">
                    {{ viewDash(data.firstName) }}
                  </div>
                </div>
                <div>
                  <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Last name
                  </div>
                  <div class="mt-1 text-[13px] text-zinc-900">
                    {{ viewDash(data.lastName) }}
                  </div>
                </div>
              </div>
              <div v-else>
                <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Organization name
                </div>
                <div class="mt-1 text-[13px] text-zinc-900">
                  {{ viewDash(data.orgName) }}
                </div>
              </div>
              <div class="mt-5">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Note
                </div>
                <p class="mt-1 whitespace-pre-wrap text-[13px] text-zinc-900">
                  {{ viewDash(data.note) }}
                </p>
              </div>
            </div>

            <div class="mt-8 border-t border-zinc-100/90 pt-6">
              <UiSectionLabel>
                Custom fields
              </UiSectionLabel>
              <div class="mt-3">
                <div
                  v-for="f in sortedFields(data.fields)"
                  :key="`${f.label}-${f.position}`"
                  class="mb-4 rounded-[var(--ui-control-radius)] border border-zinc-100 bg-white p-3 last:mb-0"
                >
                  <div class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    {{ f.label }}
                    <span class="normal-case opacity-70"> · {{ f.fieldType }}</span>
                  </div>
                  <div class="mt-2 min-w-0 text-[13px] text-zinc-900">
                    <template v-if="f.fieldType === 'email' && String(f.value || '').trim()">
                      <a :href="`mailto:${String(f.value).trim()}`" class="font-medium underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700">
                        {{ String(f.value).trim() }}
                      </a>
                    </template>
                    <template v-else-if="f.fieldType === 'url' && String(f.value || '').trim()">
                      <a
                        :href="resolvedUrlHref(String(f.value))"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="break-all font-medium underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700"
                      >
                        {{ String(f.value).trim() }}
                      </a>
                    </template>
                    <p v-else-if="f.fieldType === 'longtext'" class="whitespace-pre-wrap">
                      {{ viewDash(f.value) }}
                    </p>
                    <template v-else>
                      {{ viewDash(f.value) }}
                    </template>
                  </div>
                </div>
                <p v-if="!data.fields.length" class="text-[13px] text-zinc-400">
                  No custom fields.
                </p>
              </div>
            </div>

            <div class="mt-8 border-t border-zinc-100/90 pt-6">
              <UiSectionLabel>
                Linked notes
              </UiSectionLabel>
              <ul v-if="data.linkedNotes.length" class="mt-3 space-y-2">
                <li
                  v-for="(n, i) in data.linkedNotes"
                  :key="i"
                  class="rounded-[var(--ui-control-radius)] bg-white px-3 py-2 ring-1 ring-zinc-950/[0.04]"
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
              <p v-else class="mt-3 text-[13px] text-zinc-400">
                No linked notes.
              </p>
            </div>

            <div class="mt-8 border-t border-zinc-100/90 pt-6">
              <UiSectionLabel>
                Linked files
              </UiSectionLabel>
              <ul v-if="data.linkedFiles.length" class="mt-3 space-y-2">
                <li
                  v-for="(file, i) in data.linkedFiles"
                  :key="i"
                  class="rounded-[var(--ui-control-radius)] border border-zinc-200/80 bg-white px-3 py-2 ring-1 ring-zinc-950/[0.03]"
                >
                  <a
                    v-if="file.shareUrl"
                    :href="file.shareUrl"
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
              <p v-else class="mt-3 text-[13px] text-zinc-400">
                No linked files.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
