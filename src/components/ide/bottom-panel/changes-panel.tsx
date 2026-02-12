import { useMemo } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import { formatLocaleCode } from '@/lib/locale-options'
import { collectLanguages, resolveLocaleValue } from '@/lib/xcstrings'
import { cn } from '@/lib/utils'

interface DiffChange {
  locale: string
  kind: 'value' | 'comment'
  previous: string
  current: string
}

interface DiffEntry {
  key: string
  comment?: string
  changes: DiffChange[]
}

function groupDifferences(catalog: ReturnType<typeof useCatalog>['catalog']): DiffEntry[] {
  if (!catalog) return []

  const languages = new Set<string>(collectLanguages(catalog.document))
  for (const language of collectLanguages(catalog.originalDocument)) {
    languages.add(language)
  }

  const keys = new Set<string>([
    ...Object.keys(catalog.originalDocument.strings ?? {}),
    ...Object.keys(catalog.document.strings ?? {}),
  ])

  const diffEntries: DiffEntry[] = []

  for (const key of keys) {
    const currentEntry = catalog.document.strings[key]
    const originalEntry = catalog.originalDocument.strings[key]
    if (!currentEntry && !originalEntry) continue

    const changes: DiffChange[] = []

    for (const locale of languages) {
      const previousValue = originalEntry
        ? resolveLocaleValue(originalEntry, locale, catalog.originalDocument.sourceLanguage, key)
        : ''
      const currentValue = currentEntry
        ? resolveLocaleValue(currentEntry, locale, catalog.document.sourceLanguage, key)
        : ''

      if (previousValue !== currentValue) {
        changes.push({ locale, kind: 'value', previous: previousValue, current: currentValue })
      }

      const previousComment = originalEntry?.localizations?.[locale]?.comment ?? ''
      const currentComment = currentEntry?.localizations?.[locale]?.comment ?? ''

      if (previousComment !== currentComment) {
        changes.push({ locale, kind: 'comment', previous: previousComment, current: currentComment })
      }
    }

    if (changes.length > 0) {
      const diffEntry: DiffEntry = { key, changes }
      const comment = currentEntry?.comment ?? originalEntry?.comment
      if (typeof comment === 'string' && comment.length > 0) diffEntry.comment = comment
      diffEntries.push(diffEntry)
    }
  }

  return diffEntries.sort((a, b) => a.key.localeCompare(b.key))
}

export function ChangesPanel() {
  const { catalog, restoreAllChanges, restoreField } = useCatalog()
  const { openLocaleTab, setActiveTab, requestJumpToEntry } = useEditorStore()
  const diffEntries = useMemo(() => groupDifferences(catalog), [catalog])

  if (!catalog) {
    return <div className="p-4 text-xs text-muted-foreground">No catalog loaded.</div>
  }

  if (diffEntries.length === 0) {
    return <div className="p-4 text-xs text-muted-foreground">No changes detected.</div>
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">
            {diffEntries.length} key{diffEntries.length !== 1 ? 's' : ''} changed
          </span>
          <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
            {diffEntries.length}
          </Badge>
          <button
            type="button"
            className="ml-auto inline-flex h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              const ok = window.confirm('Restore all changes back to the imported version?')
              if (!ok) return
              restoreAllChanges()
            }}
          >
            <RotateCcw className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            Restore all
          </button>
        </div>

        <div className="space-y-2">
          {diffEntries.map((entry) => (
            <div key={entry.key} className="rounded-md border border-border/60 bg-background">
              <div className="flex items-start gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-xs font-medium">{entry.key}</span>
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                      {entry.changes.length}
                    </Badge>
                  </div>
                  {entry.comment && (
                    <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                      {entry.comment}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border/60">
                {entry.changes.map((change) => (
                  <div
                    key={`${entry.key}-${change.locale}-${change.kind}`}
                    className="flex flex-col gap-1 px-2 py-1.5 text-[11px] sm:flex-row sm:items-start"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-max shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {formatLocaleCode(change.locale)}
                      </span>
                      <span
                        className={cn(
                          'w-max shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                          change.kind === 'comment'
                            ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                            : 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
                        )}
                      >
                        {change.kind}
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          const localeLabel = formatLocaleCode(change.locale)
                          const ok = window.confirm(
                            `Restore ${entry.key} (${localeLabel}${change.kind === 'comment' ? ', comment' : ''})?`,
                          )
                          if (!ok) return
                          restoreField(entry.key, change.locale)
                        }}
                        title="Restore field"
                      >
                        <RotateCcw className="size-3" strokeWidth={1.5} aria-hidden="true" />
                        Restore
                      </button>

                      <button
                        type="button"
                        className="inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          openLocaleTab(change.locale)
                          setActiveTab(change.locale)
                          requestJumpToEntry(change.locale, entry.key)
                        }}
                        title="Go to field"
                      >
                        <ArrowRight className="size-3" strokeWidth={1.5} aria-hidden="true" />
                        Go
                      </button>
                    </div>

                    <div className="min-w-0 flex-1 sm:flex sm:items-start sm:gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                          Before
                        </div>
                        <div
                          className={cn(
                            'min-w-0 flex-1 rounded bg-muted/20 p-1.5 text-muted-foreground whitespace-pre-wrap',
                          )}
                        >
                          {change.previous || <span className="text-muted-foreground/70">(empty)</span>}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                          After
                        </div>
                        <div
                          className={cn(
                            'min-w-0 flex-1 rounded border border-primary/25 bg-background p-1.5 whitespace-pre-wrap',
                          )}
                        >
                          {change.current || <span className="text-muted-foreground/70">(empty)</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
