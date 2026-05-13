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

const {
  newFolderName,
  showNewFolder,
  creatingFolder,
  createFolder,
} = useNewFolderModal(folders)

onMounted(async () => {
  folders.value = await apiFetch<FolderRow[]>('/api/folders')
})
</script>

<template>
  <LayoutAppThreeColumn>
    <template #folders>
      <div class="flex flex-col gap-4 border-b border-zinc-200/40 p-4 pb-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <UiSectionLabel>
              Folders
            </UiSectionLabel>
          </div>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            square
            class="rounded-[var(--ui-control-radius)] ring-1 ring-zinc-200/80 hover:bg-white/80"
            icon="i-lucide-folder-plus"
            aria-label="New folder"
            @click="showNewFolder = true"
          />
        </div>
        <nav class="flex flex-col gap-1 text-[13px]">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
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
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
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
            class="flex w-full items-center gap-2 rounded-[var(--ui-control-radius)] px-3 py-2 text-left font-medium transition-colors"
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
        <UiSectionLabel>
          Library
        </UiSectionLabel>
        <UButton
          size="xs"
          color="neutral"
          type="button"
          disabled
          class="rounded-[var(--ui-control-radius)] px-3 opacity-60 shadow-sm ring-1 ring-zinc-900/10"
        >
          <Icon name="i-lucide-plus" class="mr-1 size-3.5" aria-hidden="true" />
          New
        </UButton>
      </div>
      <div class="ui-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-2">
        <UiEmptyState
          icon="i-lucide-image"
          title="Files coming soon"
          description="Uploads and thumbnails will appear here."
        />
      </div>
    </template>

    <div class="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
      <UiEmptyState
        icon="i-lucide-image"
        title="Media library is coming soon"
        description="You will be able to upload and reuse files across notes here."
      />
    </div>
  </LayoutAppThreeColumn>

  <UiNewFolderDialog
    v-model:open="showNewFolder"
    v-model:name="newFolderName"
    :creating="creatingFolder"
    @submit="createFolder"
  />
</template>
