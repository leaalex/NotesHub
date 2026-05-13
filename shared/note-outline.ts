/** Outline entries built client-side from Tiptap heading nodes (Notion-like nav). */
export type NoteOutlineItem = {
  id: string
  level: 1 | 2 | 3
  text: string
}
