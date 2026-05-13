<script setup lang="ts">
type FolderRow = {
  id: string
  name: string
  parentId: string | null
  position: number
}

const apiFetch = useRequestFetch()
const folderFilter = ref<'all' | 'unfiled' | string>('all')
const folders = ref<FolderRow[]>([])

onMounted(async () => {
  folders.value = await apiFetch<FolderRow[]>('/api/folders')
})
</script>

<template>
  <LayoutAppThreeColumn>
    <template #folders>
      <div class="flex flex-col gap-4 border-b border-zinc-200/40 p-4 pb-3">
        <div class="min-w-0">
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Folders
          </div>
        </div>
        <nav class="flex flex-col gap-1 text-[13px]">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === 'all'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = 'all'"
          >
            <Icon name="i-lucide-layout-grid" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            All media
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === 'unfiled'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = 'unfiled'"
          >
            <Icon name="i-lucide-folder-x" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            Unfiled
          </button>
          <button
            v-for="f in folders"
            :key="f.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left font-medium transition-colors"
            :class="folderFilter === f.id
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-white/70'"
            @click="folderFilter = f.id"
          >
            <Icon name="i-lucide-folder" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
            <span class="truncate">{{ f.name }}</span>
          </button>
        </nav>
      </div>
    </template>

    <template #cards>
      <div class="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
        <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          Library
        </span>
        <UButton
          size="xs"
          color="neutral"
          type="button"
          disabled
          class="rounded-full px-3 opacity-60 shadow-sm ring-1 ring-zinc-900/10"
        >
          <Icon name="i-lucide-plus" class="mr-1 size-3.5" aria-hidden="true" />
          New
        </UButton>
      </div>
      <div class="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-8 text-center">
        <Icon name="i-lucide-image" class="size-10 text-zinc-300" aria-hidden="true" />
        <p class="text-[13px] font-medium text-zinc-500">
          Files coming soon
        </p>
        <p class="max-w-[12rem] text-[11px] leading-relaxed text-zinc-400">
          Uploads and thumbnails will appear here.
        </p>
      </div>
    </template>

    <div class="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
      <div class="max-w-sm rounded-[1.35rem] border border-white/70 bg-white/50 px-10 py-12 shadow-[0_24px_80px_-32px_rgba(24,24,27,0.35)] backdrop-blur-md ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/40">
        <h2 class="text-lg font-semibold tracking-tight text-zinc-900">
          Media library is coming soon
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-zinc-500">
          You will be able to upload and reuse files across notes here.
        </p>
      </div>
    </div>
  </LayoutAppThreeColumn>
</template>
