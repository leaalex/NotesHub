<script setup lang="ts">
import type { Editor, JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { AtMentions } from '~/extensions/tiptap-at-mentions'
import { ContactMention } from '~/extensions/tiptap-contact-mention'
import { FileMention } from '~/extensions/tiptap-file-mention'
import { SlashCommands } from '~/extensions/tiptap-slash-commands'
import { EMPTY_TIPTAP_DOC_JSON } from '#shared/tiptap-empty-doc'
import {
  clearTiptapInsertMentionHandlers,
  registerTiptapInsertMentionHandlers,
} from '#shared/tiptap-insert-mention-registry'
import {
  formatToolbarHistoryItems,
  formatToolbarMainItems,
  registerTiptapLinkHandler,
} from '#shared/tiptap-format-toolbar'
import type { NoteOutlineItem } from '#shared/note-outline'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    noteKey: string
    noteId?: string | null
    modelValue: string
    readOnly?: boolean
    placeholder?: string
    /** When false, parent renders the docked toolbar (e.g. full width of scroll column). */
    embedTopToolbar?: boolean
  }>(),
  {
    readOnly: false,
    placeholder: 'Start writing…',
    embedTopToolbar: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:excerpt': [value: string]
  'update:outline': [value: NoteOutlineItem[]]
  'mention:file': [fileId: string]
}>()

/** Accept only Tiptap doc JSON; Lexical `{}` / invalid payloads fall back to empty doc. */
function parseDoc(raw: string): JSONContent {
  try {
    const v = JSON.parse(raw || EMPTY_TIPTAP_DOC_JSON) as unknown
    if (
      v
      && typeof v === 'object'
      && !Array.isArray(v)
      && (v as JSONContent).type === 'doc'
    ) {
      return v as JSONContent
    }
  }
  catch {
    /* ignore */
  }
  return JSON.parse(EMPTY_TIPTAP_DOC_JSON) as JSONContent
}

const debouncedEmit = useDebounceFn((ed: Editor) => {
  emit('update:modelValue', JSON.stringify(ed.getJSON()))
  emit('update:excerpt', ed.getText().slice(0, 500))
}, 450)

/** Assign stable DOM ids for in-note navigation (right-hand outline). */
function flushHeadingOutline(ed: Editor) {
  nextTick(() => {
    if (!ed.view?.dom || ed.isDestroyed)
      return
    const dom = ed.view.dom as HTMLElement
    const nodes = dom.querySelectorAll('h1, h2, h3')
    const items: NoteOutlineItem[] = []
    nodes.forEach((node, i) => {
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()
      const level = Number(tag.slice(1))
      if (level !== 1 && level !== 2 && level !== 3)
        return
      const id = `nh-${i}`
      el.dataset.noteHeadingId = id
      items.push({
        id,
        level: level as 1 | 2 | 3,
        text: el.textContent?.trim() || 'Untitled',
      })
    })
    emit('update:outline', items)
  })
}

/** Mount bubble in `body` so Safari and `overflow-hidden` ancestors do not clip it. */
function bubbleAppendTo() {
  return document.body
}

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: props.readOnly,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class:
            'font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900',
        },
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    ContactMention,
    FileMention,
    AtMentions.configure({
      onPickFile: fileId => emit('mention:file', fileId),
    }),
    SlashCommands,
  ],
  content: parseDoc(props.modelValue),
  editable: !props.readOnly,
  editorProps: {
    attributes: {
      class:
        'note-editor-prose min-h-[min(60vh,28rem)] w-full max-w-none px-1 py-6 text-[15px] leading-relaxed text-zinc-800 outline-none focus:outline-none',
    },
  },
  onUpdate: ({ editor: ed }) => {
    if (!ed.isEditable)
      return
    debouncedEmit(ed)
  },
  onCreate: ({ editor: ed }) => {
    flushHeadingOutline(ed)
  },
  onTransaction: ({ editor: ed, transaction }) => {
    if (transaction.docChanged)
      flushHeadingOutline(ed)
  },
})

/** Bubble menu listens to this for reposition on scroll (column is overflow-y-auto, not window). */
const bubbleScrollTarget = ref<HTMLElement | Window>(window)

watch(
  () => editor.value?.view?.dom,
  dom => {
    if (!dom) {
      bubbleScrollTarget.value = window
      return
    }
    const scrollParent = dom.closest('.overflow-y-auto')
    bubbleScrollTarget.value
      = scrollParent instanceof HTMLElement ? scrollParent : window
  },
  { immediate: true },
)

const bubbleMenuOptions = computed(() => ({
  placement: 'top' as const,
  strategy: 'fixed' as const,
  offset: 8,
  flip: {},
  shift: { padding: 12 },
  scrollTarget: bubbleScrollTarget.value,
}))

const linkModal = useTiptapLinkModal()
const mentionPickers = useTiptapMentionPickers()

onMounted(() => {
  registerTiptapLinkHandler(ed => {
    void linkModal.runLinkFlow(ed)
  })
  registerTiptapMentionFileLinkCallback(id => emit('mention:file', id))
  registerTiptapInsertMentionHandlers({
    contact: ed => mentionPickers.openContactPicker(ed),
    fileLibrary: ed => mentionPickers.openFileLibraryPicker(ed),
    fileUpload: ed => mentionPickers.openFileUploadPicker(ed),
  })
})

onUnmounted(() => {
  registerTiptapLinkHandler(null)
  registerTiptapMentionFileLinkCallback(null)
  clearTiptapInsertMentionHandlers()
})

watch(
  () => props.noteKey,
  async () => {
    await nextTick()
    editor.value?.commands.setContent(parseDoc(props.modelValue), { emitUpdate: false })
    await nextTick()
    if (editor.value && !editor.value.isDestroyed)
      flushHeadingOutline(editor.value)
  },
)

watch(
  () => props.readOnly,
  ro => {
    editor.value?.setEditable(!ro)
  },
)

defineExpose({
  tiptapEditor: editor,
})
</script>

<template>
  <div class="min-h-0" v-bind="$attrs">
    <template v-if="editor">
      <div
        v-if="!readOnly && embedTopToolbar"
        class="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-0.5 border-b border-zinc-100 bg-white/95 px-1 pb-2 pt-1 [backdrop-filter:blur(6px)]"
        role="toolbar"
        aria-label="Formatting"
      >
        <template v-for="(item, idx) in formatToolbarHistoryItems" :key="`top-h-${idx}`">
          <span
            v-if="item.kind === 'divider'"
            class="mx-0.5 w-px self-stretch bg-zinc-200"
            aria-hidden="true"
          />
          <UButton
            v-else
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
        <template v-for="(item, idx) in formatToolbarMainItems" :key="`top-m-${idx}`">
          <span
            v-if="item.kind === 'divider'"
            class="mx-0.5 w-px self-stretch bg-zinc-200"
            aria-hidden="true"
          />
          <UButton
            v-else
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
        <span class="mx-0.5 w-px self-stretch bg-zinc-200" aria-hidden="true" />
        <NotesTiptapInsertInNoteMenu :editor="editor" />
      </div>
      <BubbleMenu
        v-if="!readOnly"
        class="z-[500] isolate"
        :editor="editor"
        :append-to="bubbleAppendTo"
        :options="bubbleMenuOptions"
      >
        <div
          class="relative z-[500] flex max-w-[min(100vw-1.5rem,96rem)] flex-wrap items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-1 shadow-md ring-1 ring-zinc-950/[0.06]"
        >
          <template v-for="(item, idx) in formatToolbarHistoryItems" :key="`bubble-h-${idx}`">
            <span
              v-if="item.kind === 'divider'"
              class="mx-0.5 w-px self-stretch bg-zinc-200"
              aria-hidden="true"
            />
            <UButton
              v-else
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
          <template v-for="(item, idx) in formatToolbarMainItems" :key="`bubble-m-${idx}`">
            <span
              v-if="item.kind === 'divider'"
              class="mx-0.5 w-px self-stretch bg-zinc-200"
              aria-hidden="true"
            />
            <UButton
              v-else
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
          <span class="mx-0.5 w-px self-stretch bg-zinc-200" aria-hidden="true" />
          <NotesTiptapInsertInNoteMenu :editor="editor" />
        </div>
      </BubbleMenu>
      <NotesTiptapLinkModal />
      <NotesTiptapMentionPickModals />
      <EditorContent :editor="editor" />
    </template>
  </div>
</template>

<style scoped>
/* Minimal content rhythm (Tailwind @plugin typography does not resolve in this Nuxt+Vite setup). */
:deep(.note-editor-prose h1) {
  font-size: 1.875rem;
  font-weight: 600;
  line-height: 1.2;
  margin: 1.25rem 0 0.5rem;
}
:deep(.note-editor-prose h1:first-child) {
  margin-top: 0;
}
:deep(.note-editor-prose h2) {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
  margin: 1.1rem 0 0.45rem;
}
:deep(.note-editor-prose h3) {
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.3;
  margin: 0.9rem 0 0.35rem;
}
:deep(.note-editor-prose p) {
  margin: 0.5rem 0;
}
:deep(.note-editor-prose ul:not([data-type='taskList'])),
:deep(.note-editor-prose ol) {
  margin: 0.5rem 0;
  padding-left: 1.35rem;
  list-style-position: outside;
}
:deep(.note-editor-prose ul:not([data-type='taskList'])) {
  list-style-type: disc;
}
:deep(.note-editor-prose ol) {
  list-style-type: decimal;
}
/* Nested bullet rhythm (preflight removed bullets entirely). */
:deep(.note-editor-prose ul:not([data-type='taskList']) ul:not([data-type='taskList'])) {
  list-style-type: circle;
  margin: 0.25rem 0;
}
:deep(.note-editor-prose ul:not([data-type='taskList']) ul:not([data-type='taskList']) ul:not([data-type='taskList'])) {
  list-style-type: square;
}
:deep(.note-editor-prose li) {
  margin: 0.15rem 0;
  display: list-item;
}
:deep(.note-editor-prose blockquote) {
  border-left: 3px solid rgb(228 228 231);
  margin: 0.85rem 0;
  padding: 0.15rem 0 0.15rem 0.9rem;
  color: rgb(82 82 91);
}
:deep(.note-editor-prose pre) {
  margin: 0.85rem 0;
  border-radius: 0.5rem;
  border: 1px solid rgb(244 244 245);
  background: rgb(250 250 250);
  padding: 0.85rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
:deep(.note-editor-prose p code) {
  background: rgb(244 244 245);
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  font-size: 0.9em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
:deep(.note-editor-prose hr) {
  margin: 1.25rem 0;
  border: none;
  border-top: 1px solid rgb(244 244 245);
}
/* Task list layout (scoped flex; not covered by generic ul styles). */
:deep(.note-editor-prose ul[data-type='taskList']) {
  list-style: none;
  margin-left: 0;
  padding-left: 0;
}
:deep(.note-editor-prose ul[data-type='taskList'] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}
:deep(.note-editor-prose ul[data-type='taskList'] li label) {
  flex-shrink: 0;
  margin-top: 0.15rem;
}
:deep(.note-editor-prose a.file-mention-chip .mention-chip-icon),
:deep(.note-editor-prose a.contact-mention-chip .mention-chip-icon) {
  display: inline-block;
  vertical-align: -0.15em;
  flex-shrink: 0;
}
/* Mentions: behave like text while editing */
:deep(.note-editor-prose[contenteditable='true'] a.contact-mention-chip),
:deep(.note-editor-prose[contenteditable='true'] a.file-mention-chip) {
  pointer-events: none;
  cursor: text;
}
/* Placeholder (TipTap + @tiptap/extension-placeholder) */
:deep(.note-editor-prose p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: rgb(161 161 170);
  font-weight: 400;
}
:deep(.note-editor-prose[contenteditable='false'] p.is-editor-empty:first-child::before) {
  content: none;
}
</style>
