import type { Editor, Range } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'

export type SlashCommandItem = {
  title: string
  keywords?: string[]
  command: (opts: { editor: Editor; range: Range }) => void
}

function getItems(query: string): SlashCommandItem[] {
  const q = query.toLowerCase().trim()
  const all: SlashCommandItem[] = [
    {
      title: 'Text',
      keywords: ['paragraph', 'plain', 'p'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run()
      },
    },
    {
      title: 'Heading 1',
      keywords: ['h1', 'title'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
      },
    },
    {
      title: 'Heading 2',
      keywords: ['h2', 'subtitle'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
      },
    },
    {
      title: 'Heading 3',
      keywords: ['h3'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
      },
    },
    {
      title: 'Bullet list',
      keywords: ['ul', 'unordered'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
    },
    {
      title: 'Numbered list',
      keywords: ['ol', 'ordered'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
    },
    {
      title: 'Task list',
      keywords: ['todo', 'checkbox'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run()
      },
    },
    {
      title: 'Quote',
      keywords: ['blockquote', 'quotation'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      },
    },
    {
      title: 'Code block',
      keywords: ['code', 'pre'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
      },
    },
  ]
  if (!q) return all
  return all.filter(
    i =>
      i.title.toLowerCase().includes(q)
      || i.keywords?.some(k => k.includes(q)),
  )
}

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    const editor = this.editor
    const pluginKey = new PluginKey('slashCommands')

    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor,
        pluginKey,
        char: '/',
        allowSpaces: true,
        allowedPrefixes: [' ', '\n'],
        shouldShow: ({ editor }) => editor.isEditable,
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
        items: ({ query }) => getItems(query),
        render: () => {
          let root: HTMLDivElement | null = null
          let selectedIndex = 0
          let current: SuggestionProps<SlashCommandItem> | null = null

          function positionMenu() {
            if (!root || !current?.clientRect) return
            const rect = current.clientRect()
            if (!rect) return
            root.style.position = 'fixed'
            root.style.left = `${Math.round(rect.left)}px`
            root.style.top = `${Math.round(rect.bottom + 8)}px`
            root.style.minWidth = '240px'
            root.style.maxHeight = 'min(320px, 60vh)'
            root.style.overflowY = 'auto'
            root.style.zIndex = '200'
          }

          function renderButtons(next: SuggestionProps<SlashCommandItem>) {
            current = next
            if (!root) return
            root.replaceChildren()
            if (next.items.length === 0) {
              root.classList.add('hidden')
              return
            }
            root.classList.remove('hidden')
            next.items.forEach((item, index) => {
              const btn = document.createElement('button')
              btn.type = 'button'
              btn.textContent = item.title
              btn.className = [
                'flex w-full rounded-[var(--ui-control-radius)] px-3 py-2.5 text-left text-[13px] font-medium tracking-tight transition-colors',
                index === selectedIndex
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-700 hover:bg-zinc-50',
              ].join(' ')
              btn.addEventListener('mousedown', e => {
                e.preventDefault()
                next.command(item)
              })
              root!.appendChild(btn)
            })
            positionMenu()
          }

          return {
            onStart: props => {
              selectedIndex = 0
              root = document.createElement('div')
              root.className
                = 'slash-command-menu rounded-[var(--ui-panel-radius)] border border-zinc-200/90 bg-white/95 py-1.5 backdrop-blur-xl ring-1 ring-zinc-950/[0.04]'
              document.body.appendChild(root)
              renderButtons(props)
            },
            onUpdate: props => {
              selectedIndex = 0
              renderButtons(props)
            },
            onExit: () => {
              root?.remove()
              root = null
              current = null
            },
            onKeyDown: ({ event }) => {
              if (!current || current.items.length === 0) return false
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
                if (item) current.command(item)
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
