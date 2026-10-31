import type { ConfigDocument, ConfigObject } from '@metacubexd/config-editor'
import {
  openDocument,
  replaceDocumentData,
  validateDocument,
} from '@metacubexd/config-editor'
import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { toProviderUploadUrl } from '~/utils/providerUpload'
import { prefixNodeRegionFlag } from '~/utils/subscriptionNodeNames'
import { toSubscriptionProxyUrl } from '~/utils/subscriptionProxy'

/** An independent subscription editor; uploads only the provider node YAML. */
export function useProviderSubscriptionDocument(
  getUrl: () => string,
  getName: () => string,
) {
  const { t } = useI18n()
  const document = shallowRef<ConfigDocument | null>(null)
  const initial = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  const applyResult = ref<{ output: string; success: boolean } | null>(null)
  let request: AbortController | undefined
  let upload: AbortController | undefined
  const data = computed(() => document.value?.data ?? null)
  const dirty = computed(
    () => !!data.value && JSON.stringify(data.value) !== initial.value,
  )
  const diagnostics = computed(() =>
    data.value ? validateDocument(data.value) : [],
  )

  function cancelLoad() {
    upload?.abort()
    upload = undefined
    saving.value = false
    request?.abort()
    request = undefined
    loading.value = false
  }

  async function load() {
    cancelLoad()
    document.value = null
    initial.value = ''
    applyResult.value = null
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
    if (!document.value || loading.value || saving.value)
      return 'error' as const
    if (diagnostics.value.some((item) => item.severity === 'error'))
      return 'invalid' as const
    const current = document.value
    const controller = new AbortController()
    upload = controller
    saving.value = true
    applyResult.value = null
    errorMessage.value = ''
    let applying = false
    let timeout = setTimeout(() => controller.abort(), 30000)
    try {
      const providerUrl = toProviderUploadUrl(getName())
      const response = await fetch(providerUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/yaml; charset=utf-8' },
        body: current.yaml,
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      })
      if (upload !== controller) return 'error' as const
      if (controller.signal.aborted)
        throw new Error(t('providerSubscriptionUploadTimeout'))
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      applying = true
      clearTimeout(timeout)
      timeout = setTimeout(() => controller.abort(), 30000)
      const applied = await fetch(providerUrl, {
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      })
      if (upload !== controller) return 'error' as const
      const output = await applied.text()
      if (upload !== controller) return 'error' as const
      if (controller.signal.aborted)
        throw new Error(t('providerSubscriptionApplyTimeout'))
      applyResult.value = { output, success: applied.ok }
      if (!applied.ok) throw new Error(`HTTP ${applied.status}`)
      initial.value = JSON.stringify(current.data)
      return 'saved' as const
    } catch (error) {
      if (upload !== controller) return 'error' as const
      const detail =
        error instanceof Error ? error.message : t('proxyConfigSaveFailed')
      errorMessage.value = controller.signal.aborted
        ? t(
            applying
              ? 'providerSubscriptionApplyTimeout'
              : 'providerSubscriptionUploadTimeout',
          )
        : applying
          ? [
              t('providerSubscriptionApplyFailed'),
              detail,
              applyResult.value?.output,
            ]
              .filter(Boolean)
              .join('\n')
          : detail
      return 'error' as const
    } finally {
      clearTimeout(timeout)
      if (upload === controller) {
        upload = undefined
        saving.value = false
      }
    }
  }

  onScopeDispose(cancelLoad)
  return {
    data,
    dirty,
    diagnostics,
    loading,
    saving,
    errorMessage,
    applyResult,
    load,
    save,
    replaceSections,
    cancelLoad,
  }
}
