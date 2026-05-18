import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type FetchCall = { url: string, init?: RequestInit }

describe('useEntityShareToggle', () => {
  const calls: FetchCall[] = []
  const mockFetch = vi.fn(
    async (url: string, init?: RequestInit): Promise<{ url?: string, shareToken?: string } | void> => {
      calls.push({ url, init })
      if (init?.method === 'POST')
        return { shareToken: 'tok', url: `${url}/public` }
    },
  )
  const mockToast = { add: vi.fn() }

  beforeEach(() => {
    calls.length = 0
    mockFetch.mockClear()
    mockToast.add.mockClear()
    vi.stubGlobal('useRequestFetch', () => mockFetch)
    vi.stubGlobal('useToast', () => mockToast)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POST /api/contacts/:id/share when enabling contact share', async () => {
    const { useEntityShareToggle } = await import('../app/composables/useEntityShareToggle')
    const { toggleShare } = useEntityShareToggle()
    const r = await toggleShare('contact', 'c1', true)
    expect(calls).toEqual([
      { url: '/api/contacts/c1/share', init: { method: 'POST', body: {} } },
    ])
    expect(r).toEqual({
      shareEnabled: true,
      shareToken: 'tok',
      shareUrl: '/api/contacts/c1/share/public',
    })
  })

  it('DELETE /api/tasks/:id/share when disabling task share', async () => {
    const { useEntityShareToggle } = await import('../app/composables/useEntityShareToggle')
    const { toggleShare } = useEntityShareToggle()
    const r = await toggleShare('task', 't1', false)
    expect(calls).toEqual([{ url: '/api/tasks/t1/share', init: { method: 'DELETE' } }])
    expect(r).toEqual({
      shareEnabled: false,
      shareToken: null,
      shareUrl: null,
    })
  })
})
