import { Node, mergeAttributes } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'

export type ContactSuggestionItem = {
  id: string
  displayName: string
  type: string
}

function getItems(query: string): Promise<ContactSuggestionItem[]> {
  return $fetch<ContactSuggestionItem[]>('/api/contacts', {
    credentials: 'include',
    query: { q: query },
  }).catch(() => [])
}

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
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-contact-id': cid,
        href,
        class:
          'contact-mention-chip rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[12px] font-medium text-zinc-700 no-underline',
      }),
      `@${name}`,
    ]
  },

  renderText({ node }) {
    const name = node.attrs.displayName ?? ''
    return `@${name}`
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

  addProseMirrorPlugins() {
    const editor = this.editor
    const name = this.name
    const pluginKey = new PluginKey('contactMentionSuggestion')

    return [
      Suggestion<ContactSuggestionItem, ContactSuggestionItem>({
        editor,
        pluginKey,
        char: '@',
        allowSpaces: false,
        allowedPrefixes: [' ', '\n'],
        shouldShow: ({ editor: ed }) => ed.isEditable,
        command: ({ editor: ed, range, props }) => {
          ed
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: name,
                attrs: {
                  contactId: props.id,
                  displayName: props.displayName,
                  type: props.type,
                },
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run()
        },
        items: async ({ query }) => await getItems(query),
        render: () => {
          let root: HTMLDivElement | null = null
          let selectedIndex = 0
          let current: SuggestionProps<ContactSuggestionItem> | null = null

          function positionMenu() {
            if (!root || !current?.clientRect)
              return
            const rect = current.clientRect()
            if (!rect)
              return
            root.style.position = 'fixed'
            root.style.left = `${Math.round(rect.left)}px`
            root.style.top = `${Math.round(rect.bottom + 8)}px`
            root.style.minWidth = '240px'
            root.style.maxHeight = 'min(320px, 60vh)'
            root.style.overflowY = 'auto'
            root.style.zIndex = '200'
          }

          function renderButtons(next: SuggestionProps<ContactSuggestionItem>) {
            current = next
            if (!root)
              return
            root.replaceChildren()
            if (next.items.length === 0) {
              root.classList.add('hidden')
              return
            }
            root.classList.remove('hidden')
            next.items.forEach((item, index) => {
              const btn = document.createElement('button')
              btn.type = 'button'
              btn.textContent = item.displayName || 'Contact'
              btn.className = [
                'flex w-full rounded-[var(--ui-control-radius)] px-3 py-2.5 text-left text-[13px] font-medium tracking-tight transition-colors',
                index === selectedIndex
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-700 hover:bg-zinc-50',
              ].join(' ')
              btn.addEventListener('mousedown', (e) => {
                e.preventDefault()
                next.command(item)
              })
              root!.appendChild(btn)
            })
            positionMenu()
          }

          return {
            onStart: (props) => {
              selectedIndex = 0
              root = document.createElement('div')
              root.className
                = 'contact-mention-menu rounded-[var(--ui-panel-radius)] border border-zinc-200/90 bg-white/95 py-1.5 backdrop-blur-xl ring-1 ring-zinc-950/[0.04]'
              document.body.appendChild(root)
              renderButtons(props)
            },
            onUpdate: (props) => {
              selectedIndex = 0
              renderButtons(props)
            },
            onExit: () => {
              root?.remove()
              root = null
              current = null
            },
            onKeyDown: ({ event }) => {
              if (!current || current.items.length === 0)
                return false
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                selectedIndex = (selectedIndex + 1) % current.items.length
                renderButtons(current)
                return true
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                selectedIndex
                  = (selectedIndex + current.items.length - 1) % current.items.length
                renderButtons(current)
                return true
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                const item = current.items[selectedIndex]
                if (item)
                  current.command(item)
                return true
              }
              return false
            },
          }
        },
      }),
    ]
  },
})
