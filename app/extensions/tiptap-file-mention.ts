import { Node, mergeAttributes } from '@tiptap/core'

export const FileMention = Node.create({
  name: 'fileMention',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: false,
  selectable: true,

  addAttributes() {
    return {
      fileId: {
        default: null as string | null,
      },
      displayName: {
        default: '',
      },
      mimeType: {
        default: '',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-file-id]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const fid = String(node.attrs.fileId ?? '')
    const name = String(node.attrs.displayName ?? '')
    const href = fid ? `/files/${encodeURIComponent(fid)}` : '#'
    const label = name ? `📎 ${name}` : '📎'
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-file-id': fid,
        href,
        class:
          'file-mention-chip inline-flex items-baseline gap-0.5 rounded-[var(--ui-control-radius)] bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-900 no-underline ring-1 ring-emerald-200/70',
      }),
      label,
    ]
  },

  renderText({ node }) {
    const name = String(node.attrs.displayName ?? '')
    return name ? `📎 ${name}` : '📎'
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor
        const { selection } = state
        if (!selection.empty)
          return false
        const $pos = selection.$from
        const nodeBefore = $pos.nodeBefore
        if (nodeBefore?.type.name !== this.name)
          return false

        return editor
          .chain()
          .focus()
          .deleteRange({ from: $pos.pos - nodeBefore.nodeSize, to: $pos.pos })
          .run()
      },
    }
  },
})
