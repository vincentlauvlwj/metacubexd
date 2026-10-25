import type { ConfigObject } from '@metacubexd/config-editor'
import type {
  ActiveProfileEditorLoadResult,
  useActiveProfileEditor,
} from '~/composables/useActiveProfileEditor'

/** The shared editor only needs a document session, not its storage backend. */
export type ProxyEditorSession = Pick<
  ReturnType<typeof useActiveProfileEditor>,
  | 'available'
  | 'data'
  | 'diagnostics'
  | 'dirty'
  | 'loading'
  | 'saving'
  | 'errorMessage'
  | 'fullEditorPath'
  | 'save'
> & {
  load: () => Promise<ActiveProfileEditorLoadResult | 'idle'>
  replaceSections: (sections: ConfigObject) => void
  cancelLoad?: () => void
}
