import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'

import { EditorTabBar } from './editor-tab-bar'
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
        {activeTab && catalog.languages.includes(activeTab) && (
          <LocaleEditor key={activeTab} locale={activeTab} />
        )}
      </div>
    </div>
  )
}
