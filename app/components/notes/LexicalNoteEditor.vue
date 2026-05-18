<script setup lang="ts">
import type { Editor, JSONContent } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { useDebounceFn } from '@vueuse/core'
import { nextTick, watch } from 'vue'
import { BlockToolbar } from '~/extensions/tiptap-block-toolbar'
import { AtMentions } from '~/extensions/tiptap-at-mentions'
import { ContactMention } from '~/extensions/tiptap-contact-mention'
import { FileMention } from '~/extensions/tiptap-file-mention'
import { SlashCommands } from '~/extensions/tiptap-slash-commands'
import { EMPTY_TIPTAP_DOC_JSON } from '#shared/tiptap-empty-doc'
import type { NoteOutlineItem } from '#shared/note-outline'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    noteKey: string
    /** Опционально: id заметки (для будущего использования или отладки). */
    noteId?: string | null
    modelValue: string
    readOnly?: boolean
    placeholder?: string
  }>(),
  {
    readOnly: false,
    placeholder: 'Start writing…',
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

/** Assign stable DOM ids for in-note navigation (Notion-style outline). */
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

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({
      openOnClick: props.readOnly,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        class:
          'font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-[3px] transition-colors hover:text-zinc-900 hover:decoration-zinc-400',
      },
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    ContactMention,
    FileMention,
    AtMentions.configure({
      onPickFile: fileId => emit('mention:file', fileId),
    }),
    BlockToolbar,
    SlashCommands,
  ],
  content: parseDoc(props.modelValue),
  editable: !props.readOnly,
  editorProps: {
    attributes: {
      class:
        'notes-prose-editor relative z-[1] min-h-[min(60vh,28rem)] w-full max-w-none px-1 py-6 text-[14px] leading-[1.35] tracking-[-0.01em] text-zinc-800 antialiased outline-none focus:outline-none sm:text-[14px]',
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

watch(
  () => props.noteKey,
  async () => {
    await nextTick()
    editor.value?.commands.setContent(parseDoc(props.modelValue), false)
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
</script>

<template>
  <div class="min-h-0" v-bind="$attrs">
    <EditorContent v-if="editor" :editor="editor" />
  </div>
</template>

<style scoped>
:deep(.notes-prose-editor h1) {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 1.75rem 0 0.75rem;
}
:deep(.notes-prose-editor h1:first-child) {
  margin-top: 0;
}
:deep(.notes-prose-editor h2) {
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.25;
  margin: 1.35rem 0 0.5rem;
}
:deep(.notes-prose-editor h3) {
  font-size: 1.08rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.35;
  margin: 1.1rem 0 0.4rem;
}
:deep(.notes-prose-editor p) {
  margin: 0.45rem 0;
}
:deep(.notes-prose-editor ul),
:deep(.notes-prose-editor ol) {
  margin: 0.5rem 0 0.5rem 1.35rem;
  padding: 0;
}
:deep(.notes-prose-editor li) {
  margin: 0.2rem 0;
}
:deep(.notes-prose-editor ul[data-type='taskList']) {
  list-style: none;
  margin-left: 0;
  padding-left: 0;
}
:deep(.notes-prose-editor ul[data-type='taskList'] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}
:deep(.notes-prose-editor ul[data-type='taskList'] li label) {
  flex-shrink: 0;
  margin-top: 0.28rem;
}
:deep(.notes-prose-editor ul[data-type='taskList'] li label input[type='checkbox']) {
  accent-color: rgb(24 24 27);
  border-radius: 4px;
}
:deep(.notes-prose-editor blockquote) {
  border-left: 2px solid rgb(228 228 231);
  margin: 1rem 0;
  padding: 0.15rem 0 0.15rem 1rem;
  color: rgb(82 82 91);
}
:deep(.notes-prose-editor pre) {
  margin: 1rem 0;
  border-radius: 0.75rem;
  border: 1px solid rgb(244 244 245);
  background: rgb(250 250 250);
  padding: 1rem 1.15rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  overflow-x: auto;
}
:deep(.notes-prose-editor code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
:deep(.notes-prose-editor p code) {
  background: rgb(244 244 245);
  padding: 0.12rem 0.4rem;
  border-radius: 0.375rem;
  font-size: 0.88em;
  border: 1px solid rgb(244 244 245);
}
:deep(.notes-prose-editor strong) {
  font-weight: 600;
}
:deep(.notes-prose-editor em) {
  font-style: italic;
}
:deep(.notes-prose-editor hr) {
  margin: 1.75rem 0;
  border: none;
  border-top: 1px solid rgb(244 244 245);
}
:deep(.notes-prose-editor[contenteditable='true'] a.contact-mention-chip) {
  pointer-events: none;
  cursor: text;
}
:deep(.notes-prose-editor[contenteditable='true'] a.file-mention-chip) {
  pointer-events: none;
  cursor: text;
}
:deep(.notes-prose-editor p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: rgb(161 161 170);
  font-weight: 400;
}
:deep(.notes-prose-editor[contenteditable='false'] p.is-editor-empty:first-child::before) {
  content: none;
}
</style>
