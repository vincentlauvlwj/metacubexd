import { openDocument } from '@metacubexd/config-editor'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, ref } from 'vue'
import { useProviderSubscriptionDocument } from '../useProviderSubscriptionDocument'
import { useProviderSubscriptionEditor } from '../useProviderSubscriptionEditor'
import { useProxyConfigEditor } from '../useProxyConfigEditor'

vi.mock('../useActiveProfileEditor', () => ({
  useActiveProfileEditor: () => {
    throw new Error('Subscription editing must not load an active profile')
  },
}))

// Same inline YAML shape as subscription downloads, with synthetic credentials.
const yaml = `
mixed-port: 7890
dns: { enable: true }
proxies:
  - { name: 香港, type: trojan, server: hk.example, port: 443, password: 'test:secret', udp: true, sni: example.com, skip-cert-verify: false, network: tcp }
  - { name: 日本, type: vless, server: jp.example, port: 443, uuid: test-uuid, ws-opts: { path: /ws, headers: { Host: example.com } } }
proxy-groups:
  - { name: auto, type: select, proxies: [香港, 日本] }
rules: [MATCH,auto]
`
const scopes: ReturnType<typeof effectScope>[] = []
const fetchMock = vi.fn()

function create() {
  const url = ref('https://subscription.example/api?token=a%2Fb&x=1&x=2')
  const scope = effectScope()
  scopes.push(scope)
  const editor = scope.run(() =>
    useProviderSubscriptionEditor(() => url.value),
  )!
  return { editor, url, scope }
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset().mockResolvedValue(new Response(yaml))
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('provider subscription node editor', () => {
  it('uses an injected document session without loading the active profile', async () => {
    const scope = effectScope()
    scopes.push(scope)
    const editor = scope.run(() =>
      useProxyConfigEditor({
        ...useProviderSubscriptionDocument(
          () => 'https://subscription.example',
        ),
        available: computed(() => true),
        fullEditorPath: computed(() => '/profiles'),
      }),
    )!
    expect(await editor.load()).toBe('ready')
    expect(editor.proxies.value.map((draft) => draft.value.name)).toEqual([
      '🇭🇰 香港',
      '🇯🇵 日本',
    ])
  })

  it('downloads the body through nginx and extracts only nodes', async () => {
    const { editor } = create()
    expect(await editor.load()).toBe('ready')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://clash.home.liuwj.me/subscription/subscription.example/api?token=a%2Fb&x=1&x=2',
      expect.objectContaining({
        credentials: 'omit',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
    expect(editor.proxies.value).toHaveLength(2)
    expect(editor.proxies.value[0]?.value.password).toBe('test:secret')
    expect(editor.groups.value).toEqual([])
    expect(editor.dirty.value).toBe(false)
  })

  it('prefixes downloaded region-code names while preserving flags and unknown names', async () => {
    const names = [
      'JP-Narita-01',
      'us_US-01',
      'hk 香港',
      '🇸🇬SG_新加坡',
      '🇭🇰 香港',
      '🇺🇸JP-conflict',
      '日本 05',
      'sg01-reality',
      'AI-test',
    ]
    const nodes = names.map((name) => ({
      name,
      type: 'trojan',
      server: 'example.com',
      port: 443,
      password: 'secret',
    }))
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ proxies: nodes })),
    )
    const { editor } = create()
    expect(await editor.load()).toBe('ready')
    expect(editor.proxies.value.map((draft) => draft.value)).toEqual(
      nodes.map((node, i) => ({
        ...node,
        name: [
          '🇯🇵 JP-Narita-01',
          '🇺🇸 us_US-01',
          '🇭🇰 hk 香港',
          ...names.slice(3, 6),
          '🇯🇵 日本 05',
          ...names.slice(7),
        ][i],
      })),
    )
    expect(editor.dirty.value).toBe(false)
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          proxies: editor.proxies.value.map((draft) => draft.value),
        }),
      ),
    )
    expect(await editor.load()).toBe('ready')
    expect(editor.proxies.value[0]?.value.name).toBe('🇯🇵 JP-Narita-01')
  })

  it('exports added, renamed, reordered and deleted nodes without other sections', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { editor } = create()
    await editor.load()
    editor.update('proxy', 1, {
      ...editor.proxies.value[1]!.value,
      name: 'Tokyo',
      port: 8443,
    })
    editor.add('proxy', {
      name: 'New',
      type: 'trojan',
      server: 'new.example',
      port: 443,
      password: 'new-secret',
    })
    editor.move('proxy', 2, 0)
    expect(editor.remove('proxy', 1)).toBe(true)
    expect(editor.dirty.value).toBe(true)
    expect(await editor.save()).toBe('saved')
    expect(output).toHaveBeenCalledTimes(1)
    expect(output.mock.calls[0]![0]).toMatch(
      /^proxies:\n {2}- name: New\n {4}type: trojan\n/,
    )
    expect(openDocument(output.mock.calls[0]![0]).data).toEqual({
      proxies: [
        {
          name: 'New',
          type: 'trojan',
          server: 'new.example',
          port: 443,
          password: 'new-secret',
        },
        {
          name: 'Tokyo',
          type: 'vless',
          server: 'jp.example',
          port: 8443,
          uuid: 'test-uuid',
          'ws-opts': { path: '/ws', headers: { Host: 'example.com' } },
        },
      ],
    })
    expect(editor.dirty.value).toBe(false)
  })

  it('outputs unchanged nodes and an explicitly emptied list', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { editor } = create()
    await editor.load()
    expect(await editor.save()).toBe('saved')
    expect(openDocument(output.mock.calls[0]![0]).data.proxies).toHaveLength(2)
    editor.remove('proxy', 1)
    editor.remove('proxy', 0)
    await editor.save()
    expect(openDocument(output.mock.calls[1]![0]).data).toEqual({ proxies: [] })
  })

  it.each([
    '',
    '<html>login</html>',
    'proxies: [',
    'proxies: wrong',
    'proxies: [null]',
    'dns: {}',
  ])('rejects invalid subscription content: %s', async (body) => {
    fetchMock.mockResolvedValue(new Response(body))
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { editor } = create()
    expect(await editor.load()).toBe('error')
    expect(editor.proxies.value).toEqual([])
    expect(await editor.save()).toBe('error')
    expect(output).not.toHaveBeenCalled()
  })

  it('blocks export of duplicate names and permits correction', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { editor } = create()
    await editor.load()
    editor.add('proxy', { name: '🇭🇰 香港', type: 'trojan' })
    expect(await editor.save()).toBe('invalid')
    expect(output).not.toHaveBeenCalled()
    editor.update('proxy', 2, { name: 'unique', type: 'trojan' })
    expect(await editor.save()).toBe('saved')
  })

  it('clears previous nodes after HTTP failure and can retry', async () => {
    const { editor } = create()
    await editor.load()
    fetchMock.mockResolvedValueOnce(new Response('failure', { status: 503 }))
    expect(await editor.load()).toBe('error')
    expect(editor.proxies.value).toEqual([])
    expect(editor.errorMessage.value).toContain('503')
    fetchMock.mockResolvedValueOnce(new Response(yaml))
    expect(await editor.load()).toBe('ready')
  })

  it('ignores a late response after opening another subscription', async () => {
    let resolve!: (response: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const { editor, url } = create()
    const first = editor.load()
    url.value = 'https://other.example/sub'
    fetchMock.mockResolvedValueOnce(
      new Response('proxies: [{ name: other, type: ss }]'),
    )
    await editor.load()
    resolve(new Response(yaml))
    await first
    expect(editor.proxies.value.map((p) => p.value.name)).toEqual(['other'])
  })

  it('cancels downloading when closed and never populates closed drafts', async () => {
    let resolve!: (response: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const { editor } = create()
    const pending = editor.load()
    editor.cancelLoad()
    expect(fetchMock.mock.calls[0]![1].signal.aborted).toBe(true)
    resolve(new Response(yaml))
    await pending
    expect(editor.proxies.value).toEqual([])
    expect(editor.loading.value).toBe(false)
  })
})
