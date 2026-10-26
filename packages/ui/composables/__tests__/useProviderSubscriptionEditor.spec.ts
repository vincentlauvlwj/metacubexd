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
  const name = ref('机场 A')
  const scope = effectScope()
  scopes.push(scope)
  const editor = scope.run(() =>
    useProviderSubscriptionEditor(
      () => url.value,
      () => name.value,
    ),
  )!
  return { editor, url, name, scope }
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
          () => 'provider',
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

  it('uploads added, renamed, reordered and deleted nodes without other sections', async () => {
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
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://clash.home.liuwj.me/proxy/provider/%E6%9C%BA%E5%9C%BA%20A.yaml',
      expect.objectContaining({ method: 'PUT', body: expect.any(String) }),
    )
    expect(fetchMock.mock.calls[1]![1].body).toMatch(
      /^proxies:\n {2}- name: New\n {4}type: trojan\n/,
    )
    expect(openDocument(fetchMock.mock.calls[1]![1].body).data).toEqual({
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

  it('uploads unchanged nodes and an explicitly emptied list', async () => {
    const { editor } = create()
    await editor.load()
    expect(await editor.save()).toBe('saved')
    expect(
      openDocument(fetchMock.mock.calls[1]![1].body).data.proxies,
    ).toHaveLength(2)
    editor.remove('proxy', 1)
    editor.remove('proxy', 0)
    await editor.save()
    expect(openDocument(fetchMock.mock.calls[2]![1].body).data).toEqual({
      proxies: [],
    })
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
    const { editor } = create()
    expect(await editor.load()).toBe('error')
    expect(editor.proxies.value).toEqual([])
    expect(await editor.save()).toBe('error')
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT'),
    ).toHaveLength(0)
  })

  it('blocks upload of duplicate names and permits correction', async () => {
    const { editor } = create()
    await editor.load()
    editor.add('proxy', { name: '🇭🇰 香港', type: 'trojan' })
    expect(await editor.save()).toBe('invalid')
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT'),
    ).toHaveLength(0)
    editor.update('proxy', 2, { name: 'unique', type: 'trojan' })
    expect(await editor.save()).toBe('saved')
  })

  it('keeps edits on upload failure and allows retry', async () => {
    const { editor } = create()
    await editor.load()
    editor.update('proxy', 0, {
      ...editor.proxies.value[0]!.value,
      name: 'edited',
    })
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }))
    expect(await editor.save()).toBe('error')
    expect(editor.errorMessage.value).toContain('500')
    expect(editor.dirty.value).toBe(true)
    expect(editor.saving.value).toBe(false)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await editor.save()).toBe('saved')
    expect(editor.dirty.value).toBe(false)
    expect(editor.errorMessage.value).toBe('')
  })

  it('reports network failures without losing edits', async () => {
    const { editor } = create()
    await editor.load()
    editor.update('proxy', 0, {
      ...editor.proxies.value[0]!.value,
      name: 'edited',
    })
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await editor.save()).toBe('error')
    expect(editor.errorMessage.value).toBe('Failed to fetch')
    expect(editor.dirty.value).toBe(true)
    expect(editor.saving.value).toBe(false)
  })

  it.each(['bad/name', 'bad\\name', '', 'bad\u0000name'])(
    'rejects invalid provider filenames: %s',
    async (invalidName) => {
      const { editor, name } = create()
      await editor.load()
      name.value = invalidName
      expect(await editor.save()).toBe('error')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(editor.errorMessage.value).toContain('filename')
    },
  )

  it('tracks upload state and prevents concurrent uploads', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { editor } = create()
    await editor.load()
    let resolve!: (response: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = editor.save()
    expect(editor.saving.value).toBe(true)
    expect(await editor.save()).toBe('error')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]![1]).toEqual(
      expect.objectContaining({
        headers: { 'Content-Type': 'application/yaml; charset=utf-8' },
        credentials: 'omit',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    )
    resolve(new Response(null, { status: 201 }))
    expect(await pending).toBe('saved')
    expect(editor.saving.value).toBe(false)
    expect(output).not.toHaveBeenCalled()
  })

  it('aborts uploads on close and ignores a late response', async () => {
    const { editor } = create()
    await editor.load()
    let resolve!: (response: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = editor.save()
    editor.cancelLoad()
    expect(fetchMock.mock.calls[1]![1].signal.aborted).toBe(true)
    resolve(new Response(null, { status: 204 }))
    expect(await pending).toBe('error')
    expect(editor.saving.value).toBe(false)
  })

  it('times out uploads and preserves the edited document', async () => {
    vi.useFakeTimers()
    const { editor } = create()
    await editor.load()
    editor.update('proxy', 0, {
      ...editor.proxies.value[0]!.value,
      name: 'edited',
    })
    fetchMock.mockImplementationOnce(
      (_, options) =>
        new Promise((_, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new Error('aborted')),
          )
        }),
    )
    const pending = editor.save()
    await vi.advanceTimersByTimeAsync(30000)
    expect(await pending).toBe('error')
    expect(editor.dirty.value).toBe(true)
    expect(editor.errorMessage.value).toBe('providerSubscriptionUploadTimeout')
    expect(editor.saving.value).toBe(false)
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
