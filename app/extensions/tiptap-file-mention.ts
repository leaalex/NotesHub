import type { DOMOutputSpec } from '@tiptap/pm/model'
import { Node, mergeAttributes } from '@tiptap/core'
import { lucidePaperclipIcon } from '~/extensions/mention-chip-lucide-icons'

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
      href: {
        default: null as string | null,
        parseHTML: el => el.getAttribute('href'),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'a[data-file-id]' },
      { tag: 'span[data-file-id]' },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const fid = String(node.attrs.fileId ?? '')
    const name = String(node.attrs.displayName ?? '')
    const rawHref = node.attrs.href
    let shareHref: string | null
    if (rawHref !== null && rawHref !== undefined) {
      const s = String(rawHref).trim()
      shareHref = s.length > 0 ? s : null
    }
    else {
      shareHref = fid ? `/files/${encodeURIComponent(fid)}` : null
    }
    const kids: DOMOutputSpec[] = [lucidePaperclipIcon()]
    if (name)
      kids.push(['span', { class: 'min-w-0' }, name])
    const chipClass =
      'file-mention-chip inline-flex items-center gap-1 rounded-[var(--ui-control-radius)] bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-900 no-underline ring-1 ring-emerald-200/70'
    if (shareHref) {
      return [
        'a',
        mergeAttributes(HTMLAttributes, {
          'data-file-id': fid,
          href: shareHref,
          class: chipClass,
        }),
        ...kids,
      ]
    }
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-file-id': fid,
        'aria-disabled': 'true',
        class: `${chipClass} pointer-events-none cursor-default opacity-90`,
      }),
      ...kids,
    ]
  },

  renderText({ node }) {
    const name = String(node.attrs.displayName ?? '')
    return name || 'File'
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
