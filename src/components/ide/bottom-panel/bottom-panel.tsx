import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import { cn } from '@/lib/utils'

import { ChangesPanel } from './changes-panel'
import { ProblemsPanel } from './problems-panel'

export function BottomPanel() {
  const { bottomPanelTab, setBottomPanelTab } = useEditorStore()
  const { catalog } = useCatalog()

  const changesCount = catalog ? catalog.dirtyKeys.size : 0

  const problemsCount = useMemo(() => {
    if (!catalog) return 0

    const documentSource = catalog.document.sourceLanguage
    const sourceLocale = documentSource
      ? (
          catalog.languages.find((lang) => lang === documentSource) ??
          catalog.languages.find((lang) => lang.toLowerCase() === documentSource.toLowerCase()) ??
          catalog.languages.find((lang) => lang.toLowerCase().startsWith(`${documentSource.toLowerCase()}-`))
        )
      : undefined

    let count = 0
    for (const entry of catalog.entries) {
      if (!entry.shouldTranslate) continue

      // If a key has no source text, treat it as an "empty" state (not a problem).
      if (sourceLocale) {
        const sourceValue = (entry.values[sourceLocale] ?? '').trim()
        if (sourceValue.length === 0) {
          continue
        }
      }

      for (const lang of catalog.languages) {
        const value = (entry.values[lang] ?? '').trim()
        const state = entry.states[lang]

        if (state === 'needs_review' || state === 'stale') {
          count += 1
          continue
        }

        if (value.length === 0) {
          count += 1
        }
      }
    }

    return count
  }, [catalog])

  const tabs = [
    { id: 'changes' as const, label: 'Changes' },
    { id: 'problems' as const, label: 'Problems' },
  ] as const

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center border-b border-border px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              'flex items-center gap-2 px-2.5 py-1 text-xs transition-colors',
              bottomPanelTab === tab.id
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setBottomPanelTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'changes' && changesCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                {changesCount}
              </Badge>
            )}
            {tab.id === 'problems' && problemsCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                {problemsCount}
              </Badge>
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {bottomPanelTab === 'changes' && <ChangesPanel />}
        {bottomPanelTab === 'problems' && <ProblemsPanel />}
      </div>
    </div>
  )
}
