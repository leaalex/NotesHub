import type { Editor } from '@tiptap/core'

export type FormatToolbarItem =
  | { kind: 'divider' }
  | {
      kind: 'button'
      icon: string
      label: string
      isActive: (ed: Editor) => boolean
      /** Optional; e.g. undo/redo when history is empty. */
      disabled?: (ed: Editor) => boolean
      run: (ed: Editor) => void
    }

export function clearFormattingOnEditor(ed: Editor) {
  ed.chain().focus().unsetAllMarks().run()
  if (ed.can().setParagraph())
    ed.chain().focus().setParagraph().run()
}

export type TiptapLinkHandler = (ed: Editor) => void

let linkHandler: TiptapLinkHandler | null = null

/** Called from the note editor on mount; opens the in-app link modal instead of `window.prompt`. */
export function registerTiptapLinkHandler(handler: TiptapLinkHandler | null) {
  linkHandler = handler
}

export function setLinkOnEditor(ed: Editor) {
  if (linkHandler) {
    linkHandler(ed)
    return
  }
  if (typeof window === 'undefined')
    return
  const prev = ed.getAttributes('link').href as string | undefined
  const url = window.prompt('URL', prev || 'https://')
  if (url === null)
    return
  const chain = ed.chain().focus().extendMarkRange('link')
  if (url === '')
    chain.unsetLink().run()
  else
    chain.setLink({ href: url }).run()
}

/** Undo / Redo — first on the docked toolbar (Insert is last). */
export const formatToolbarHistoryItems: FormatToolbarItem[] = [
  {
    kind: 'button',
    icon: 'i-lucide-undo',
    label: 'Undo',
    isActive: () => false,
    disabled: ed => !ed.can().undo(),
    run: ed => ed.chain().focus().undo().run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-redo',
    label: 'Redo',
    isActive: () => false,
    disabled: ed => !ed.can().redo(),
    run: ed => ed.chain().focus().redo().run(),
  },
]

/** Everything after history (starts with divider). Docked toolbar: Insert is rendered after this block. */
export const formatToolbarMainItems: FormatToolbarItem[] = [
  { kind: 'divider' },
  {
    kind: 'button',
    icon: 'i-lucide-heading-1',
    label: 'Heading 1',
    isActive: ed => ed.isActive('heading', { level: 1 }),
    run: ed => ed.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-heading-2',
    label: 'Heading 2',
    isActive: ed => ed.isActive('heading', { level: 2 }),
    run: ed => ed.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-heading-3',
    label: 'Heading 3',
    isActive: ed => ed.isActive('heading', { level: 3 }),
    run: ed => ed.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-pilcrow',
    label: 'Paragraph',
    isActive: ed => ed.isActive('paragraph'),
    run: ed => ed.chain().focus().setParagraph().run(),
  },
  { kind: 'divider' },
  {
    kind: 'button',
    icon: 'i-lucide-bold',
    label: 'Bold',
    isActive: ed => ed.isActive('bold'),
    run: ed => ed.chain().focus().toggleBold().run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-italic',
    label: 'Italic',
    isActive: ed => ed.isActive('italic'),
    run: ed => ed.chain().focus().toggleItalic().run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-code',
    label: 'Inline code',
    isActive: ed => ed.isActive('code'),
    run: ed => ed.chain().focus().toggleCode().run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-link',
    label: 'Link',
    isActive: ed => ed.isActive('link'),
    run: ed => setLinkOnEditor(ed),
  },
  { kind: 'divider' },
  {
    kind: 'button',
    icon: 'i-lucide-list',
    label: 'Bullet list',
    isActive: ed => ed.isActive('bulletList'),
    run: ed => ed.chain().focus().toggleBulletList().run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-list-ordered',
    label: 'Ordered list',
    isActive: ed => ed.isActive('orderedList'),
    run: ed => ed.chain().focus().toggleOrderedList().run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-quote',
    label: 'Quote',
    isActive: ed => ed.isActive('blockquote'),
    run: ed => ed.chain().focus().toggleBlockquote().run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-square-code',
    label: 'Code block',
    isActive: ed => ed.isActive('codeBlock'),
    run: ed => ed.chain().focus().toggleCodeBlock().run(),
  },
  {
    kind: 'button',
    icon: 'i-lucide-separator-horizontal',
    label: 'Horizontal rule',
    isActive: () => false,
    run: ed => ed.chain().focus().setHorizontalRule().run(),
  },
  { kind: 'divider' },
  {
    kind: 'button',
    icon: 'i-lucide-remove-formatting',
    label: 'Clear formatting',
    isActive: () => false,
    run: ed => clearFormattingOnEditor(ed),
  },
]

/** Full strip order for contexts that use a single loop (history + main). */
export const formatToolbarItems: FormatToolbarItem[] = [
  ...formatToolbarHistoryItems,
  ...formatToolbarMainItems,
]
