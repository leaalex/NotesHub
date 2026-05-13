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
  const $pos = doc.resolve(pos)
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

const STYLE_ITEMS: { kind: StyleKind; label: string }[] = [
  { kind: 'paragraph', label: 'Text' },
  { kind: 'h1', label: 'Heading 1' },
  { kind: 'h2', label: 'Heading 2' },
  { kind: 'h3', label: 'Heading 3' },
  { kind: 'bullet', label: 'Bullet list' },
  { kind: 'ordered', label: 'Numbered list' },
  { kind: 'task', label: 'Task list' },
  { kind: 'quote', label: 'Quote' },
  { kind: 'code', label: 'Code block' },
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
          const root = document.createElement('div')
          root.className
            = 'note-block-toolbar pointer-events-none fixed z-[190] flex flex-col gap-1 opacity-0 transition-opacity duration-150'
          root.style.display = 'none'

          const pill = document.createElement('div')
          pill.className
            = 'pointer-events-auto flex items-center gap-px rounded-full border border-zinc-200/90 bg-white/95 px-0.5 py-px shadow-[0_12px_36px_-20px_rgba(24,24,27,0.5)] backdrop-blur-xl ring-1 ring-zinc-950/[0.04]'

          const grip = document.createElement('button')
          grip.type = 'button'
          grip.title = 'Drag to move block'
          grip.className
            = 'flex size-6 shrink-0 cursor-grab items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:cursor-grabbing'
          grip.innerHTML = '<span class="text-[11px] leading-none tracking-tighter select-none">⋮⋮</span>'

          const menuBtn = document.createElement('button')
          menuBtn.type = 'button'
          menuBtn.title = 'Turn into…'
          menuBtn.className
            = 'flex size-6 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
          menuBtn.innerHTML = '<span class="text-[13px] font-semibold leading-none">+</span>'

          pill.appendChild(grip)
          pill.appendChild(menuBtn)
          root.appendChild(pill)

          const menu = document.createElement('div')
          menu.className
            = 'pointer-events-auto hidden min-w-[220px] rounded-2xl border border-zinc-200/90 bg-white/95 py-1.5 shadow-[0_22px_55px_-28px_rgba(24,24,27,0.55)] backdrop-blur-xl ring-1 ring-zinc-950/[0.04]'
          root.appendChild(menu)

          document.body.appendChild(root)

          let menuOpen = false
          let hoverBlock: BlockRange | null = null
          let raf = 0
          let hideTimer: ReturnType<typeof setTimeout> | undefined
          let pointerOverToolbar = false

          let dragActive = false
          let dragSrc: BlockRange | null = null
          let indicator: HTMLDivElement | null = null

          function hideIndicator() {
            indicator?.remove()
            indicator = null
          }

          function ensureIndicator(): HTMLDivElement {
            if (!indicator) {
              indicator = document.createElement('div')
              indicator.className = 'pointer-events-none fixed z-[185] h-0.5 rounded-full bg-zinc-900/75'
              document.body.appendChild(indicator)
            }
            return indicator
          }

          function closeMenu() {
            menuOpen = false
            menu.classList.add('hidden')
            menu.replaceChildren()
          }

          function positionMenuNearToolbar() {
            const rootRect = root.getBoundingClientRect()
            menu.style.position = 'fixed'
            menu.style.left = `${Math.round(rootRect.right + 8)}px`
            menu.style.top = `${Math.round(rootRect.top)}px`
            menu.style.zIndex = '200'
          }

          function openMenu(block: BlockRange) {
            menuOpen = true
            menu.classList.remove('hidden')
            menu.replaceChildren()
            STYLE_ITEMS.forEach(item => {
              const btn = document.createElement('button')
              btn.type = 'button'
              btn.textContent = item.label
              btn.className
                = 'flex w-full px-3 py-2 text-left text-[13px] font-medium tracking-tight text-zinc-700 hover:bg-zinc-50'
              btn.addEventListener('mousedown', e => {
                e.preventDefault()
                applyStyle(editor, block, item.kind)
                closeMenu()
              })
              menu.appendChild(btn)
            })
            positionMenuNearToolbar()
          }

          function hideToolbar() {
            root.style.opacity = '0'
            root.style.display = 'none'
            hoverBlock = null
            closeMenu()
          }

          function scheduleHideToolbar() {
            clearTimeout(hideTimer)
            hideTimer = setTimeout(() => {
              if (!pointerOverToolbar && !menuOpen && !dragActive)
                hideToolbar()
            }, 160)
          }

          function cancelHideToolbar() {
            clearTimeout(hideTimer)
          }

          function positionToolbar(block: BlockRange) {
            const rect = blockDomRect(pmView, block)
            if (!rect)
              return
            root.style.display = 'flex'
            root.style.opacity = '1'
            root.style.position = 'fixed'
            const gapPx = 10
            /** Prime layout so offsetWidth reflects compact pill size */
            root.style.left = `${Math.round(Math.max(4, rect.left - 72))}px`
            root.style.top = `${Math.round(rect.top)}px`

            requestAnimationFrame(() => {
              const tb = root.getBoundingClientRect()
              const left = rect.left - tb.width - gapPx
              const top = rect.top + rect.height / 2 - tb.height / 2
              root.style.left = `${Math.round(Math.max(4, left))}px`
              root.style.top = `${Math.round(Math.max(4, top))}px`
              if (menuOpen)
                positionMenuNearToolbar()
            })
          }

          function scheduleSync(selPos: number) {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => {
              if (!editor.isEditable || editor.isDestroyed) {
                hideToolbar()
                return
              }

              const block = topLevelBlockNear(pmView.state.doc, selPos)
              if (!block) {
                hideToolbar()
                return
              }

              hoverBlock = block
              positionToolbar(block)
              if (menuOpen)
                positionMenuNearToolbar()
            })
          }

          function onMouseMove(e: MouseEvent) {
            if (dragActive)
              return
            cancelHideToolbar()
            const coords = pmView.posAtCoords({ left: e.clientX, top: e.clientY })
            if (!coords) {
              if (!menuOpen && !pointerOverToolbar)
                scheduleHideToolbar()
              return
            }
            scheduleSync(coords.pos)
          }

          function onMouseLeave() {
            if (!dragActive && !menuOpen)
              scheduleHideToolbar()
          }

          root.addEventListener('mouseenter', () => {
            pointerOverToolbar = true
            cancelHideToolbar()
          })
          root.addEventListener('mouseleave', () => {
            pointerOverToolbar = false
            if (!menuOpen && !dragActive)
              scheduleHideToolbar()
          })

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
            else openMenu(hoverBlock)
          })

          function onDocMouseDown(ev: MouseEvent) {
            if (!menuOpen)
              return
            const t = ev.target as Node
            if (!menu.contains(t) && !menuBtn.contains(t))
              closeMenu()
          }

          document.addEventListener('mousedown', onDocMouseDown)
          pmView.dom.addEventListener('mousemove', onMouseMove)
          pmView.dom.addEventListener('mouseleave', onMouseLeave)

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
            },
            destroy() {
              cancelAnimationFrame(raf)
              clearTimeout(hideTimer)
              document.removeEventListener('mousedown', onDocMouseDown)
              document.removeEventListener('mousemove', onDragMouseMove)
              document.removeEventListener('mouseup', onDragMouseUp)
              pmView.dom.removeEventListener('mousemove', onMouseMove)
              pmView.dom.removeEventListener('mouseleave', onMouseLeave)
              hideIndicator()
              root.remove()
            },
          }
        },
      }),
    ]
  },
})
