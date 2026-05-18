import type { Editor } from '@tiptap/core'
import { nextTick, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'

type ContactRow = { id: string; displayName: string; type: string }
type FileRow = { id: string; originalName: string; title?: string; mimeType: string }

function insertContactMentionAtSelection(
  ed: Editor,
  p: { id: string; displayName: string; type: string },
) {
  ed.chain().focus().insertContent([
    {
      type: 'contactMention',
      attrs: {
        contactId: p.id,
        displayName: p.displayName,
        type: p.type,
      },
    },
    { type: 'text', text: ' ' },
  ]).run()
}

function insertFileMentionAtSelection(
  ed: Editor,
  p: { id: string; displayName: string; mimeType: string },
) {
  ed.chain().focus().insertContent([
    {
      type: 'fileMention',
      attrs: {
        fileId: p.id,
        displayName: p.displayName,
        mimeType: p.mimeType,
      },
    },
    { type: 'text', text: ' ' },
  ]).run()
}

let onFileLinked: ((id: string) => void) | null = null

export function registerTiptapMentionFileLinkCallback(cb: typeof onFileLinked) {
  onFileLinked = cb
}

const contactOpen = ref(false)
const fileOpen = ref(false)
const contactQuery = ref('')
const fileQuery = ref('')
const contacts = ref<ContactRow[]>([])
const files = ref<FileRow[]>([])
const uploadInputRef = ref<HTMLInputElement | null>(null)

let pendingContactEditor: Editor | null = null
let pendingFileEditor: Editor | null = null
let uploadTargetEditor: Editor | null = null

async function loadContacts() {
  contacts.value = await $fetch<ContactRow[]>('/api/contacts', {
    credentials: 'include',
    query: { q: contactQuery.value },
  }).catch(() => [])
}

async function loadFiles() {
  files.value = await $fetch<FileRow[]>('/api/files', {
    credentials: 'include',
    query: { q: fileQuery.value },
  }).catch(() => [])
}

watchDebounced(
  contactQuery,
  () => {
    if (contactOpen.value)
      void loadContacts()
  },
  { debounce: 200 },
)

watchDebounced(
  fileQuery,
  () => {
    if (fileOpen.value)
      void loadFiles()
  },
  { debounce: 200 },
)

export function useTiptapMentionPickers() {
  function openContactPicker(ed: Editor) {
    pendingContactEditor = ed
    contactQuery.value = ''
    contactOpen.value = true
    void loadContacts()
  }

  function pickContact(c: ContactRow) {
    if (pendingContactEditor) {
      insertContactMentionAtSelection(pendingContactEditor, {
        id: c.id,
        displayName: c.displayName,
        type: c.type,
      })
    }
    pendingContactEditor = null
    contactOpen.value = false
  }

  function cancelContactPicker() {
    pendingContactEditor = null
    contactOpen.value = false
  }

  function openFileLibraryPicker(ed: Editor) {
    pendingFileEditor = ed
    fileQuery.value = ''
    fileOpen.value = true
    void loadFiles()
  }

  function pickFile(f: FileRow) {
    if (pendingFileEditor) {
      const displayName = String(f.title ?? '').trim().length
        ? String(f.title).trim()
        : f.originalName
      insertFileMentionAtSelection(pendingFileEditor, {
        id: f.id,
        displayName,
        mimeType: f.mimeType ?? '',
      })
      onFileLinked?.(f.id)
    }
    pendingFileEditor = null
    fileOpen.value = false
  }

  function cancelFilePicker() {
    pendingFileEditor = null
    fileOpen.value = false
  }

  function openFileUploadPicker(ed: Editor) {
    uploadTargetEditor = ed
    void nextTick(() => uploadInputRef.value?.click())
  }

  async function onUploadInputChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    const ed = uploadTargetEditor
    uploadTargetEditor = null
    input.value = ''
    if (!file || !ed)
      return

    const form = new FormData()
    form.append('file', file, file.name)
    try {
      const uploaded = await $fetch<{
        id: string
        originalName: string
        title?: string
        mimeType: string
      }>('/api/files/upload', {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      const displayName = String(uploaded.title ?? '').trim().length
        ? String(uploaded.title).trim()
        : uploaded.originalName
      insertFileMentionAtSelection(ed, {
        id: uploaded.id,
        displayName,
        mimeType: uploaded.mimeType ?? '',
      })
      onFileLinked?.(uploaded.id)
    }
    catch {
      /* same as @ mention path — не блокируем редактор */
    }
  }

  return {
    contactOpen,
    fileOpen,
    contactQuery,
    fileQuery,
    contacts,
    files,
    uploadInputRef,
    openContactPicker,
    openFileLibraryPicker,
    openFileUploadPicker,
    pickContact,
    pickFile,
    cancelContactPicker,
    cancelFilePicker,
    onUploadInputChange,
  }
}
