const SUBSCRIPTION_PROXY_BASE = 'http://clash.home.liuwj.me/subscription/'

export function toSubscriptionProxyUrl(url: string): string {
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
