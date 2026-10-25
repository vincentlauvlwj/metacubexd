import { computed } from 'vue'
import { useProviderSubscriptionDocument } from './useProviderSubscriptionDocument'
import { useProxyConfigEditor } from './useProxyConfigEditor'

/** Adapt subscription documents to the shared node editor. */
export function useProviderSubscriptionEditor(getUrl: () => string) {
  return useProxyConfigEditor(
    {
      ...useProviderSubscriptionDocument(getUrl),
      available: computed(() => true),
      fullEditorPath: computed(() => '/profiles'),
    },
    { allowRename: true },
  )
}
