<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import { formatToolbarHistoryItems, formatToolbarMainItems } from '#shared/tiptap-format-toolbar'
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  editor: Editor | null
}>()

/** TipTap updates are outside Vue reactivity; bump to refresh active states. */
const uiEpoch = ref(0)

let unsub: (() => void) | undefined

watch(
  () => props.editor,
  (ed) => {
    unsub?.()
    unsub = undefined
    if (!ed)
      return
    const bump = () => {
      uiEpoch.value++
    }
    ed.on('transaction', bump)
    ed.on('selectionUpdate', bump)
    unsub = () => {
      ed.off('transaction', bump)
      ed.off('selectionUpdate', bump)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  unsub?.()
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-0.5">
    <span class="sr-only" aria-hidden="true">{{ uiEpoch }}</span>
    <template v-for="(item, idx) in formatToolbarHistoryItems" :key="`fmt-h-${idx}`">
      <span
        v-if="item.kind === 'divider'"
        class="mx-0.5 w-px self-stretch bg-zinc-200"
        aria-hidden="true"
      />
      <UButton
        v-else-if="editor"
        type="button"
        size="xs"
        variant="ghost"
        color="neutral"
        :icon="item.icon"
        :disabled="item.disabled?.(editor) ?? false"
        :class="{ 'bg-zinc-100': item.isActive(editor) }"
        :aria-label="item.label"
        @mousedown.prevent="item.run(editor)"
      />
    </template>
    <template v-for="(item, idx) in formatToolbarMainItems" :key="`fmt-m-${idx}`">
      <span
        v-if="item.kind === 'divider'"
        class="mx-0.5 w-px self-stretch bg-zinc-200"
        aria-hidden="true"
      />
      <UButton
        v-else-if="editor"
        type="button"
        size="xs"
        variant="ghost"
        color="neutral"
        :icon="item.icon"
        :disabled="item.disabled?.(editor) ?? false"
        :class="{ 'bg-zinc-100': item.isActive(editor) }"
        :aria-label="item.label"
        @mousedown.prevent="item.run(editor)"
      />
    </template>
    <span
      v-if="editor"
      class="mx-0.5 w-px self-stretch bg-zinc-200"
      aria-hidden="true"
    />
    <NotesTiptapInsertInNoteMenu v-if="editor" :editor="editor" />
  </div>
</template>
