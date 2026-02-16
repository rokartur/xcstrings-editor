import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import { findLocaleOption, formatLocaleCode } from '@/lib/locale-options'
import { cn } from '@/lib/utils'

export function LanguagesPanel() {
  const { catalog, removeLanguage } = useCatalog()
  const { openTabs, activeTab, openLocaleTab, closeLocaleTab, setActiveTab } = useEditorStore()

  const stats = useMemo(() => {
    if (!catalog) return new Map<string, { translated: number; total: number }>()

    const result = new Map<string, { translated: number; total: number }>()
    const sourceLanguage = catalog.document.sourceLanguage
      ? formatLocaleCode(catalog.document.sourceLanguage).toLowerCase()
      : null
    for (const lang of catalog.languages) {
      if (sourceLanguage && formatLocaleCode(lang).toLowerCase() === sourceLanguage) {
        continue
      }
      let translated = 0
      let total = 0
      for (const entry of catalog.entries) {
        if (!entry.shouldTranslate || entry.key.trim().length === 0) continue

        total += 1
        const val = entry.values[lang] ?? ''
        const state = entry.states[lang]
        // Count as translated only if:
        // 1. It has a value
        // 2. It is not marked as needing review, new, or stale (translation state)
        // 3. It is not a stale key (extraction state)
        if (
          val.trim().length > 0 &&
          state !== 'needs_review' &&
          state !== 'new' &&
          state !== 'stale' &&
          entry.extractionState !== 'stale'
        ) {
          translated += 1
        }
      }
      result.set(lang, { translated, total })
    }
    return result
  }, [catalog])

  if (!catalog) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Import a catalog to see languages.
      </div>
    )
  }

  if (catalog.languages.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No languages in this catalog.
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {catalog.languages.map((lang) => {
        const formattedLocale = formatLocaleCode(lang)
        const languageName =
          formattedLocale.toLowerCase() === 'base'
            ? 'Base'
            : findLocaleOption(formattedLocale)?.language

        const displayLabel =
          languageName && languageName.toLowerCase() !== formattedLocale.toLowerCase()
            ? `${languageName} (${formattedLocale})`
            : formattedLocale

        const stat = stats.get(lang)
        const pct = stat && stat.total > 0
          ? stat.translated >= stat.total
            ? 100
            : Math.floor((stat.translated / stat.total) * 100)
          : 0
        const isOpen = openTabs.includes(lang)
        const isActive = activeTab === lang

        const isSourceLanguage = Boolean(
          catalog.document.sourceLanguage &&
            formatLocaleCode(catalog.document.sourceLanguage).toLowerCase() === formattedLocale.toLowerCase(),
        )

        const canRemove = !isSourceLanguage && formattedLocale.toLowerCase() !== 'base'

        return (
          <div
            key={lang}
            className={cn(
              'group flex items-stretch text-left text-sm transition-colors',
              'hover:bg-accent',
              isActive && 'bg-accent',
            )}
          >
            <button
              type="button"
              className="flex flex-1 items-center px-3 py-1.5 text-left"
              onClick={() => {
                openLocaleTab(lang)
                setActiveTab(lang)
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate font-medium">{displayLabel}</span>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {isSourceLanguage && (
                      <Badge variant="secondary" className="h-4 shrink-0 whitespace-nowrap px-1 text-[10px]">
                        source
                      </Badge>
                    )}
                    {isOpen && (
                      <Badge variant="secondary" className="h-4 shrink-0 whitespace-nowrap px-1 text-[10px]">
                        open
                      </Badge>
                    )}
                    {!isSourceLanguage && (
                      <span className="w-max shrink-0 text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
                    )}
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              className={cn(
                'flex w-7 shrink-0 items-center justify-center text-muted-foreground transition-opacity',
                'opacity-0 group-hover:opacity-100',
                canRemove ? 'hover:text-foreground' : 'cursor-not-allowed opacity-0',
              )}
              disabled={!canRemove}
              title={
                canRemove
                  ? 'Remove language'
                  : isSourceLanguage
                    ? 'Source language cannot be removed'
                    : 'Base cannot be removed'
              }
              onClick={() => {
                if (!canRemove) return
                const ok = window.confirm(`Remove ${displayLabel} from this catalog?`)
                if (!ok) return
                removeLanguage(lang)
                closeLocaleTab(lang)
                if (activeTab === lang) {
                  setActiveTab(null)
                }
              }}
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
