<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import { computed } from 'vue'
import {
  requestInsertContactMention,
  requestInsertFileMentionFromLibrary,
  requestInsertFileMentionUpload,
} from '#shared/tiptap-insert-mention-registry'

const props = defineProps<{
  editor: Editor
}>()

const insertMenuItems = computed(() => [
  [
    {
      label: 'Contact mention',
      icon: 'i-lucide-contact',
      onSelect: () => requestInsertContactMention(props.editor),
    },
    {
      label: 'File from library',
      icon: 'i-lucide-folder-search',
      onSelect: () => requestInsertFileMentionFromLibrary(props.editor),
    },
    {
      label: 'Upload file…',
      icon: 'i-lucide-upload',
      onSelect: () => requestInsertFileMentionUpload(props.editor),
    },
  ],
])
</script>

<template>
  <UDropdownMenu :items="insertMenuItems" :content="{ align: 'start' }">
    <UButton
      type="button"
      size="xs"
      variant="ghost"
      color="neutral"
      icon="i-lucide-plus"
      class="rounded-[var(--ui-control-radius)]"
      aria-label="Insert in note"
    >
      Insert
    </UButton>
  </UDropdownMenu>
</template>
