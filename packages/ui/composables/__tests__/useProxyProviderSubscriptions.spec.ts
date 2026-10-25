import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useProxyProviderSubscriptions } from '../useProxyProviderSubscriptions'

const url = 'https://subscription.example/a'
const urlKey = 'proxy-provider-subscription-url:provider-a'
const cacheKey = 'proxy-provider-subscription-info:provider-a'
const cachedInfo = { Upload: 10, Download: 20, Total: 100, Expire: 1800000000 }
const freshInfo = { Upload: 30, Download: 40, Total: 200, Expire: 1900000000 }
const scopes: ReturnType<typeof effectScope>[] = []
const fetchMock = vi.fn<typeof fetch>()

function response(
  header = 'upload=30; download=40; total=200; expire=1900000000',
) {
  return new Response('', { headers: { 'subscription-userinfo': header } })
}

function seedCache() {
  localStorage.setItem(urlKey, url)
  localStorage.setItem(cacheKey, JSON.stringify({ url, info: cachedInfo }))
}

function create(active = false, providers = ['provider-a']) {
  const scope = effectScope()
  scopes.push(scope)
  const names = ref(providers)
  const isActive = ref(active)
  const subscriptions = scope.run(() =>
    useProxyProviderSubscriptions(
      () => names.value,
      () => isActive.value,
    ),
  )!
  return { ...subscriptions, names, isActive, scope }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('proxy provider subscriptions', () => {
  it('shows cached data immediately and replaces it with fresh header data', async () => {
    seedCache()
    let resolve!: (value: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const subscriptions = create()

    const pending = subscriptions.refreshProvider('provider-a')
    expect(subscriptions.infoByProvider.get('provider-a')).toEqual(cachedInfo)
    resolve(response())
    await pending

    expect(subscriptions.infoByProvider.get('provider-a')).toEqual(freshInfo)
    expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual({
      url,
      info: freshInfo,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://clash.home.liuwj.me/subscription/subscription.example/a',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'omit',
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it.each([
    [
      'https://sub-a.example.com/api/subscribe?token=a%2Fb%2Bc&flag=1&flag=2',
      'http://clash.home.liuwj.me/subscription/sub-a.example.com/api/subscribe?token=a%2Fb%2Bc&flag=1&flag=2',
    ],
    [
      'https://sub-b.example.com/link/a%2Fb?name=%E8%AE%A2%E9%98%85#local-only',
      'http://clash.home.liuwj.me/subscription/sub-b.example.com/link/a%2Fb?name=%E8%AE%A2%E9%98%85',
    ],
    [
      'https://sub-c.example.com?token=abc',
      'http://clash.home.liuwj.me/subscription/sub-c.example.com/?token=abc',
    ],
    [
      'http://clash.home.liuwj.me/subscription/sub-a.example.com/api?token=abc',
      'http://clash.home.liuwj.me/subscription/sub-a.example.com/api?token=abc',
    ],
  ])(
    'requests %s through the proxy while retaining the original configuration',
    async (original, proxied) => {
      fetchMock.mockResolvedValueOnce(response())
      const subscriptions = create()
      subscriptions.saveUrl('provider-a', original)

      await vi.waitFor(() =>
        expect(subscriptions.infoByProvider.get('provider-a')).toEqual(
          freshInfo,
        ),
      )
      expect(fetchMock).toHaveBeenCalledWith(proxied, expect.any(Object))
      expect(localStorage.getItem(urlKey)).toBe(original)
      expect(subscriptions.getUrl('provider-a')).toBe(original)
      expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual({
        url: original,
        info: freshInfo,
      })
    },
  )

  it.each(['not a URL', 'ftp://subscription.example/a'])(
    'preserves the cache when the configured URL cannot be proxied: %s',
    async (invalidUrl) => {
      localStorage.setItem(urlKey, invalidUrl)
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ url: invalidUrl, info: cachedInfo }),
      )
      const subscriptions = create()
      await subscriptions.refreshProvider('provider-a')
      expect(fetchMock).not.toHaveBeenCalled()
      expect(subscriptions.infoByProvider.get('provider-a')).toEqual(cachedInfo)
      expect(localStorage.getItem(urlKey)).toBe(invalidUrl)
    },
  )

  it.each(['network', 'http', 'missing', 'invalid'])(
    'keeps cached data on %s failure',
    async (failure) => {
      seedCache()
      if (failure === 'network')
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      if (failure === 'http')
        fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
      if (failure === 'missing')
        fetchMock.mockResolvedValueOnce(new Response(''))
      if (failure === 'invalid')
        fetchMock.mockResolvedValueOnce(response('upload=-1; total=Infinity'))
      const subscriptions = create()

      await subscriptions.refreshProvider('provider-a')

      expect(subscriptions.infoByProvider.get('provider-a')).toEqual(cachedInfo)
      expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual({
        url,
        info: cachedInfo,
      })
    },
  )

  it('ignores corrupt or mismatched cache and recovers on a successful fetch', async () => {
    localStorage.setItem(urlKey, url)
    for (const cache of [
      'invalid json',
      'null',
      JSON.stringify({ url: `${url}/old`, info: cachedInfo }),
      JSON.stringify({ url, info: { Total: 'bad' } }),
    ]) {
      localStorage.setItem(cacheKey, cache)
      fetchMock.mockRejectedValueOnce(new TypeError('offline'))
      const subscriptions = create()
      await subscriptions.refreshProvider('provider-a')
      expect(subscriptions.infoByProvider.has('provider-a')).toBe(false)
      fetchMock.mockResolvedValueOnce(response())
      await subscriptions.refreshProvider('provider-a')
      expect(subscriptions.infoByProvider.get('provider-a')).toEqual(freshInfo)
    }
  })

  it('accepts zero usage, optional expiry, and whitespace in header fields', async () => {
    localStorage.setItem(urlKey, url)
    fetchMock.mockResolvedValueOnce(
      response(' upload = 0 ; download = 0 ; total = 100 '),
    )
    const subscriptions = create()
    await subscriptions.refreshProvider('provider-a')
    expect(subscriptions.infoByProvider.get('provider-a')).toEqual({
      Upload: 0,
      Download: 0,
      Total: 100,
      Expire: 0,
    })
  })

  it('fetches on each provider-tab entry and when providers arrive, without refetching for routine list updates', async () => {
    localStorage.setItem(urlKey, url)
    fetchMock.mockResolvedValue(response())
    const subscriptions = create(false, [])
    expect(fetchMock).not.toHaveBeenCalled()
    subscriptions.isActive.value = true
    await nextTick()
    expect(fetchMock).not.toHaveBeenCalled()
    subscriptions.names.value = ['provider-a']
    await nextTick()
    await vi.waitFor(() =>
      expect(subscriptions.infoByProvider.get('provider-a')).toEqual(freshInfo),
    )
    subscriptions.names.value = ['provider-a']
    await nextTick()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    subscriptions.isActive.value = false
    await nextTick()
    subscriptions.isActive.value = true
    await nextTick()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses persisted data on a new page visit when offline', async () => {
    localStorage.setItem(urlKey, url)
    fetchMock.mockResolvedValueOnce(response())
    const first = create(true)
    await vi.waitFor(() =>
      expect(first.infoByProvider.get('provider-a')).toEqual(freshInfo),
    )
    first.scope.stop()
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    const second = create(true)
    expect(second.infoByProvider.get('provider-a')).toEqual(freshInfo)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('keeps different providers independent and skips providers without a URL', async () => {
    localStorage.setItem(urlKey, url)
    localStorage.setItem(
      'proxy-provider-subscription-url:provider-b',
      'https://subscription.example/b',
    )
    fetchMock.mockImplementation(async (input) =>
      input === 'http://clash.home.liuwj.me/subscription/subscription.example/a'
        ? response()
        : response('total=500'),
    )
    const subscriptions = create(true, [
      'provider-a',
      'provider-b',
      'provider-c',
    ])
    await vi.waitFor(() =>
      expect(subscriptions.infoByProvider.get('provider-b')?.Total).toBe(500),
    )
    expect(subscriptions.infoByProvider.get('provider-a')).toEqual(freshInfo)
    expect(subscriptions.infoByProvider.has('provider-c')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('refreshes a changed URL immediately and ignores the previous in-flight response', async () => {
    seedCache()
    let resolve!: (value: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const subscriptions = create()
    const oldRequest = subscriptions.refreshProvider('provider-a')
    fetchMock.mockResolvedValueOnce(response())
    subscriptions.saveUrl('provider-a', ' https://subscription.example/new ')
    expect(subscriptions.infoByProvider.has('provider-a')).toBe(false)
    await vi.waitFor(() =>
      expect(subscriptions.infoByProvider.get('provider-a')).toEqual(freshInfo),
    )
    resolve(response('total=999'))
    await oldRequest
    expect(subscriptions.infoByProvider.get('provider-a')).toEqual(freshInfo)
    expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual({
      url: 'https://subscription.example/new',
      info: freshInfo,
    })
  })

  it('clears both URL and cache without letting an old request restore them', async () => {
    seedCache()
    let resolve!: (value: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const subscriptions = create()
    const pending = subscriptions.refreshProvider('provider-a')
    subscriptions.saveUrl('provider-a', '   ')
    expect(localStorage.getItem(urlKey)).toBeNull()
    expect(localStorage.getItem(cacheKey)).toBeNull()
    expect(subscriptions.infoByProvider.has('provider-a')).toBe(false)
    resolve(response())
    await pending
    expect(localStorage.getItem(cacheKey)).toBeNull()
    expect(subscriptions.infoByProvider.has('provider-a')).toBe(false)
  })

  it('keeps fresh data visible even if writing the cache fails', async () => {
    localStorage.setItem(urlKey, url)
    fetchMock.mockResolvedValueOnce(response())
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const subscriptions = create()
    await subscriptions.refreshProvider('provider-a')
    expect(subscriptions.infoByProvider.get('provider-a')).toEqual(freshInfo)
  })

  it('aborts a stalled request after the timeout and keeps cached data', async () => {
    vi.useFakeTimers()
    seedCache()
    fetchMock.mockImplementationOnce(
      (_input, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const subscriptions = create()
    const pending = subscriptions.refreshProvider('provider-a')
    await vi.advanceTimersByTimeAsync(15000)
    await pending
    expect(subscriptions.infoByProvider.get('provider-a')).toEqual(cachedInfo)
  })
})
