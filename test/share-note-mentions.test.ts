import { describe, expect, it } from 'vitest'
import {
  extractMentionIdsFromTiptapJson,
  rewriteShareMentionHrefs,
  type ShareMentionLookup,
} from '../shared/rewrite-share-mention-hrefs'

const BASE = 'http://localhost:3000'

function docWithMentions() {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'fileMention',
            attrs: {
              fileId: 'file-1',
              displayName: 'Doc',
              mimeType: 'application/pdf',
            },
          },
          {
            type: 'contactMention',
            attrs: {
              contactId: 'c-1',
              displayName: 'Ada',
              type: 'person',
            },
          },
        ],
      },
    ],
  })
}

describe('extractMentionIdsFromTiptapJson', () => {
  it('collects file and contact ids', () => {
    const raw = docWithMentions()
    const { fileIds, contactIds } = extractMentionIdsFromTiptapJson(raw)
    expect(fileIds.sort()).toEqual(['file-1'])
    expect(contactIds.sort()).toEqual(['c-1'])
  })

  it('returns empty for invalid json', () => {
    expect(extractMentionIdsFromTiptapJson('not json')).toEqual({ fileIds: [], contactIds: [] })
  })
})

describe('rewriteShareMentionHrefs', () => {
  it('sets public share href when entity is shared', () => {
    const raw = docWithMentions()
    const lookup: ShareMentionLookup = {
      files: new Map([['file-1', { shareEnabled: true, shareToken: 'tok-f' }]]),
      contacts: new Map([['c-1', { shareEnabled: true, shareToken: 'tok-c' }]]),
    }
    const out = rewriteShareMentionHrefs(raw, {
      baseUrl: BASE,
      mentionLinksAllowed: true,
      lookup,
    })
    const doc = JSON.parse(out) as { content?: Array<{ content?: Array<{ attrs?: { href?: string } }> }> }
    const inline = doc.content?.[0]?.content ?? []
    const fileNode = inline.find((n: { type?: string }) => (n as { type?: string }).type === 'fileMention') as { attrs?: { href?: string } }
    const contactNode = inline.find((n: { type?: string }) => (n as { type?: string }).type === 'contactMention') as { attrs?: { href?: string } }
    expect(fileNode.attrs?.href).toBe(`${BASE}/share/file/tok-f`)
    expect(contactNode.attrs?.href).toBe(`${BASE}/share/contact/tok-c`)
  })

  it('clears href when share is off for entity', () => {
    const raw = docWithMentions()
    const lookup: ShareMentionLookup = {
      files: new Map([['file-1', { shareEnabled: false, shareToken: 'x' }]]),
      contacts: new Map([['c-1', { shareEnabled: true, shareToken: null }]]),
    }
    const out = rewriteShareMentionHrefs(raw, {
      baseUrl: BASE,
      mentionLinksAllowed: true,
      lookup,
    })
    const doc = JSON.parse(out) as { content?: Array<{ content?: Array<{ type?: string, attrs?: { href?: string } }> }> }
    const inline = doc.content?.[0]?.content ?? []
    for (const n of inline) {
      expect(n.attrs?.href).toBe('')
    }
  })

  it('clears all mention hrefs when mentionLinksAllowed is false', () => {
    const raw = docWithMentions()
    const lookup: ShareMentionLookup = {
      files: new Map([['file-1', { shareEnabled: true, shareToken: 'tok-f' }]]),
      contacts: new Map([['c-1', { shareEnabled: true, shareToken: 'tok-c' }]]),
    }
    const out = rewriteShareMentionHrefs(raw, {
      baseUrl: BASE,
      mentionLinksAllowed: false,
      lookup,
    })
    const doc = JSON.parse(out) as { content?: Array<{ content?: Array<{ attrs?: { href?: string } }> }> }
    const inline = doc.content?.[0]?.content ?? []
    for (const n of inline)
      expect(n.attrs?.href).toBe('')
  })

  it('strips trailing slash from baseUrl', () => {
    const raw = docWithMentions()
    const lookup: ShareMentionLookup = {
      files: new Map([['file-1', { shareEnabled: true, shareToken: 't' }]]),
      contacts: new Map(),
    }
    const out = rewriteShareMentionHrefs(raw, {
      baseUrl: `${BASE}/`,
      mentionLinksAllowed: true,
      lookup,
    })
    expect(out).toContain(`${BASE}/share/file/t`)
    expect(out).not.toContain(`${BASE}//share`)
  })
})
