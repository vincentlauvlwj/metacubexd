import type { ConfigDocument, ConfigObject } from '@metacubexd/config-editor'
import {
  openDocument,
  replaceDocumentData,
  validateDocument,
} from '@metacubexd/config-editor'
import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { prefixNodeRegionFlag } from '~/utils/subscriptionNodeNames'
import { toSubscriptionProxyUrl } from '~/utils/subscriptionProxy'

/** An independent editing session: no active profile, core update or upload. */
export function useProviderSubscriptionDocument(getUrl: () => string) {
  const { t } = useI18n()
  const document = shallowRef<ConfigDocument | null>(null)
  const initial = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  let request: AbortController | undefined
  const data = computed(() => document.value?.data ?? null)
  const dirty = computed(
    () => !!data.value && JSON.stringify(data.value) !== initial.value,
  )
  const diagnostics = computed(() =>
    data.value ? validateDocument(data.value) : [],
  )

  function cancelLoad() {
    request?.abort()
    request = undefined
    loading.value = false
  }

  async function load() {
    cancelLoad()
    document.value = null
    initial.value = ''
    errorMessage.value = ''
    loading.value = true
    const controller = new AbortController()
    request = controller
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      const response = await fetch(toSubscriptionProxyUrl(getUrl()), {
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const source = await response.text()
      if (request !== controller) return 'idle' as const
      if (controller.signal.aborted)
        throw new Error(t('providerSubscriptionTimeout'))
      const nodes = openDocument(source).data.proxies
      // Do not silently discard malformed entries or interpret HTML as an empty list.
      if (
        !Array.isArray(nodes) ||
        nodes.some(
          (node) => !node || typeof node !== 'object' || Array.isArray(node),
        )
      ) {
        throw new Error(t('providerSubscriptionInvalid'))
      }
      document.value = replaceDocumentData('proxies: []\n', {
        proxies: (nodes as ConfigObject[]).map((node) => {
          if (typeof node.name !== 'string') return node
          return { ...node, name: prefixNodeRegionFlag(node.name) }
        }),
      })
      initial.value = JSON.stringify(document.value.data)
      return 'ready' as const
    } catch (error) {
      if (request !== controller) return 'idle' as const
      errorMessage.value = controller.signal.aborted
        ? t('providerSubscriptionTimeout')
        : error instanceof Error
          ? error.message
          : t('proxyConfigLoadFailed')
      return 'error' as const
    } finally {
      clearTimeout(timeout)
      if (request === controller) {
        request = undefined
        loading.value = false
      }
    }
  }

  function replaceSections(sections: ConfigObject) {
    if (!document.value) return
    // A block-style root keeps exported nodes in indented YAML, not flow maps.
    document.value = replaceDocumentData('proxies: []\n', {
      proxies: sections.proxies ?? [],
    })
  }

  async function save() {
    if (!document.value || loading.value) return 'error' as const
    if (diagnostics.value.some((item) => item.severity === 'error'))
      return 'invalid' as const
    // Upload endpoint is not implemented yet. Keep the exact provider YAML as
    // the output boundary so it can later become the upload request body.
    console.log(document.value.yaml)
    initial.value = JSON.stringify(document.value.data)
    return 'saved' as const
  }

  onScopeDispose(cancelLoad)
  return {
    data,
    dirty,
    diagnostics,
    loading,
    saving,
    errorMessage,
    load,
    save,
    replaceSections,
    cancelLoad,
  }
}
