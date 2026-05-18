/** Share info for a file or contact row (public share page URLs). */
export type ShareMentionEntityInfo = {
  shareEnabled: boolean
  shareToken: string | null
}

export type ShareMentionLookup = {
  files: Map<string, ShareMentionEntityInfo>
  contacts: Map<string, ShareMentionEntityInfo>
}

type JsonDoc = Record<string, unknown>

const FILE_MENTION = 'fileMention'
const CONTACT_MENTION = 'contactMention'

function visitContentNodes(root: JsonDoc, fn: (node: JsonDoc) => void) {
  function visit(node: unknown) {
    if (!node || typeof node !== 'object' || Array.isArray(node))
      return
    const n = node as JsonDoc
    fn(n)
    const content = n.content
    if (Array.isArray(content))
      content.forEach(visit)
  }
  visit(root)
}

/**
 * Collect unique file/contact ids from Tiptap doc JSON (mentions only).
 */
export function extractMentionIdsFromTiptapJson(rawJson: string): {
  fileIds: string[]
  contactIds: string[]
} {
  const fileIds = new Set<string>()
  const contactIds = new Set<string>()
  let root: JsonDoc | null = null
  try {
    const parsed = JSON.parse(rawJson || '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      root = parsed as JsonDoc
  }
  catch {
    return { fileIds: [], contactIds: [] }
  }
  if (!root || root.type !== 'doc')
    return { fileIds: [], contactIds: [] }

  visitContentNodes(root, (n) => {
    if (n.type === FILE_MENTION) {
      const attrs = n.attrs as Record<string, unknown> | undefined
      const id = attrs?.fileId
      if (typeof id === 'string' && id.length > 0)
        fileIds.add(id)
    }
    else if (n.type === CONTACT_MENTION) {
      const attrs = n.attrs as Record<string, unknown> | undefined
      const id = attrs?.contactId
      if (typeof id === 'string' && id.length > 0)
        contactIds.add(id)
    }
  })

  return { fileIds: [...fileIds], contactIds: [...contactIds] }
}

function encodePublicUrlPart(token: string) {
  return encodeURIComponent(token)
}

/**
 * Mutates a deep-cloned doc: sets attrs.href on fileMention/contactMention for public share view.
 * - When mentionLinksAllowed is false: all such hrefs become '' (editor renders non-link chip).
 * - When true: href is `${baseUrl}/share/file|contact/${token}` if entity is shared, else ''.
 */
export function rewriteShareMentionHrefs(
  rawJson: string,
  opts: {
    baseUrl: string
    mentionLinksAllowed: boolean
    lookup: ShareMentionLookup
  },
): string {
  const base = opts.baseUrl.replace(/\/$/, '')

  let root: JsonDoc | null = null
  try {
    const parsed = JSON.parse(rawJson || '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      root = JSON.parse(JSON.stringify(parsed)) as JsonDoc
  }
  catch {
    return rawJson
  }
  if (!root || root.type !== 'doc')
    return rawJson

  visitContentNodes(root, (n) => {
    if (n.type === FILE_MENTION) {
      const attrs = (typeof n.attrs === 'object' && n.attrs && !Array.isArray(n.attrs)
        ? { ...(n.attrs as Record<string, unknown>) }
        : {}) as Record<string, unknown>
      const fid = attrs.fileId
      if (!opts.mentionLinksAllowed || typeof fid !== 'string' || fid.length === 0) {
        attrs.href = ''
        n.attrs = attrs
        return
      }
      const info = opts.lookup.files.get(fid)
      if (info?.shareEnabled && info.shareToken) {
        attrs.href = `${base}/share/file/${encodePublicUrlPart(info.shareToken)}`
      }
      else {
        attrs.href = ''
      }
      n.attrs = attrs
    }
    else if (n.type === CONTACT_MENTION) {
      const attrs = (typeof n.attrs === 'object' && n.attrs && !Array.isArray(n.attrs)
        ? { ...(n.attrs as Record<string, unknown>) }
        : {}) as Record<string, unknown>
      const cid = attrs.contactId
      if (!opts.mentionLinksAllowed || typeof cid !== 'string' || cid.length === 0) {
        attrs.href = ''
        n.attrs = attrs
        return
      }
      const info = opts.lookup.contacts.get(cid)
      if (info?.shareEnabled && info.shareToken) {
        attrs.href = `${base}/share/contact/${encodePublicUrlPart(info.shareToken)}`
      }
      else {
        attrs.href = ''
      }
      n.attrs = attrs
    }
  })

  return JSON.stringify(root)
}
