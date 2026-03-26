import { useCatalog } from '@/lib/catalog-context'
import { COMPARE_TAB_ID, DIFF_TAB_ID, useEditorStore } from '@/lib/editor-store'

import { CompareView } from './compare-view'
import { EditorTabBar } from './editor-tab-bar'
import { DiffView } from './diff-view'
import { LocaleEditor } from './locale-editor'
import { WelcomeScreen } from './welcome-screen'

export function EditorArea() {
  const { catalog } = useCatalog()
  const { openTabs, activeTab } = useEditorStore()

  if (!catalog || openTabs.length === 0 || !activeTab) {
    return <WelcomeScreen />
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorTabBar />
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === DIFF_TAB_ID ? (
          <DiffView />
        ) : activeTab === COMPARE_TAB_ID ? (
          <CompareView />
        ) : (
          activeTab && catalog.languages.includes(activeTab) && (
            <LocaleEditor key={activeTab} locale={activeTab} />
          )
        )}
      </div>
    </div>
  )
}
