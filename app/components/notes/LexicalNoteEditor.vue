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
import { SlashCommands } from '~/extensions/tiptap-slash-commands'
import { EMPTY_TIPTAP_DOC_JSON } from '#shared/tiptap-empty-doc'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    noteKey: string
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
        class: 'text-blue-600 underline underline-offset-2',
      },
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    SlashCommands,
  ],
  content: parseDoc(props.modelValue),
  editable: !props.readOnly,
  editorProps: {
    attributes: {
      class:
        'notes-prose-editor relative z-[1] min-h-[320px] w-full max-w-none px-3 py-2 text-base leading-relaxed text-zinc-800 outline-none focus:outline-none',
    },
  },
  onUpdate: ({ editor: ed }) => {
    if (!ed.isEditable)
      return
    debouncedEmit(ed)
  },
})

watch(
  () => props.noteKey,
  async () => {
    await nextTick()
    editor.value?.commands.setContent(parseDoc(props.modelValue), false)
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
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0.75rem 0 0.35rem;
}
:deep(.notes-prose-editor h2) {
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0.65rem 0 0.3rem;
}
:deep(.notes-prose-editor h3) {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0.5rem 0 0.25rem;
}
:deep(.notes-prose-editor p) {
  margin: 0.2rem 0;
}
:deep(.notes-prose-editor ul),
:deep(.notes-prose-editor ol) {
  margin: 0.35rem 0 0.35rem 1.25rem;
  padding: 0;
}
:deep(.notes-prose-editor li) {
  margin: 0.15rem 0;
}
:deep(.notes-prose-editor ul[data-type='taskList']) {
  list-style: none;
  margin-left: 0;
  padding-left: 0;
}
:deep(.notes-prose-editor ul[data-type='taskList'] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
}
:deep(.notes-prose-editor ul[data-type='taskList'] li label) {
  flex-shrink: 0;
  margin-top: 0.15rem;
}
:deep(.notes-prose-editor blockquote) {
  border-left: 3px solid rgba(15, 23, 42, 0.15);
  margin: 0.5rem 0;
  padding-left: 0.75rem;
  color: rgb(82 82 91);
}
:deep(.notes-prose-editor pre) {
  margin: 0.5rem 0;
  border-radius: 0.375rem;
  background: rgb(244 244 245);
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  line-height: 1.45;
  overflow-x: auto;
}
:deep(.notes-prose-editor code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
:deep(.notes-prose-editor p code) {
  background: rgb(244 244 245);
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}
:deep(.notes-prose-editor strong) {
  font-weight: 700;
}
:deep(.notes-prose-editor em) {
  font-style: italic;
}
:deep(.notes-prose-editor p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: rgb(161 161 170);
}
</style>
