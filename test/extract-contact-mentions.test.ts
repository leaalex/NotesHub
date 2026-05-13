import { describe, expect, it } from 'vitest'
import { extractContactMentionIdsFromTiptapJson } from '../shared/extract-contact-mentions'

describe('extractContactMentionIdsFromTiptapJson', () => {
  it('returns empty array for invalid json', () => {
    expect(extractContactMentionIdsFromTiptapJson('')).toEqual([])
    expect(extractContactMentionIdsFromTiptapJson('not-json')).toEqual([])
  })

  it('extracts attrs.contactId from contactMention nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hi ' },
            {
              type: 'contactMention',
              attrs: {
                contactId: 'aaa',
                displayName: 'Ada',
                type: 'person',
              },
            },
            { type: 'text', text: ' and ' },
            {
              type: 'contactMention',
              attrs: {
                contactId: 'bbb',
                displayName: 'Org',
                type: 'organization',
              },
            },
          ],
        },
      ],
    }
    expect(extractContactMentionIdsFromTiptapJson(JSON.stringify(doc))).toEqual([
      'aaa',
      'bbb',
    ])
  })

  it('deduplicates repeated mentions', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'contactMention', attrs: { contactId: 'x' } },
            { type: 'contactMention', attrs: { contactId: 'x' } },
          ],
        },
      ],
    }
    expect(extractContactMentionIdsFromTiptapJson(JSON.stringify(doc))).toEqual([
      'x',
    ])
  })
})
