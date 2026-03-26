import { useMemo, useState } from 'react'
import { ArrowLeftRight, ChevronDown, ChevronRight, Minus, Plus, Replace } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCompareStore } from '@/lib/compare-store'
import { formatLocaleCode } from '@/lib/locale-options'
import { cn } from '@/lib/utils'
import type { CompareFilter, ChangedKey, UniqueKey } from '@/lib/compare-types'

const FILTER_OPTIONS: { id: CompareFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'added', label: 'Added' },
  { id: 'removed', label: 'Removed' },
  { id: 'changed', label: 'Changed' },
]

export function CompareView() {
  const result = useCompareStore((s) => s.result)
  const filter = useCompareStore((s) => s.filter)
  const setFilter = useCompareStore((s) => s.setFilter)

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <ArrowLeftRight className="mx-auto mb-3 size-8 text-muted-foreground/40" strokeWidth={1.2} />
          <p className="text-sm text-muted-foreground">No comparison loaded.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Use the Compare button in the toolbar to compare two .xcstrings files.
          </p>
        </div>
      </div>
    )
  }

  const totalChanges = result.addedKeys.length + result.removedKeys.length + result.changedKeys.length

  if (totalChanges === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
            <ArrowLeftRight className="size-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium">Files are identical</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.unchangedCount} keys match between {result.fileA} and {result.fileB}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Summary header */}
      <div className="shrink-0 border-b border-border bg-background px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-xs text-muted-foreground">
            Comparing{' '}
            <span className="font-medium text-foreground">{result.fileA}</span>
            {' '}↔{' '}
            <span className="font-medium text-foreground">{result.fileB}</span>
          </span>

          <div className="flex items-center gap-1.5">
            {result.addedKeys.length > 0 && (
              <Badge variant="outline" className="h-4 gap-1 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                <Plus className="size-2.5" />
                {result.addedKeys.length} added
              </Badge>
            )}
            {result.removedKeys.length > 0 && (
              <Badge variant="outline" className="h-4 gap-1 border-red-500/30 bg-red-500/10 px-1.5 text-[10px] text-red-700 dark:text-red-400">
                <Minus className="size-2.5" />
                {result.removedKeys.length} removed
              </Badge>
            )}
            {result.changedKeys.length > 0 && (
              <Badge variant="outline" className="h-4 gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                <Replace className="size-2.5" />
                {result.changedKeys.length} changed
              </Badge>
            )}
            {result.unchangedCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {result.unchangedCount} unchanged
              </Badge>
            )}
          </div>
        </div>

        {/* Language changes */}
        {(result.addedLanguages.length > 0 || result.removedLanguages.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            {result.addedLanguages.length > 0 && (
              <span className="text-emerald-700 dark:text-emerald-400">
                + Languages: {result.addedLanguages.map(formatLocaleCode).join(', ')}
              </span>
            )}
            {result.removedLanguages.length > 0 && (
              <span className="text-red-700 dark:text-red-400">
                − Languages: {result.removedLanguages.map(formatLocaleCode).join(', ')}
              </span>
            )}
          </div>
        )}

        {/* Filter tabs */}
        <div className="mt-2 flex items-center gap-0.5">
          {FILTER_OPTIONS.map((opt) => {
            const count =
              opt.id === 'all' ? totalChanges
                : opt.id === 'added' ? result.addedKeys.length
                  : opt.id === 'removed' ? result.removedKeys.length
                    : result.changedKeys.length

            if (opt.id !== 'all' && count === 0) return null

            return (
              <button
                key={opt.id}
                type="button"
                className={cn(
                  'inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition-colors',
                  filter === opt.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                onClick={() => setFilter(opt.id)}
              >
                {opt.label}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Entries list */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {(filter === 'all' || filter === 'added') && result.addedKeys.length > 0 && (
            <CompareSection
              title="Added keys"
              variant="added"
              count={result.addedKeys.length}
            >
              {result.addedKeys.map((entry) => (
                <AddedRemovedEntry
                  key={entry.key}
                  entry={entry}
                  variant="added"
                  languages={result.allLanguages}
                />
              ))}
            </CompareSection>
          )}

          {(filter === 'all' || filter === 'removed') && result.removedKeys.length > 0 && (
            <CompareSection
              title="Removed keys"
              variant="removed"
              count={result.removedKeys.length}
            >
              {result.removedKeys.map((entry) => (
                <AddedRemovedEntry
                  key={entry.key}
                  entry={entry}
                  variant="removed"
                  languages={result.allLanguages}
                />
              ))}
            </CompareSection>
          )}

          {(filter === 'all' || filter === 'changed') && result.changedKeys.length > 0 && (
            <CompareSection
              title="Changed keys"
              variant="changed"
              count={result.changedKeys.length}
            >
              {result.changedKeys.map((entry) => (
                <ChangedEntry key={entry.key} entry={entry} />
              ))}
            </CompareSection>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

/* ---- Section wrapper ---- */

function CompareSection({
  title,
  variant,
  count,
  children,
}: {
  title: string
  variant: 'added' | 'removed' | 'changed'
  count: number
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  const borderColor =
    variant === 'added'
      ? 'border-emerald-500/25'
      : variant === 'removed'
        ? 'border-red-500/25'
        : 'border-amber-500/25'

  const titleColor =
    variant === 'added'
      ? 'text-emerald-700 dark:text-emerald-400'
      : variant === 'removed'
        ? 'text-red-700 dark:text-red-400'
        : 'text-amber-700 dark:text-amber-400'

  return (
    <div className={cn('rounded-lg border', borderColor)}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
        <span className={cn('text-xs font-semibold', titleColor)}>{title}</span>
        <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
          {count}
        </Badge>
      </button>
      {!collapsed && <div className="border-t border-border/40">{children}</div>}
    </div>
  )
}

/* ---- Added / Removed key entry ---- */

function AddedRemovedEntry({
  entry,
  variant,
  languages,
}: {
  entry: UniqueKey
  variant: 'added' | 'removed'
  languages: string[]
}) {
  const [expanded, setExpanded] = useState(false)

  const nonEmptyLocales = useMemo(
    () => languages.filter((lang) => entry.values[lang]?.trim()),
    [entry.values, languages],
  )

  const bgColor =
    variant === 'added'
      ? 'hover:bg-emerald-500/[0.03]'
      : 'hover:bg-red-500/[0.03]'

  const dotColor =
    variant === 'added'
      ? 'bg-emerald-500'
      : 'bg-red-500'

  return (
    <div className={cn('transition-colors', bgColor)}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className={cn('size-1.5 shrink-0 rounded-full', dotColor)} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.key}</span>
        {entry.comment && (
          <span className="hidden truncate text-[10px] text-muted-foreground/70 sm:inline">
            {entry.comment}
          </span>
        )}
        <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
          {nonEmptyLocales.length} locale{nonEmptyLocales.length !== 1 ? 's' : ''}
        </Badge>
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
      </button>

      {expanded && nonEmptyLocales.length > 0 && (
        <div className="border-t border-border/30 px-2.5 py-1.5">
          <div className="space-y-1">
            {nonEmptyLocales.map((lang) => (
              <div key={lang} className="flex items-start gap-2 text-[11px]">
                <span className="w-10 shrink-0 rounded bg-muted px-1 py-0.5 text-center font-mono text-[10px] text-muted-foreground">
                  {formatLocaleCode(lang)}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap text-muted-foreground">
                  {entry.values[lang]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Changed key entry ---- */

function ChangedEntry({ entry }: { entry: ChangedKey }) {
  const [expanded, setExpanded] = useState(false)

  const changeCount = entry.localeChanges.length + (entry.commentChange ? 1 : 0)

  return (
    <div className="transition-colors hover:bg-amber-500/3">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.key}</span>
        {entry.comment && (
          <span className="hidden truncate text-[10px] text-muted-foreground/70 sm:inline">
            {entry.comment}
          </span>
        )}
        <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
          {changeCount} change{changeCount !== 1 ? 's' : ''}
        </Badge>
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/30">
          {entry.commentChange && (
            <div className="flex flex-col gap-1 px-2.5 py-1.5 text-[11px] sm:flex-row sm:items-start">
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 rounded bg-muted px-1 py-0.5 text-center font-mono text-[10px] text-muted-foreground">
                  ––
                </span>
                <span className="w-max shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-violet-500/10 text-violet-700 dark:text-violet-300">
                  comment
                </span>
              </div>
              <div className="min-w-0 flex-1 sm:flex sm:items-start sm:gap-2">
                <DiffValuePair
                  oldValue={entry.commentChange.old}
                  newValue={entry.commentChange.new}
                  labelA="File A"
                  labelB="File B"
                />
              </div>
            </div>
          )}

          {entry.localeChanges.map((change) => (
            <div
              key={`${entry.key}-${change.locale}`}
              className="flex flex-col gap-1 px-2.5 py-1.5 text-[11px] sm:flex-row sm:items-start"
            >
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 rounded bg-muted px-1 py-0.5 text-center font-mono text-[10px] text-muted-foreground">
                  {formatLocaleCode(change.locale)}
                </span>
                <span className="w-max shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-sky-500/10 text-sky-700 dark:text-sky-300">
                  value
                </span>
                {change.oldState !== change.newState && (
                  <span className="rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-orange-500/10 text-orange-700 dark:text-orange-300">
                    {change.oldState ?? 'none'} → {change.newState ?? 'none'}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 sm:flex sm:items-start sm:gap-2">
                <DiffValuePair
                  oldValue={change.oldValue}
                  newValue={change.newValue}
                  labelA="File A"
                  labelB="File B"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---- Reusable diff value pair ---- */

function DiffValuePair({
  oldValue,
  newValue,
  labelA,
  labelB,
}: {
  oldValue: string
  newValue: string
  labelA: string
  labelB: string
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {labelA}
        </div>
        <div className="min-w-0 flex-1 rounded bg-red-500/6 p-1.5 text-muted-foreground whitespace-pre-wrap dark:bg-red-500/10">
          {oldValue || <span className="text-muted-foreground/70">(empty)</span>}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {labelB}
        </div>
        <div className="min-w-0 flex-1 rounded bg-emerald-500/6 border border-emerald-500/15 p-1.5 whitespace-pre-wrap dark:bg-emerald-500/10">
          {newValue || <span className="text-muted-foreground/70">(empty)</span>}
        </div>
      </div>
    </>
  )
}
