import { useMemo } from 'react'
import { Globe, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import { findLocaleOption, formatLocaleCode } from '@/lib/locale-options'
import { cn } from '@/lib/utils'

export function LanguagesPanel() {
  const { catalog, removeLanguage } = useCatalog()
  const { openTabs, activeTab, openLocaleTab, closeLocaleTab, setActiveTab } = useEditorStore()

  const sourceLocale = useMemo(() => {
    if (!catalog) return undefined
    const documentSource = catalog.document.sourceLanguage
    if (!documentSource) return undefined
    return (
      catalog.languages.find((lang) => lang === documentSource) ??
      catalog.languages.find((lang) => lang.toLowerCase() === documentSource.toLowerCase()) ??
      catalog.languages.find((lang) => lang.toLowerCase().startsWith(`${documentSource.toLowerCase()}-`))
    )
  }, [catalog])

  const stats = useMemo(() => {
    if (!catalog) return new Map<string, { translated: number; total: number }>()

    const result = new Map<string, { translated: number; total: number }>()
    for (const lang of catalog.languages) {
      let translated = 0
      let total = 0
      for (const entry of catalog.entries) {
        if (!entry.shouldTranslate) continue

        if (sourceLocale) {
          const sourceVal = (entry.values[sourceLocale] ?? '').trim()
          if (sourceVal.length === 0) continue
        }

        total += 1
        const val = entry.values[lang] ?? ''
        if (val.trim().length > 0) translated++
      }
      result.set(lang, { translated, total })
    }
    return result
  }, [catalog, sourceLocale])

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
        const pct = stat && stat.total > 0 ? Math.round((stat.translated / stat.total) * 100) : 0
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
              className="flex flex-1 items-center gap-2 px-3 py-1.5 text-left"
              onClick={() => {
                openLocaleTab(lang)
                setActiveTab(lang)
              }}
            >
              <Globe className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="min-w-0 flex-1 truncate font-medium">{displayLabel}</span>
                  {isOpen && (
                    <Badge variant="secondary" className="h-4 shrink-0 whitespace-nowrap px-1 text-[10px]">
                      open
                    </Badge>
                  )}
                  <span className="ml-auto w-max shrink-0 text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
                </div>
              </div>
            </button>

            <button
              type="button"
              className={cn(
                'px-2 text-muted-foreground transition-opacity',
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
