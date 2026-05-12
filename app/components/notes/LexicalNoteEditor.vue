<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import type { EditorState } from 'lexical'
import { $getRoot } from 'lexical'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { LexicalComposer } from 'lexical-vue/LexicalComposer'
import { ContentEditable } from 'lexical-vue/LexicalContentEditable'
import { HistoryPlugin } from 'lexical-vue/LexicalHistoryPlugin'
import { OnChangePlugin } from 'lexical-vue/LexicalOnChangePlugin'
import { RichTextPlugin } from 'lexical-vue/LexicalRichTextPlugin'
import { AutoLinkPlugin, createLinkMatcherWithRegExp } from 'lexical-vue/LexicalAutoLinkPlugin'
import { LinkPlugin } from 'lexical-vue/LexicalLinkPlugin'
import { ListPlugin } from 'lexical-vue/LexicalListPlugin'
import { useDebounceFn } from '@vueuse/core'

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

function onError(error: Error) {
  console.error(error)
}

/**
 * lexical-vue `AutoLinkPlugin` требует `matchers` (required). Иначе в `@lexical/link`
 * приходит `undefined` и падает `matchers.length` на каждый ввод.
 */
const autoLinkMatchers = [
  createLinkMatcherWithRegExp(/https?:\/\/[^\s]+/i, url => url),
  createLinkMatcherWithRegExp(/\bwww\.[^\s]+\.[^\s]{2,}/i, url => `https://${url}`),
  createLinkMatcherWithRegExp(
    /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/,
    email => `mailto:${email}`,
  ),
]

/** Не привязывать editorState к живому modelValue — иначе конфиг пересчитывается на каждый PATCH и ломает редактирование. Обновляется только при смене заметки (`noteKey`). */
const seedDocJson = shallowRef(props.modelValue || '')

watch(
  () => props.noteKey,
  () => {
    seedDocJson.value = props.modelValue || ''
  },
  { flush: 'sync' },
)

const initialConfig = computed(() => ({
  namespace: 'NotesEditor',
  editable: !props.readOnly,
  editorState: seedDocJson.value || undefined,
  theme: {
    paragraph: 'lex-p',
    text: {
      bold: 'lex-bold',
      italic: 'lex-italic',
      underline: 'lex-underline',
      strikethrough: 'lex-strike',
      code: 'lex-code',
    },
    list: {
      ul: 'lex-ul',
      ol: 'lex-ol',
      listitem: 'lex-li',
    },
    link: 'lex-link',
    heading: {
      h1: 'lex-h1',
      h2: 'lex-h2',
      h3: 'lex-h3',
    },
    quote: 'lex-quote',
  },
  nodes: [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    LinkNode,
    AutoLinkNode,
  ],
  onError,
}))

const debouncedEmit = useDebounceFn((state: EditorState) => {
  const json = JSON.stringify(state.toJSON())
  emit('update:modelValue', json)
  state.read(() => {
    const text = $getRoot().getTextContent()
    emit('update:excerpt', text.slice(0, 500))
  })
}, 450)

function onChange(editorState: EditorState) {
  if (props.readOnly) return
  debouncedEmit(editorState)
}
</script>

<template>
  <LexicalComposer :key="props.noteKey" :initial-config="initialConfig">
    <RichTextPlugin>
      <template #contentEditable>
        <div class="relative isolate z-[2]">
          <ContentEditable
            class="lex-editor relative z-[1] min-h-[320px] w-full max-w-none px-3 py-2 text-base leading-relaxed text-zinc-800 outline-none"
          />
        </div>
      </template>
      <template #placeholder>
        <div class="pointer-events-none absolute left-3 top-2 z-0 text-zinc-400">
          {{ placeholder }}
        </div>
      </template>
    </RichTextPlugin>
    <HistoryPlugin />
    <ListPlugin />
    <LinkPlugin />
    <AutoLinkPlugin :matchers="autoLinkMatchers" />
    <OnChangePlugin @change="onChange" />
  </LexicalComposer>
</template>

<style scoped>
:deep(.lex-h1) {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0.75rem 0 0.35rem;
}
:deep(.lex-h2) {
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0.65rem 0 0.3rem;
}
:deep(.lex-h3) {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0.5rem 0 0.25rem;
}
:deep(.lex-p) {
  margin: 0.2rem 0;
}
:deep(.lex-ul),
:deep(.lex-ol) {
  margin: 0.35rem 0 0.35rem 1.25rem;
  padding: 0;
}
:deep(.lex-li) {
  margin: 0.15rem 0;
}
:deep(.lex-quote) {
  border-left: 3px solid rgba(15, 23, 42, 0.15);
  margin: 0.5rem 0;
  padding-left: 0.75rem;
  color: rgb(82 82 91);
}
:deep(.lex-link) {
  color: #2563eb;
  text-decoration: underline;
}
:deep(.lex-bold) {
  font-weight: 700;
}
:deep(.lex-italic) {
  font-style: italic;
}
</style>
