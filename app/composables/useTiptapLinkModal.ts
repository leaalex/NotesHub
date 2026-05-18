import type { Editor } from '@tiptap/core'
import { ref } from 'vue'

const open = ref(false)
const urlDraft = ref('')
let resolver: ((value: string | null) => void) | null = null

export function useTiptapLinkModal() {
  function requestUrl(ed: Editor): Promise<string | null> {
    if (resolver) {
      resolver(null)
      resolver = null
    }
    const prev = ed.getAttributes('link').href as string | undefined
    urlDraft.value = (prev?.trim() || 'https://')
    open.value = true
    return new Promise<string | null>((resolve) => {
      resolver = resolve
    })
  }

  function confirm() {
    const r = resolver
    resolver = null
    open.value = false
    const v = urlDraft.value.trim()
    r?.(v)
  }

  function cancel() {
    const r = resolver
    resolver = null
    open.value = false
    r?.(null)
  }

  async function runLinkFlow(ed: Editor) {
    const url = await requestUrl(ed)
    if (url === null)
      return
    const chain = ed.chain().focus().extendMarkRange('link')
    if (url === '')
      chain.unsetLink().run()
    else
      chain.setLink({ href: url }).run()
  }

  return {
    open,
    urlDraft,
    confirm,
    cancel,
    requestUrl,
    runLinkFlow,
  }
}
