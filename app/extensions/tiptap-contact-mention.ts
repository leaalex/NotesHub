import type { DOMOutputSpec } from '@tiptap/pm/model'
import { Node, mergeAttributes } from '@tiptap/core'
import { lucideUserIcon } from '~/extensions/mention-chip-lucide-icons'

export const ContactMention = Node.create({
  name: 'contactMention',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: false,
  selectable: true,

  addAttributes() {
    return {
      contactId: {
        default: null as string | null,
      },
      displayName: {
        default: '',
      },
      type: {
        default: 'person',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-contact-id]',
      },
      {
        tag: 'span[data-contact-id]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const cid = String(node.attrs.contactId ?? '')
    const name = String(node.attrs.displayName ?? '')
    const href = cid ? `/contacts/${encodeURIComponent(cid)}` : '#'
    const kids: DOMOutputSpec[] = [lucideUserIcon()]
    if (name)
      kids.push(['span', { class: 'min-w-0' }, name])
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-contact-id': cid,
        href,
        class:
          'contact-mention-chip inline-flex items-center gap-1 rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[12px] font-medium text-zinc-800 no-underline ring-1 ring-zinc-200/80',
      }),
      ...kids,
    ]
  },

  renderText({ node }) {
    const name = String(node.attrs.displayName ?? '')
    return name || 'Contact'
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
