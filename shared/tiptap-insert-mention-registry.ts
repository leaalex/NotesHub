import type { Editor } from '@tiptap/core'

let insertContact: ((ed: Editor) => void) | null = null
let insertFileLibrary: ((ed: Editor) => void) | null = null
let insertFileUpload: ((ed: Editor) => void) | null = null

export function registerTiptapInsertMentionHandlers(h: {
  contact: typeof insertContact
  fileLibrary: typeof insertFileLibrary
  fileUpload: typeof insertFileUpload
}) {
  insertContact = h.contact
  insertFileLibrary = h.fileLibrary
  insertFileUpload = h.fileUpload
}

export function clearTiptapInsertMentionHandlers() {
  insertContact = null
  insertFileLibrary = null
  insertFileUpload = null
}

export function requestInsertContactMention(ed: Editor) {
  insertContact?.(ed)
}

export function requestInsertFileMentionFromLibrary(ed: Editor) {
  insertFileLibrary?.(ed)
}

export function requestInsertFileMentionUpload(ed: Editor) {
  insertFileUpload?.(ed)
}
