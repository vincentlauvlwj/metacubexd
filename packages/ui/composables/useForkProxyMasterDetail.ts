import type { Proxy, ProxyProvider } from '~/types'
import { computed } from 'vue'

/** Keep provider data and its non-selectable semantics outside the group view. */
export function useForkProxyMasterDetail(
  props: { groups?: Proxy[]; providers?: ProxyProvider[] },
  select: (group: Proxy, name: string) => unknown,
) {
  const providerByName = computed(
    () =>
      new Map(props.providers?.map((provider) => [provider.name, provider])),
  )
  const groups = computed<Proxy[]>(() =>
    props.providers
      ? props.providers.map((provider) => ({
          name: provider.name,
          type: provider.vehicleType,
          all: provider.proxies.map((node) => node.name),
          now: '',
          testUrl: provider.testUrl,
          timeout: provider.timeout,
          extra: {},
          history: [],
          hidden: false,
          udp: false,
          xudp: false,
          tfo: false,
        }))
      : (props.groups ?? []),
  )

  function selectNode(group: Proxy, name: string) {
    if (!props.providers) select(group, name)
  }

  return { groups, providerByName, selectNode }
}
