import type { Proxy, ProxyProvider } from '~/types'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useForkProxyMasterDetail } from '../useForkProxyMasterDetail'

const group: Proxy = {
  name: 'shared',
  type: 'Selector',
  all: ['JP-1'],
  now: 'JP-1',
  extra: {},
  history: [],
  hidden: false,
  udp: false,
  xudp: false,
  tfo: false,
}

describe('fork master-detail adapter', () => {
  it('preserves real group identity when selecting a card', () => {
    const select = vi.fn()
    const view = useForkProxyMasterDetail({ groups: [group] }, select)
    expect(view.groups.value[0]).toBe(group)
    view.selectNode(group, 'JP-2')
    expect(select).toHaveBeenCalledWith(group, 'JP-2')
  })

  it('keeps provider cards unselectable even with a matching group name', () => {
    const select = vi.fn()
    const provider: ProxyProvider = {
      name: 'shared',
      vehicleType: 'HTTP',
      proxies: [],
      testUrl: 'https://test.example',
      timeout: 1234,
      updatedAt: '',
    }
    const props = reactive({ groups: [group], providers: [provider] })
    const view = useForkProxyMasterDetail(props, select)
    expect(view.groups.value[0]).toMatchObject({
      name: 'shared',
      type: 'HTTP',
      all: [],
      now: '',
      testUrl: provider.testUrl,
      timeout: 1234,
    })
    view.selectNode(view.groups.value[0]!, 'JP-1')
    expect(select).not.toHaveBeenCalled()
    expect(view.providerByName.value.get('shared')).toBe(props.providers[0])
    props.providers = []
    expect(view.groups.value).toEqual([])
    expect(view.providerByName.value.size).toBe(0)
  })
})
