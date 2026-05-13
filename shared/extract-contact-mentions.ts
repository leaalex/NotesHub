/** Tiptap / ProseMirror JSON node with optional attrs and content. */
type JsonDoc = Record<string, unknown>

const MENTION_TYPE = 'contactMention'

/**
 * Traverse Tiptap doc JSON and collect unique contact ids mentioned via `contactMention` nodes.
 */
export function extractContactMentionIdsFromTiptapJson(rawJson: string): string[] {
  const seen = new Set<string>()
  let root: JsonDoc | null = null
  try {
    const parsed = JSON.parse(rawJson || '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      root = parsed as JsonDoc
  }
  catch {
    return []
  }
  if (!root || root.type !== 'doc')
    return []

  function visit(node: unknown) {
    if (!node || typeof node !== 'object' || Array.isArray(node))
      return
    const n = node as JsonDoc
    if (n.type === MENTION_TYPE) {
      const attrs = n.attrs as Record<string, unknown> | undefined
      const id = attrs?.contactId
      if (typeof id === 'string' && id.length > 0)
        seen.add(id)
    }
    const content = n.content
    if (Array.isArray(content))
      content.forEach(visit)
  }

  visit(root)
  return [...seen]
}
