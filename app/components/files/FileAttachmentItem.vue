<script setup lang="ts">
type FileAttachment = {
  id: string
  originalName: string
  mimeType: string
  size: number
  shareEnabled: boolean
  shareUrl: string | null
  downloadUrl: string
  updatedAt?: string | Date
}

const props = withDefaults(defineProps<{
  file: FileAttachment
  showUnlink?: boolean
  showDelete?: boolean
  showShare?: boolean
}>(), {
  showUnlink: false,
  showDelete: false,
  showShare: true,
})

const emit = defineEmits<{
  unlink: [id: string]
  delete: [id: string]
  toggleShare: [id: string, nextEnabled: boolean]
}>()

function fileSizeLabel(size: number): string {
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

const isImage = computed(() => props.file.mimeType.startsWith('image/'))

async function copyShareUrl() {
  if (!props.file.shareUrl)
    return
  try {
    await navigator.clipboard.writeText(props.file.shareUrl)
  }
  catch {
    // noop: clipboard may be blocked by browser policy
  }
}
</script>

<template>
  <div class="rounded-[var(--ui-control-radius)] border border-zinc-200/80 bg-white/60 p-3 ring-1 ring-zinc-950/[0.03]">
    <div class="flex items-start gap-3">
      <img
        v-if="isImage"
        :src="file.downloadUrl"
        :alt="file.originalName"
        class="size-14 shrink-0 rounded-[var(--ui-control-radius)] object-cover ring-1 ring-zinc-200/80"
      >
      <div
        v-else
        class="flex size-14 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/80"
      >
        <Icon name="i-lucide-file" class="size-5" aria-hidden="true" />
      </div>

      <div class="min-w-0 flex-1">
        <p class="line-clamp-2 text-[13px] font-semibold leading-snug text-zinc-900">
          {{ file.originalName }}
        </p>
        <p class="mt-1 text-[11px] text-zinc-500">
          {{ fileSizeLabel(file.size) }} · {{ file.mimeType || 'unknown' }}
        </p>
        <a
          :href="file.downloadUrl"
          class="mt-2 inline-flex text-[12px] font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
        >
          Download
        </a>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap gap-1.5">
      <UButton
        v-if="showShare"
        size="xs"
        variant="ghost"
        color="neutral"
        class="rounded-[var(--ui-control-radius)]"
        :icon="file.shareEnabled ? 'i-lucide-link-2-off' : 'i-lucide-link'"
        @click="emit('toggleShare', file.id, !file.shareEnabled)"
      >
        {{ file.shareEnabled ? 'Stop share' : 'Share' }}
      </UButton>
      <UButton
        v-if="showShare && file.shareEnabled && file.shareUrl"
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-copy"
        class="rounded-[var(--ui-control-radius)]"
        @click="copyShareUrl"
      >
        Copy link
      </UButton>
      <UButton
        v-if="showUnlink"
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-unlink"
        class="rounded-[var(--ui-control-radius)]"
        @click="emit('unlink', file.id)"
      >
        Unlink
      </UButton>
      <UButton
        v-if="showDelete"
        size="xs"
        variant="ghost"
        color="error"
        icon="i-lucide-trash-2"
        class="rounded-[var(--ui-control-radius)]"
        @click="emit('delete', file.id)"
      >
        Delete
      </UButton>
    </div>
  </div>
</template>
