import { computed } from 'vue'
import { useProviderSubscriptionDocument } from './useProviderSubscriptionDocument'
import { useProxyConfigEditor } from './useProxyConfigEditor'

/** Adapt subscription documents to the shared node editor. */
export function useProviderSubscriptionEditor(
  getUrl: () => string,
  getName: () => string,
) {
  return useProxyConfigEditor(
    {
      ...useProviderSubscriptionDocument(getUrl, getName),
      available: computed(() => true),
      fullEditorPath: computed(() => '/profiles'),
    },
    { allowRename: true },
  )
}
