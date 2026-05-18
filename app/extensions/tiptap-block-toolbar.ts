import type { Editor } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

type BlockRange = { from: number; to: number }

function listTopLevelBlocks(doc: PMNode): BlockRange[] {
  const blocks: BlockRange[] = []
  doc.descendants((node, pos, parent) => {
    if (parent === doc)
      blocks.push({ from: pos, to: pos + node.nodeSize })
  })
  return blocks.sort((a, b) => a.from - b.from)
}

function topLevelBlockNear(doc: PMNode, pos: number): BlockRange | null {
  const safePos = Math.max(0, Math.min(pos, doc.content.size))
  const $pos = doc.resolve(safePos)

  // Boundary position between top-level blocks: depth === 0.
  // posAtCoords returns such positions when the cursor is in the CSS margin
  // gap between paragraphs. Grab the nearest neighbour instead of returning null.
  if ($pos.depth === 0) {
    const before = $pos.nodeBefore
    const after = $pos.nodeAfter
    if (before)
      return { from: safePos - before.nodeSize, to: safePos }
    if (after)
      return { from: safePos, to: safePos + after.nodeSize }
    return null
  }

  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d - 1).type.name === 'doc')
      return { from: $pos.before(d), to: $pos.after(d) }
  }
  return null
}

function blockDomRect(view: EditorView, block: BlockRange): DOMRect | null {
  try {
    const n = view.nodeDOM(block.from)
    const el = (n instanceof HTMLElement ? n : n?.parentElement) ?? null
    return el?.getBoundingClientRect() ?? null
  }
  catch {
    return null
  }
}

/** Gap position before node `blocks[i]`; last gap after doc uses `blocks.at(-1).to`. */
function pickDropInsertBefore(view: EditorView, clientY: number): number | null {
  const blocks = listTopLevelBlocks(view.state.doc)
  if (blocks.length === 0)
    return null

  for (let i = 0; i < blocks.length; i++) {
    const rect = blockDomRect(view, blocks[i])
    if (!rect)
      continue
    const mid = rect.top + rect.height / 2
    if (clientY < mid)
      return blocks[i].from
  }

  return blocks[blocks.length - 1].to
}

function indicatorAtInsert(view: EditorView, insertBefore: number): { left: number; top: number; width: number } | null {
  const wrap = view.dom.getBoundingClientRect()
  const pad = 12
  const blocks = listTopLevelBlocks(view.state.doc)

  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].from === insertBefore) {
      const r = blockDomRect(view, blocks[i])
      if (!r)
        return null
      return { left: wrap.left + pad, top: r.top, width: Math.max(80, wrap.width - pad * 2) }
    }
  }
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].to === insertBefore) {
      const r = blockDomRect(view, blocks[i])
      if (!r)
        return null
      return { left: wrap.left + pad, top: r.bottom, width: Math.max(80, wrap.width - pad * 2) }
    }
  }

  return null
}

function moveTopLevelBlock(state: EditorState, src: BlockRange, insertBefore: number): Transaction | null {
  const doc = state.doc
  const slice = doc.slice(src.from, src.to)

  if (insertBefore > src.from && insertBefore < src.to)
    return null

  let tr = state.tr.delete(src.from, src.to)
  const mapped = tr.mapping.map(insertBefore)
  tr = tr.insert(mapped, slice.content)
  return tr
}

function focusInsideBlock(editor: Editor, block: BlockRange) {
  const pos = Math.min(block.from + 1, block.to - 1)
  editor.chain().focus().setTextSelection(pos).run()
}

type StyleKind =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'ordered'
  | 'task'
  | 'quote'
  | 'code'

function applyStyle(editor: Editor, block: BlockRange, kind: StyleKind) {
  focusInsideBlock(editor, block)
  const chain = editor.chain().focus()

  switch (kind) {
    case 'paragraph':
      chain.setParagraph().run()
      break
    case 'h1':
      chain.setHeading({ level: 1 }).run()
      break
    case 'h2':
      chain.setHeading({ level: 2 }).run()
      break
    case 'h3':
      chain.setHeading({ level: 3 }).run()
      break
    case 'bullet':
      chain.toggleBulletList().run()
      break
    case 'ordered':
      chain.toggleOrderedList().run()
      break
    case 'task':
      chain.toggleTaskList().run()
      break
    case 'quote':
      chain.toggleBlockquote().run()
      break
    case 'code':
      chain.toggleCodeBlock().run()
      break
  }
}

const STYLE_SVG_WRAPPER
  = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'

const STYLE_ITEMS: { kind: StyleKind; label: string; icon: string }[] = [
  {
    kind: 'paragraph',
    label: 'Text',
    icon: '<span class="text-[13px] font-semibold leading-none select-none" aria-hidden="true">¶</span>',
  },
  {
    kind: 'h1',
    label: 'Heading 1',
    icon: '<span class="text-[9px] font-bold leading-none tracking-tight select-none" aria-hidden="true">H1</span>',
  },
  {
    kind: 'h2',
    label: 'Heading 2',
    icon: '<span class="text-[9px] font-bold leading-none tracking-tight select-none" aria-hidden="true">H2</span>',
  },
  {
    kind: 'h3',
    label: 'Heading 3',
    icon: '<span class="text-[9px] font-bold leading-none tracking-tight select-none" aria-hidden="true">H3</span>',
  },
  {
    kind: 'bullet',
    label: 'Bullet list',
    icon: `${STYLE_SVG_WRAPPER}<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
  },
  {
    kind: 'ordered',
    label: 'Numbered list',
    icon: `${STYLE_SVG_WRAPPER}<line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M4 14h2"/><path d="M4 18h4"/></svg>`,
  },
  {
    kind: 'task',
    label: 'Task list',
    icon: `${STYLE_SVG_WRAPPER}<rect x="3" y="5" width="6" height="6" rx="1"/><path d="m5 8 2 2 3-3"/><line x1="11" x2="21" y1="8" y2="8"/><line x1="11" x2="21" y1="12" y2="12"/><line x1="11" x2="21" y1="16" y2="16"/></svg>`,
  },
  {
    kind: 'quote',
    label: 'Quote',
    icon: `${STYLE_SVG_WRAPPER}<path d="M7 7H5a2 2 0 0 0-2 2v6h4V9h2"/><path d="M17 7h-2a2 2 0 0 0-2 2v6h4V9h2"/></svg>`,
  },
  {
    kind: 'code',
    label: 'Code block',
    icon: `${STYLE_SVG_WRAPPER}<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  },
]

export const BlockToolbar = Extension.create({
  name: 'blockToolbar',

  addProseMirrorPlugins() {
    const editor = this.editor
    const pluginKey = new PluginKey('blockToolbar')

    return [
      new Plugin({
        key: pluginKey,
        view(pmView: EditorView) {
          // ── DOM structure ──────────────────────────────────────────────────
          const root = document.createElement('div')
          root.className
            = 'note-block-toolbar pointer-events-none fixed z-[190] flex flex-col gap-1 opacity-0 transition-opacity duration-150'
          root.style.display = 'none'

          const pill = document.createElement('div')
          pill.className
            = 'pointer-events-auto flex items-center gap-px rounded-[var(--ui-control-radius)] border border-zinc-200/90 bg-white/95 px-0.5 py-px backdrop-blur-xl ring-1 ring-zinc-950/[0.04]'

          const grip = document.createElement('button')
          grip.type = 'button'
          grip.title = 'Drag to move block'
          grip.className
            = 'flex size-6 shrink-0 cursor-grab items-center justify-center rounded-[var(--ui-control-radius)] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:cursor-grabbing'
          grip.innerHTML = '<span class="text-[11px] leading-none tracking-tighter select-none">⋮⋮</span>'

          const menuBtn = document.createElement('button')
          menuBtn.type = 'button'
          menuBtn.title = 'Turn into…'
          menuBtn.className
            = 'flex size-6 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
          menuBtn.innerHTML = '<span class="text-[13px] font-semibold leading-none">+</span>'

          pill.appendChild(grip)
          pill.appendChild(menuBtn)

          // hoverRow contains only pill — no DOM bridge
          const hoverRow = document.createElement('div')
          hoverRow.className = 'flex flex-row items-center pointer-events-none'
          hoverRow.appendChild(pill)
          root.appendChild(hoverRow)

          const menu = document.createElement('div')
          menu.className
            = 'pointer-events-auto hidden flex flex-row items-center gap-px rounded-[var(--ui-control-radius)] border border-zinc-200/90 bg-white p-0.5 ring-1 ring-zinc-950/[0.04]'
          root.appendChild(menu)

          document.body.appendChild(root)

          // ── State ──────────────────────────────────────────────────────────
          let menuOpen = false
          let menuOpenBySelection = false
          // Anchor rect for the virtual corridor between menu and its origin
          let menuAnchorRect: DOMRect | null = null
          let hoverBlock: BlockRange | null = null
          let raf = 0
          let hideTimer: ReturnType<typeof setTimeout> | undefined
          let lastX = 0
          let lastY = 0

          let dragActive = false
          let dragSrc: BlockRange | null = null
          let indicator: HTMLDivElement | null = null

          // ── Indicator (drag line) ──────────────────────────────────────────
          function hideIndicator() {
            indicator?.remove()
            indicator = null
          }

          function ensureIndicator(): HTMLDivElement {
            if (!indicator) {
              indicator = document.createElement('div')
              indicator.className = 'pointer-events-none fixed z-[185] h-0.5 rounded-[var(--ui-control-radius)] bg-zinc-900/75'
              document.body.appendChild(indicator)
            }
            return indicator
          }

          // ── Menu helpers ───────────────────────────────────────────────────
          function closeMenu() {
            menuOpen = false
            menuOpenBySelection = false
            menuAnchorRect = null
            menu.classList.add('hidden')
            menu.replaceChildren()
          }

          /**
           * Build a synthetic DOMRect spanning the current text selection,
           * used as the anchor for the virtual corridor.
           */
          function computeSelectionAnchorRect(): DOMRect {
            const sel = pmView.state.selection
            const start = pmView.coordsAtPos(sel.from)
            const end = pmView.coordsAtPos(sel.to)
            const pad = 4
            const left = Math.min(start.left, end.left) - pad
            const top = Math.min(start.top, end.top)
            const right = Math.max(start.right, end.right) + pad
            const bottom = Math.max(start.bottom, end.bottom)
            return new DOMRect(left, top, right - left, bottom - top)
          }

          function positionMenuOverSelection() {
            const sel = pmView.state.selection
            if (sel.empty)
              return

            menu.style.position = 'fixed'
            menu.style.zIndex = '200'

            const pad = 8
            const offsetAbove = 8

            function place() {
              const s = pmView.state.selection
              if (s.empty)
                return
              const start = pmView.coordsAtPos(s.from)
              const end = pmView.coordsAtPos(s.to)
              const m = menu.getBoundingClientRect()
              const midX = (start.left + end.left) / 2
              let left = Math.round(midX - m.width / 2)
              left = Math.max(pad, Math.min(left, window.innerWidth - pad - m.width))
              const topEdge = Math.min(start.top, end.top)
              const bottomEdge = Math.max(start.bottom, end.bottom)
              let top = Math.round(topEdge - m.height - offsetAbove)
              if (top < pad)
                top = Math.round(bottomEdge + offsetAbove)

              menu.style.left = `${left}px`
              menu.style.top = `${top}px`

              // Keep anchor rect in sync so the corridor is always accurate
              menuAnchorRect = computeSelectionAnchorRect()
            }

            place()
            requestAnimationFrame(place)
          }

          function positionMenuNearToolbar() {
            if (menuOpenBySelection) {
              positionMenuOverSelection()
              return
            }

            const pillRect = pill.getBoundingClientRect()
            menuAnchorRect = pillRect // corridor target is the pill itself
            const pad = 8
            menu.style.position = 'fixed'
            menu.style.zIndex = '200'
            menu.style.left = `${Math.round(pillRect.left)}px`
            menu.style.top = `${Math.round(pillRect.bottom + 4)}px`

            requestAnimationFrame(() => {
              const m = menu.getBoundingClientRect()
              if (m.right > window.innerWidth - pad) {
                menu.style.left = `${Math.round(Math.max(pad, window.innerWidth - pad - m.width))}px`
              }
              if (m.bottom > window.innerHeight - pad) {
                menu.style.top = `${Math.round(pillRect.top - m.height - 4)}px`
              }
            })
          }

          function openMenu(block: BlockRange) {
            menuOpen = true
            menu.classList.remove('hidden')
            menu.replaceChildren()
            STYLE_ITEMS.forEach(item => {
              const btn = document.createElement('button')
              btn.type = 'button'
              btn.title = item.label
              btn.setAttribute('aria-label', item.label)
              btn.innerHTML = item.icon
              btn.className
                = 'flex size-7 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              btn.addEventListener('mousedown', e => {
                e.preventDefault()
                applyStyle(editor, block, item.kind)
                closeMenu()
              })
              menu.appendChild(btn)
            })
            // Set initial anchor before positioning so the corridor is ready
            menuAnchorRect = menuOpenBySelection
              ? computeSelectionAnchorRect()
              : pill.getBoundingClientRect()
            positionMenuNearToolbar()
          }

          function hideToolbar() {
            root.style.opacity = '0'
            root.style.display = 'none'
            hoverBlock = null
            closeMenu()
          }

          // ── Virtual hit-test (three separate functions) ────────────────────
          /**
           * ACTIVATION — works even when toolbar is hidden.
           * Editor area extended 60px left to cover the pill's position.
           */
          function isPointerOverEditorArea(x: number, y: number): boolean {
            const r = pmView.dom.getBoundingClientRect()
            return x >= r.left - 60 && x <= r.right && y >= r.top && y <= r.bottom
          }

          /**
           * RETENTION for pill — only meaningful when pill is visible.
           * Covers the pill rect and a virtual corridor connecting pill to block.
           */
          function isPointerInVisibleToolbar(x: number, y: number): boolean {
            if (root.style.display === 'none')
              return false

            const p = pill.getBoundingClientRect()
            if (x >= p.left && x <= p.right && y >= p.top && y <= p.bottom)
              return true

            // Virtual corridor: pill ↔ current block
            if (hoverBlock) {
              const br = blockDomRect(pmView, hoverBlock)
              if (br) {
                const cy1 = Math.min(p.top, br.top)
                const cy2 = Math.max(p.bottom, br.bottom)
                if (x >= p.right && x <= br.left + 4 && y >= cy1 && y <= cy2)
                  return true
              }
            }
            return false
          }

          /**
           * RETENTION for menu — only meaningful when menu is open.
           * Covers the menu rect and a virtual corridor to the anchor (selection or pill).
           */
          function isPointerInOpenMenu(x: number, y: number): boolean {
            if (!menuOpen || menu.classList.contains('hidden'))
              return false

            const m = menu.getBoundingClientRect()
            if (x >= m.left && x <= m.right && y >= m.top && y <= m.bottom)
              return true

            if (menuAnchorRect) {
              const a = menuAnchorRect
              const minX = Math.min(m.left, a.left) - 4
              const maxX = Math.max(m.right, a.right) + 4
              const minY = Math.min(m.bottom, a.top)
              const maxY = Math.max(m.top, a.bottom)
              if (x >= minX && x <= maxX && y >= minY && y <= maxY)
                return true
            }
            return false
          }

          // ── Hide scheduling ────────────────────────────────────────────────
          function scheduleHideToolbar() {
            clearTimeout(hideTimer)
            hideTimer = setTimeout(() => {
              if (dragActive || menuOpen || !editor.state.selection.empty)
                return
              if (isPointerOverEditorArea(lastX, lastY))
                return
              if (isPointerInVisibleToolbar(lastX, lastY))
                return
              if (isPointerInOpenMenu(lastX, lastY))
                return
              hideToolbar()
            }, 160)
          }

          function cancelHideToolbar() {
            clearTimeout(hideTimer)
          }

          // ── Layout ────────────────────────────────────────────────────────
          function layoutToolbarHud(blockRect: DOMRect) {
            const gapPx = 6
            const pillW = pill.offsetWidth || 48
            const pillH = pill.offsetHeight || 28
            const rootLeft = Math.round(Math.max(4, blockRect.left - pillW - gapPx))
            const rootTop = Math.round(Math.max(4, blockRect.top + blockRect.height / 2 - pillH / 2))
            root.style.left = `${rootLeft}px`
            root.style.top = `${rootTop}px`

            if (menuOpen)
              positionMenuNearToolbar()
          }

          function positionToolbar(block: BlockRange) {
            const rect = blockDomRect(pmView, block)
            if (!rect)
              return
            root.style.display = 'flex'
            root.style.opacity = '1'
            root.style.position = 'fixed'

            layoutToolbarHud(rect)
            requestAnimationFrame(() => layoutToolbarHud(rect))
          }

          function scheduleSync(selPos: number) {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => {
              if (!editor.isEditable || editor.isDestroyed) {
                // Never kill an open menu when editability changes
                if (!menuOpen)
                  hideToolbar()
                return
              }

              const block = topLevelBlockNear(pmView.state.doc, selPos)
              if (!block) {
                // Boundary position with no neighbours (empty doc).
                // Never close an open menu or discard an active selection.
                if (!menuOpen && editor.state.selection.empty)
                  hideToolbar()
                return
              }

              hoverBlock = block
              positionToolbar(block)
              if (menuOpen)
                positionMenuNearToolbar()
            })
          }

          // ── Single unified mouse-move handler ─────────────────────────────
          /**
           * Replaces:
           *   - pmView.dom mousemove (onMouseMove)
           *   - pmView.dom mouseleave (onMouseLeave)
           *   - document mousemove for global pointer tracking (onGlobalPointerMove)
           *   - root mouseenter / mouseleave
           *
           * One handler, one source of truth.
           */
          function onDocMouseMove(e: MouseEvent) {
            if (dragActive)
              return

            lastX = e.clientX
            lastY = e.clientY

            // Activation: cursor over editor area — always update pill position,
            // even when toolbar is currently hidden.
            if (isPointerOverEditorArea(e.clientX, e.clientY)) {
              cancelHideToolbar()
              const coords = pmView.posAtCoords({ left: e.clientX, top: e.clientY })
              if (coords)
                scheduleSync(coords.pos)
              return
            }

            // Retention: cursor is over visible pill, its corridor, or open menu.
            if (isPointerInVisibleToolbar(e.clientX, e.clientY)
              || isPointerInOpenMenu(e.clientX, e.clientY)) {
              cancelHideToolbar()
              return
            }

            scheduleHideToolbar()
          }

          // ── Drag handlers ─────────────────────────────────────────────────
          function onDragMouseMove(e: MouseEvent) {
            if (!dragActive)
              return
            const insertBefore = pickDropInsertBefore(pmView, e.clientY)
            if (insertBefore === null) {
              hideIndicator()
              return
            }
            const line = indicatorAtInsert(pmView, insertBefore)
            if (!line) {
              hideIndicator()
              return
            }
            const bar = ensureIndicator()
            bar.style.left = `${Math.round(line.left)}px`
            bar.style.top = `${Math.round(line.top)}px`
            bar.style.width = `${Math.round(line.width)}px`
          }

          function onDragMouseUp(e: MouseEvent) {
            if (!dragActive || !dragSrc) {
              dragActive = false
              dragSrc = null
              hideIndicator()
              return
            }

            dragActive = false
            grip.style.cursor = 'grab'
            document.removeEventListener('mousemove', onDragMouseMove)
            document.removeEventListener('mouseup', onDragMouseUp)
            hideIndicator()

            const insertBefore = pickDropInsertBefore(pmView, e.clientY)
            const src = dragSrc
            dragSrc = null

            if (insertBefore === null || !editor.isEditable || editor.isDestroyed)
              return

            const tr = moveTopLevelBlock(editor.state, src, insertBefore)
            if (tr)
              pmView.dispatch(tr)

            editor.chain().focus().run()
          }

          function onGripMouseDown(e: MouseEvent) {
            if (!editor.isEditable || !hoverBlock)
              return
            e.preventDefault()
            e.stopPropagation()
            dragActive = true
            dragSrc = hoverBlock
            grip.style.cursor = 'grabbing'
            closeMenu()
            document.addEventListener('mousemove', onDragMouseMove)
            document.addEventListener('mouseup', onDragMouseUp)
          }

          grip.addEventListener('mousedown', onGripMouseDown)

          menuBtn.addEventListener('mousedown', e => {
            e.preventDefault()
            e.stopPropagation()
            if (!editor.isEditable || !hoverBlock)
              return
            if (menuOpen)
              closeMenu()
            else {
              menuOpenBySelection = false
              openMenu(hoverBlock)
            }
          })

          // Close plus-menu on outside click (bubble-menu closes via update())
          function onDocMouseDown(ev: MouseEvent) {
            if (!menuOpen)
              return
            if (menuOpenBySelection)
              return
            const t = ev.target as Node
            if (!menu.contains(t) && !menuBtn.contains(t))
              closeMenu()
          }

          // ── Register listeners ─────────────────────────────────────────────
          document.addEventListener('mousedown', onDocMouseDown)
          // Single unified move handler — no pmView.dom listeners for hover
          document.addEventListener('mousemove', onDocMouseMove, { passive: true })

          scheduleSync(pmView.state.selection.from)

          return {
            update(currentView, prevState) {
              if (!editor.isEditable) {
                hideToolbar()
                return
              }
              const selFrom = currentView.state.selection.from
              const selChanged
                = selFrom !== prevState.selection.from
                  || currentView.state.selection.to !== prevState.selection.to
              const docChanged = currentView.state.doc !== prevState.doc
              if (selChanged || docChanged)
                scheduleSync(selFrom)

              const sel = currentView.state.selection
              if (!sel.empty) {
                const block = topLevelBlockNear(currentView.state.doc, sel.from)
                if (block) {
                  if (!menuOpen) {
                    menuOpenBySelection = true
                    openMenu(block)
                  }
                  else if (menuOpenBySelection) {
                    requestAnimationFrame(() => positionMenuOverSelection())
                  }
                }
              }
              else if (menuOpenBySelection) {
                closeMenu() // also resets menuAnchorRect
              }
            },
            destroy() {
              cancelAnimationFrame(raf)
              clearTimeout(hideTimer)
              document.removeEventListener('mousedown', onDocMouseDown)
              document.removeEventListener('mousemove', onDocMouseMove)
              document.removeEventListener('mousemove', onDragMouseMove)
              document.removeEventListener('mouseup', onDragMouseUp)
              hideIndicator()
              root.remove()
            },
          }
        },
      }),
    ]
  },
})
