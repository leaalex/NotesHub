import type { Editor, Range } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'

export interface AtMentionsOptions {
  onPickFile: (fileId: string) => void
}

/** Единственный элемент для команд Suggestion после разделённого fetch contacts + files. */
export type MentionMenuItem =
  | { kind: 'contact'; id: string; displayName: string; type: string }
  | { kind: 'file'; id: string; displayName: string; mimeType: string }

type ContactApiRow = { id: string; displayName: string; type: string }
type FileApiRow = { id: string; originalName: string; title: string; mimeType: string }

async function fetchMentionItems(query: string): Promise<MentionMenuItem[]> {
  const q = query
  const [contacts, fileRows] = await Promise.all([
    $fetch<ContactApiRow[]>('/api/contacts', {
      credentials: 'include',
      query: { q },
    }).catch(() => []),
    $fetch<FileApiRow[]>('/api/files', {
      credentials: 'include',
      query: { q },
    }).catch(() => []),
  ])
  const contactItems: MentionMenuItem[] = contacts.map(c => ({
    kind: 'contact',
    id: c.id,
    displayName: c.displayName,
    type: c.type,
  }))
  const fileItems: MentionMenuItem[] = fileRows.map((f) => ({
    kind: 'file',
    id: f.id,
    mimeType: f.mimeType ?? '',
    displayName: String(f.title ?? '').trim().length ? String(f.title).trim() : f.originalName,
  }))
  return [...contactItems, ...fileItems]
}

type MenuRow =
  | { kind: 'header'; label: string }
  | { kind: 'item'; item: MentionMenuItem }

function itemsToRows(items: MentionMenuItem[]): MenuRow[] {
  const contacts = items.filter((i): i is Extract<MentionMenuItem, { kind: 'contact' }> => i.kind === 'contact')
  const fileItems = items.filter((i): i is Extract<MentionMenuItem, { kind: 'file' }> => i.kind === 'file')
  const rows: MenuRow[] = []
  if (contacts.length) {
    rows.push({ kind: 'header', label: 'Contacts' })
    for (const c of contacts)
      rows.push({ kind: 'item', item: c })
  }
  if (fileItems.length) {
    rows.push({ kind: 'header', label: 'Files' })
    for (const f of fileItems)
      rows.push({ kind: 'item', item: f })
  }
  return rows
}

export const AtMentions = Extension.create<AtMentionsOptions>({
  name: 'atMentions',

  addOptions() {
    return { onPickFile: (_fileId: string) => { } }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const onPickFile = this.options.onPickFile
    const pluginKey = new PluginKey('atMentionsUnified')

    function runInsert(ed: Editor, range: Range, props: MentionMenuItem) {
      if (props.kind === 'contact') {
        ed
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: 'contactMention',
              attrs: {
                contactId: props.id,
                displayName: props.displayName,
                type: props.type,
              },
            },
            { type: 'text', text: ' ' },
          ])
          .run()
      }
      else {
        ed
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: 'fileMention',
              attrs: {
                fileId: props.id,
                displayName: props.displayName,
                mimeType: props.mimeType,
              },
            },
            { type: 'text', text: ' ' },
          ])
          .run()
        onPickFile(props.id)
      }
    }

    return [
      Suggestion<MentionMenuItem, MentionMenuItem>({
        editor,
        pluginKey,
        char: '@',
        allowSpaces: false,
        allowedPrefixes: [' ', '\n'],
        shouldShow: ({ editor: ed }) => ed.isEditable,
        command: ({ editor: ed, range, props }) => {
          runInsert(ed, range, props)
        },
        items: async ({ query }) => await fetchMentionItems(query),
        render: () => {
          let root: HTMLDivElement | null = null
          let selectedPickIndex = 0
          let current: SuggestionProps<MentionMenuItem> | null = null

          function positionMenu() {
            if (!root || !current?.clientRect)
              return
            const rect = current.clientRect()
            if (!rect)
              return
            root.style.position = 'fixed'
            root.style.left = `${Math.round(rect.left)}px`
            root.style.top = `${Math.round(rect.bottom + 8)}px`
            root.style.minWidth = '260px'
            root.style.maxHeight = 'min(320px, 60vh)'
            root.style.overflowY = 'auto'
            root.style.zIndex = '200'
          }

          function pickables(rows: MenuRow[]): MentionMenuItem[] {
            return rows.filter((r): r is Extract<MenuRow, { kind: 'item' }> => r.kind === 'item').map(r => r.item)
          }

          function renderButtons(next: SuggestionProps<MentionMenuItem>) {
            current = next
            if (!root)
              return
            root.replaceChildren()
            const rows = itemsToRows(next.items)
            const picks = pickables(rows)
            if (picks.length === 0 || rows.length === 0) {
              root.classList.add('hidden')
              return
            }
            root.classList.remove('hidden')
            if (selectedPickIndex >= picks.length)
              selectedPickIndex = 0

            let pickCursor = -1
            for (const row of rows) {
              if (row.kind === 'header') {
                const h = document.createElement('div')
                h.textContent = row.label
                h.className
                  = 'sticky top-0 z-[1] border-b border-zinc-100/90 bg-white/98 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 backdrop-blur-sm'
                root.appendChild(h)
              }
              else {
                pickCursor += 1
                const btn = document.createElement('button')
                btn.type = 'button'
                const item = row.item
                const label = item.kind === 'contact'
                  ? (item.displayName || 'Contact')
                  : (item.displayName || 'File')
                btn.textContent = label
                const isSel = pickCursor === selectedPickIndex
                btn.className = [
                  'flex w-full rounded-[var(--ui-control-radius)] px-3 py-2.5 text-left text-[13px] font-medium tracking-tight transition-colors',
                  isSel ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-50',
                  item.kind === 'file' && !isSel ? 'text-emerald-900' : '',
                ].join(' ')
                btn.addEventListener('mousedown', (e) => {
                  e.preventDefault()
                  next.command(item)
                })
                root.appendChild(btn)
              }
            }
            positionMenu()
          }

          return {
            onStart: (props) => {
              selectedPickIndex = 0
              root = document.createElement('div')
              root.className
                = 'at-mention-menu rounded-[var(--ui-panel-radius)] border border-zinc-200/90 bg-white/95 py-1.5 backdrop-blur-xl ring-1 ring-zinc-950/[0.04]'
              document.body.appendChild(root)
              renderButtons(props)
            },
            onUpdate: (props) => {
              selectedPickIndex = 0
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
              const picks = pickables(itemsToRows(current.items))
              if (picks.length === 0)
                return false
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                selectedPickIndex = (selectedPickIndex + 1) % picks.length
                renderButtons(current)
                return true
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                selectedPickIndex = (selectedPickIndex + picks.length - 1) % picks.length
                renderButtons(current)
                return true
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                const item = picks[selectedPickIndex]
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
