import { computed } from 'vue'
import { useProviderSubscriptionDocument } from './useProviderSubscriptionDocument'
import { useProxyConfigEditor } from './useProxyConfigEditor'

/** Adapt subscription documents to the shared node editor. */
export function useProviderSubscriptionEditor(
  getUrl: () => string,
  getName: () => string,
) {
  const session = useProviderSubscriptionDocument(getUrl, getName)
  const editor = useProxyConfigEditor(
    {
      ...session,
      available: computed(() => true),
      fullEditorPath: computed(() => '/profiles'),
    },
    { allowRename: true },
  )
  return { ...editor, applyResult: session.applyResult }
}
