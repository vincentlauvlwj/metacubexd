import type { SubscriptionInfo } from '~/types'
import { onScopeDispose, reactive, watch } from 'vue'

const SUBSCRIPTION_PROXY_BASE = 'http://clash.home.liuwj.me/subscription/'
const urlKey = (name: string) => `proxy-provider-subscription-url:${name}`
const cacheKey = (name: string) => `proxy-provider-subscription-info:${name}`
const fields = {
  upload: 'Upload',
  download: 'Download',
  total: 'Total',
  expire: 'Expire',
} as const

function toProxyUrl(url: string): string {
  const subscription = new URL(url)
  if (!['http:', 'https:'].includes(subscription.protocol)) {
    throw new Error('Unsupported subscription URL protocol')
  }

  const proxy = new URL(SUBSCRIPTION_PROXY_BASE)
  // Existing manually configured proxy links must not be wrapped again.
  if (
    subscription.host === proxy.host &&
    subscription.pathname.startsWith(proxy.pathname)
  ) {
    return `${subscription.origin}${subscription.pathname}${subscription.search}`
  }

  return `${SUBSCRIPTION_PROXY_BASE}${subscription.host}${subscription.pathname}${subscription.search}`
}

function parseUserinfo(header: string | null): SubscriptionInfo | undefined {
  if (!header) return
  const values = new Map<string, number>()
  for (const part of header.split(';')) {
    const [key, value] = part.split('=').map((item) => item.trim())
    if (!Object.hasOwn(fields, key ?? '')) continue
    if (!value || !Number.isFinite(Number(value)) || Number(value) < 0) return
    values.set(key!, Number(value))
  }
  if (!['upload', 'download', 'total'].some((key) => values.has(key))) return
  return {
    Upload: values.get('upload') ?? 0,
    Download: values.get('download') ?? 0,
    Total: values.get('total') ?? 0,
    Expire: values.get('expire') ?? 0,
  }
}

function readCache(name: string, url: string): SubscriptionInfo | undefined {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(name)) ?? 'null')
    if (cached?.url !== url || !cached.info) return
    if (
      Object.values(fields).every(
        (key) =>
          typeof cached.info[key] === 'number' &&
          Number.isFinite(cached.info[key]) &&
          cached.info[key] >= 0,
      )
    ) {
      return cached.info
    }
  } catch {
    // Missing/unreadable storage or corrupt JSON must not prevent a fresh fetch.
  }
}

export function useProxyProviderSubscriptions(
  providerNames: () => string[],
  isActive: () => boolean,
) {
  const infoByProvider = reactive(new Map<string, SubscriptionInfo>())
  const requests = new Map<string, AbortController>()

  function getUrl(name: string): string {
    try {
      return localStorage.getItem(urlKey(name))?.trim() ?? ''
    } catch {
      return ''
    }
  }

  function cancelRequest(name: string) {
    requests.get(name)?.abort()
    requests.delete(name)
  }

  async function refreshProvider(name: string) {
    cancelRequest(name)
    const url = getUrl(name)
    const cached = url ? readCache(name, url) : undefined
    if (cached) infoByProvider.set(name, cached)
    else infoByProvider.delete(name)
    if (!url) return

    const controller = new AbortController()
    requests.set(name, controller)
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      // Proxy only the request. Configuration and cache identity retain the
      // original subscription URL. Do not forward dashboard credentials.
      const response = await fetch(toProxyUrl(url), {
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
      })
      // Only headers are needed; avoid downloading the subscription body.
      void response.body?.cancel().catch(() => {})
      if (!response.ok) return
      const info = parseUserinfo(response.headers.get('subscription-userinfo'))
      if (
        !info ||
        controller.signal.aborted ||
        requests.get(name) !== controller ||
        getUrl(name) !== url
      )
        return

      infoByProvider.set(name, info)
      try {
        localStorage.setItem(cacheKey(name), JSON.stringify({ url, info }))
      } catch {
        // Still display the fresh result when persistent storage is full.
      }
    } catch {
      // Network/CORS/timeout failures leave the last cached data visible.
    } finally {
      clearTimeout(timeout)
      if (requests.get(name) === controller) requests.delete(name)
    }
  }

  function saveUrl(name: string, value: string) {
    const url = value.trim()
    const previousUrl = getUrl(name)
    if (url) localStorage.setItem(urlKey(name), url)
    else localStorage.removeItem(urlKey(name))

    cancelRequest(name)
    if (!url || url !== previousUrl) {
      infoByProvider.delete(name)
      localStorage.removeItem(cacheKey(name))
    }
    if (url) void refreshProvider(name)
  }

  watch(
    () => (isActive() ? [...new Set(providerNames())] : []),
    (names, previousNames = []) => {
      for (const name of previousNames) {
        if (!names.includes(name)) cancelRequest(name)
      }
      // Entering the tab refreshes every provider. Store polling with unchanged
      // names should not repeatedly download subscriptions while it is open.
      for (const name of names) {
        if (!previousNames.includes(name)) void refreshProvider(name)
      }
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    for (const name of requests.keys()) cancelRequest(name)
  })

  return { infoByProvider, getUrl, saveUrl, refreshProvider }
}
