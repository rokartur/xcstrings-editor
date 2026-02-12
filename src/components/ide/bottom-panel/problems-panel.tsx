import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, CircleDot, Clock } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import { formatLocaleCode } from '@/lib/locale-options'
import { cn } from '@/lib/utils'

interface Problem {
  key: string
  locale: string
  type: 'untranslated' | 'needs_review' | 'stale'
}

export function ProblemsPanel() {
  const { catalog } = useCatalog()
  const { openLocaleTab, setActiveTab } = useEditorStore()

  const [openGroups, setOpenGroups] = useState(() => new Set<string>(['Untranslated', 'Needs review', 'Stale']))

  const problems = useMemo(() => {
    if (!catalog) return []

    const documentSource = catalog.document.sourceLanguage
    const sourceLocale = documentSource
      ? (
          catalog.languages.find((lang) => lang === documentSource) ??
          catalog.languages.find((lang) => lang.toLowerCase() === documentSource.toLowerCase()) ??
          catalog.languages.find((lang) => lang.toLowerCase().startsWith(`${documentSource.toLowerCase()}-`))
        )
      : undefined

    const result: Problem[] = []
    for (const entry of catalog.entries) {
      if (!entry.shouldTranslate) continue
      for (const lang of catalog.languages) {
        const value = (entry.values[lang] ?? '').trim()
        const state = entry.states[lang]

        if (state === 'needs_review') {
          result.push({ key: entry.key, locale: lang, type: 'needs_review' })
        } else if (state === 'stale') {
          result.push({ key: entry.key, locale: lang, type: 'stale' })
        } else if (value.length === 0) {
          // Treat empty value as untranslated even when metadata state says 'translated'
          // to keep Problems consistent with UI stats and filters.
          if (sourceLocale) {
            const sourceValue = (entry.values[sourceLocale] ?? '').trim()
            if (sourceValue.length === 0) {
              continue
            }
          }
          result.push({ key: entry.key, locale: lang, type: 'untranslated' })
        }
      }
    }

    return result
  }, [catalog])

  const grouped = useMemo(() => {
    const untranslated = problems.filter((p) => p.type === 'untranslated')
    const needsReview = problems.filter((p) => p.type === 'needs_review')
    const stale = problems.filter((p) => p.type === 'stale')
    return { untranslated, needsReview, stale }
  }, [problems])

  if (!catalog) {
    return <div className="p-4 text-xs text-muted-foreground">No catalog loaded.</div>
  }

  if (problems.length === 0) {
    return <div className="p-4 text-xs text-muted-foreground">No problems found.</div>
  }

  const sections = [
    { label: 'Untranslated', items: grouped.untranslated, icon: CircleDot, className: 'text-blue-500' },
    { label: 'Needs review', items: grouped.needsReview, icon: AlertTriangle, className: 'text-amber-500' },
    { label: 'Stale', items: grouped.stale, icon: Clock, className: 'text-orange-500' },
  ] as const

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <div className="mb-2 px-1 text-xs text-muted-foreground">
          {problems.length} problem{problems.length !== 1 ? 's' : ''}
        </div>
        {sections.map(
          (section) =>
            section.items.length > 0 && (
              <div key={section.label} className="mb-2">
                {(() => {
                  const isOpen = openGroups.has(section.label)
                  return (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:bg-accent"
                        onClick={() =>
                          setOpenGroups((prev) => {
                            const next = new Set(prev)
                            if (next.has(section.label)) next.delete(section.label)
                            else next.add(section.label)
                            return next
                          })
                        }
                      >
                        <ChevronRight
                          className={cn(
                            'size-3.5 shrink-0 text-muted-foreground transition-transform',
                            isOpen && 'rotate-90',
                          )}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        <section.icon className={cn('size-3.5', section.className)} strokeWidth={1.5} />
                        <span>{section.label}</span>
                        <span className="text-muted-foreground">({section.items.length})</span>
                      </button>

                      {isOpen && (
                        <>
                          {section.items.slice(0, 100).map((problem) => (
                            <button
                              key={`${problem.key}-${problem.locale}`}
                              type="button"
                              className="flex w-full items-center gap-2 rounded px-2 py-0.5 text-left text-xs hover:bg-accent"
                              onClick={() => {
                                openLocaleTab(problem.locale)
                                setActiveTab(problem.locale)
                              }}
                            >
                              <span className="truncate font-medium">{problem.key}</span>
                              <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                                {formatLocaleCode(problem.locale)}
                              </span>
                            </button>
                          ))}
                          {section.items.length > 100 && (
                            <p className="px-2 py-0.5 text-[10px] text-muted-foreground">
                              ...and {section.items.length - 100} more
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )
                })()}
              </div>
            ),
        )}
      </div>
    </ScrollArea>
  )
}
