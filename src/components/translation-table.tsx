import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Languages, ShieldCheck } from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu'
import { Textarea } from './ui/textarea'
import { cn } from '../lib/utils'
import type { TranslationState, ExtractionState } from '../lib/xcstrings'

export interface TranslationRow {
  key: string
  value: string
  sourceValue?: string
  /** Global comment for this key (editable) */
  comment?: string
  /** Per-locale stringUnit.state */
  state?: TranslationState
  /** extractionState for the key */
  extractionState?: ExtractionState
  /** Whether this key should be translated */
  shouldTranslate?: boolean
}

interface TranslationTableProps {
  rows: TranslationRow[]
  locale: string
  sourceLocale: string
  scrollToKey?: string | null
  onScrollToKeyHandled?: () => void
  onValueChange: (key: string, value: string) => void
  onCommentChange: (key: string, comment: string) => void
  onStateChange: ((key: string, state: TranslationState) => void) | undefined
  onShouldTranslateChange: ((key: string, shouldTranslate: boolean) => void) | undefined
}

const DEBOUNCE_MS = 300
const STARTS_WITH_SPECIAL_TOKEN = /^(%|\$\{[^}]+\})/
const PLACEHOLDER_TOKEN_RE = /(\$\{[^}]+\}|%(?:\d+\$)?[-+#0 ']*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|j|z|t|L)?[@diuoxXfFeEgGaAcCsSp%])/g
const PLACEHOLDER_TOKEN_FULL_RE = /^(\$\{[^}]+\}|%(?:\d+\$)?[-+#0 ']*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|j|z|t|L)?[@diuoxXfFeEgGaAcCsSp%])$/

function HighlightedValue({ text }: { text: string }) {
  const parts = text.split(PLACEHOLDER_TOKEN_RE)

  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null

        if (PLACEHOLDER_TOKEN_FULL_RE.test(part)) {
          return (
            <span
              key={`token-${idx}`}
              className="mx-0.5 inline-flex items-center rounded bg-sky-500/20 px-1 py-0.5 text-[10px] font-semibold text-sky-800 dark:text-sky-200"
            >
              {part}
            </span>
          )
        }

        return <span key={`text-${idx}`}>{part}</span>
      })}
    </>
  )
}

type SortColumn = 'key' | 'source' | 'target' | 'comment'
type SortDirection = 'asc' | 'desc'
type SortState = { column: SortColumn; direction: SortDirection } | null

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
}

function SortableHeader({
  label,
  column,
  sort,
  onToggle,
}: {
  label: string
  column: SortColumn
  sort: SortState
  onToggle: (column: SortColumn) => void
}) {
  const sorted: SortDirection | false = sort?.column === column ? sort.direction : false

  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      data-sortable
      data-sorted={sorted || undefined}
      className={cn(
        'group/sort -mx-1.5 inline-flex items-center justify-start gap-1 rounded-sm px-1.5 py-1',
        'text-left text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      )}
      aria-label={
        sorted
          ? `${label}: sorted ${sorted === 'asc' ? 'ascending' : 'descending'} (click to change)`
          : `${label}: not sorted (click to sort)`
      }
      title={sorted ? `Sorted ${sorted}` : 'Click to sort'}
    >
      <span className="truncate">{label}</span>
      {/* Always-visible sort indicator (discoverability) */}
      <svg
        className={cn(
          'size-3 shrink-0',
          'transition-opacity',
          // Subtle by default, clearer on hover/focus.
          sorted ? 'opacity-100' : 'opacity-40 group-hover/sort:opacity-80 group-focus-visible/sort:opacity-80',
        )}
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        {/* Up triangle */}
        <path
          d="M8 3l3.5 4.5H4.5L8 3z"
          className={cn(
            'transition-opacity',
            !sorted ? 'opacity-70' : sorted === 'asc' ? 'opacity-100' : 'opacity-25',
          )}
        />
        {/* Down triangle */}
        <path
          d="M8 13L4.5 8.5h7L8 13z"
          className={cn(
            'transition-opacity',
            !sorted ? 'opacity-70' : sorted === 'desc' ? 'opacity-100' : 'opacity-25',
          )}
        />
      </svg>
    </button>
  )
}

/* ── Metadata badges ── */

const stateLabelMap: Record<string, { label: string; className: string }> = {
  translated: { label: 'Translated', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  needs_review: { label: 'Needs Review', className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  new: { label: 'New', className: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  stale: { label: 'Stale', className: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300' },
}

const extractionLabelMap: Record<string, { label: string; className: string }> = {
  manual: { label: 'Manual', className: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  extracted_with_value: { label: 'Extracted', className: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  migrated: { label: 'Migrated', className: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  stale: { label: 'Stale key', className: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300' },
}

function MetadataBadges({ row, isSourceLocale }: { row: TranslationRow; isSourceLocale: boolean }) {
  const badges: { key: string; label: string; className: string }[] = []

  if (row.shouldTranslate === false) {
    badges.push({
      key: 'no-translate',
      label: 'Don\u2019t translate',
      className: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    })
  }

  if (row.extractionState) {
    const def = extractionLabelMap[row.extractionState]
    if (def) badges.push({ key: `ext-${row.extractionState}`, ...def })
  }

  // Translation state badges are not relevant for the source language
  if (!isSourceLocale) {
    // Show "Untranslated" when value is empty and key should be translated
    if (row.shouldTranslate !== false && (row.value ?? '').trim().length === 0) {
      badges.push({
        key: 'state-untranslated',
        label: 'Untranslated',
        className: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
      })
    } else if (row.state) {
      const def = stateLabelMap[row.state]
      if (def) badges.push({ key: `state-${row.state}`, ...def })
    }
  }

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b.key}
          className={cn(
            'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none',
            b.className,
          )}
        >
          {b.label}
        </span>
      ))}
    </div>
  )
}

/* ── Debounced row ── */

interface DebouncedRowProps {
  row: TranslationRow
  isSourceLocale: boolean
  onValueChange: (key: string, value: string) => void
  onCommentChange: (key: string, comment: string) => void
  onStateChange: ((key: string, state: TranslationState) => void) | undefined
  onShouldTranslateChange: ((key: string, shouldTranslate: boolean) => void) | undefined
}

const DebouncedTranslationRow = memo(function DebouncedTranslationRow({
  row,
  isSourceLocale,
  onValueChange,
  onCommentChange,
  onStateChange,
  onShouldTranslateChange,
}: DebouncedRowProps) {
  const [localValue, setLocalValue] = useState(row.value)
  const [localComment, setLocalComment] = useState(row.comment ?? '')
  const [isTargetFocused, setIsTargetFocused] = useState(false)
  const [markSpecialStart, setMarkSpecialStart] = useState(false)
  const targetTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editedSinceFocusRef = useRef(false)
  const latestValue = useRef(localValue)
  const latestComment = useRef(localComment)

  // Sync from parent when the row changes (e.g. page navigation)
  useEffect(() => {
    setLocalValue(row.value)
    latestValue.current = row.value
  }, [row.value])

  useEffect(() => {
    const next = row.comment ?? ''
    setLocalComment(next)
    latestComment.current = next
  }, [row.comment])

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value
      setLocalValue(next)
      editedSinceFocusRef.current = true
      latestValue.current = next

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        onValueChange(row.key, next)
        timerRef.current = null
      }, DEBOUNCE_MS)
    },
    [onValueChange, row.key],
  )

  const handleCommentChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value
      setLocalComment(next)
      latestComment.current = next

      if (commentTimerRef.current) {
        clearTimeout(commentTimerRef.current)
      }

      commentTimerRef.current = setTimeout(() => {
        onCommentChange(row.key, next)
        commentTimerRef.current = null
      }, DEBOUNCE_MS)
    },
    [onCommentChange, row.key],
  )

  // Flush pending debounce on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        onValueChange(row.key, latestValue.current)
      }

      if (commentTimerRef.current) {
        clearTimeout(commentTimerRef.current)
        onCommentChange(row.key, latestComment.current)
      }
    }
  }, [onCommentChange, onValueChange, row.key])

  const handleTargetFocus = useCallback(() => {
    setIsTargetFocused(true)
    editedSinceFocusRef.current = false
  }, [])

  const handleTargetBlur = useCallback(() => {
    setIsTargetFocused(false)

    if (!editedSinceFocusRef.current) return

    const trimmedStart = localValue.trimStart()
    setMarkSpecialStart(STARTS_WITH_SPECIAL_TOKEN.test(trimmedStart))
  }, [localValue])

  useEffect(() => {
    if (isTargetFocused) {
      targetTextareaRef.current?.focus()
    }
  }, [isTargetFocused])

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          data-translation-key={row.key}
          className={cn(
            'group rounded-md border border-border/60 bg-background',
            'transition-colors hover:bg-muted/10',
            row.shouldTranslate === false && 'opacity-60',
          )}
        >
          <div
            className={cn(
              'grid gap-2 p-2',
              isSourceLocale
                ? 'min-w-180 grid-cols-[minmax(160px,1.1fr)_minmax(220px,2fr)_minmax(180px,1.4fr)_minmax(140px,0.9fr)]'
                : 'min-w-230 grid-cols-[minmax(160px,1.1fr)_minmax(220px,2fr)_minmax(220px,2fr)_minmax(180px,1.4fr)_minmax(140px,0.9fr)]',
            )}
          >
            {/* Key */}
            <div className="min-w-0">
              <span className="block text-xs font-medium leading-snug whitespace-normal wrap-break-word">
                {row.key}
              </span>
            </div>

            {/* Source — hidden when editing the source locale */}
            {!isSourceLocale && (
              <div className="min-w-0 rounded bg-muted/20 p-1.5 text-[11px] text-muted-foreground whitespace-pre-wrap">
                {row.sourceValue !== undefined ? (
                  row.sourceValue.length > 0 ? (
                    <HighlightedValue text={row.sourceValue} />
                  ) : (
                    <span className="text-muted-foreground/70">(empty)</span>
                  )
                ) : (
                  <span className="text-muted-foreground/70">(no data)</span>
                )}
              </div>
            )}

            {/* Target */}
            <div className="min-w-0">
              {row.shouldTranslate === false ? (
                <Textarea
                  value={localValue}
                  onChange={handleChange}
                  placeholder="Not translatable"
                  disabled
                  className={cn('field-sizing-content cursor-not-allowed opacity-60')}
                />
              ) : isTargetFocused ? (
                <Textarea
                  ref={targetTextareaRef}
                  value={localValue}
                  onChange={handleChange}
                  onFocus={handleTargetFocus}
                  onBlur={handleTargetBlur}
                  placeholder="Type the translated copy here"
                  className={cn('field-sizing-content')}
                />
              ) : (
                <button
                  type="button"
                  className={cn(
                    'box-border min-h-5.5 w-full rounded-md border border-input bg-input/20 px-2 py-0.5 text-left text-sm leading-snug transition-colors outline-none md:text-xs md:leading-snug dark:bg-input/30',
                    'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30',
                    'whitespace-pre-wrap break-words cursor-text',
                    markSpecialStart && 'border-amber-500/60 bg-amber-500/5',
                  )}
                  onClick={handleTargetFocus}
                  onFocus={handleTargetFocus}
                >
                  {localValue.trim().length > 0 ? (
                    <HighlightedValue text={localValue} />
                  ) : (
                    <span className="text-muted-foreground">Type the translated copy here</span>
                  )}
                </button>
              )}
            </div>

            {/* Comment */}
            <div className="min-w-0">
              <Textarea
                value={localComment}
                onChange={handleCommentChange}
                placeholder="Comment for this key (optional)"
                className={cn('field-sizing-content')}
              />
            </div>

            {/* Badges */}
            <div className="min-w-0">
              <div className="min-h-4.5">
                <MetadataBadges row={row} isSourceLocale={isSourceLocale} />
              </div>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {row.state !== 'needs_review' && (
          <ContextMenuItem
            onClick={() => onStateChange?.(row.key, 'needs_review')}
          >
            <Eye className="size-3.5 text-amber-500" strokeWidth={1.5} />
            Mark for Review
          </ContextMenuItem>
        )}
        {row.state === 'needs_review' && (
          <ContextMenuItem
            onClick={() => onStateChange?.(row.key, 'translated')}
          >
            <ShieldCheck className="size-3.5 text-emerald-500" strokeWidth={1.5} />
            Mark as Reviewed
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        {row.shouldTranslate === false ? (
          <ContextMenuItem
            onClick={() => onShouldTranslateChange?.(row.key, true)}
          >
            <Languages className="size-3.5 text-blue-500" strokeWidth={1.5} />
            Mark for Translation
          </ContextMenuItem>
        ) : (
          <ContextMenuItem
            onClick={() => onShouldTranslateChange?.(row.key, false)}
          >
            <EyeOff className="size-3.5 text-rose-500" strokeWidth={1.5} />
            Mark as &ldquo;Don&rsquo;t Translate&rdquo;
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
})

export function TranslationTable({
  rows,
  locale,
  sourceLocale,
  scrollToKey,
  onScrollToKeyHandled,
  onValueChange,
  onCommentChange,
  onStateChange,
  onShouldTranslateChange,
}: TranslationTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)

  const [sort, setSort] = useState<SortState>(null)

  const displayRows = useMemo(() => {
    if (!sort) return rows

    const decorated = rows.map((row, index) => ({ row, index }))

    const dir = sort.direction === 'asc' ? 1 : -1

    decorated.sort((a, b) => {
      const ra = a.row
      const rb = b.row

      let res = 0
      switch (sort.column) {
        case 'key':
          res = compareText(ra.key, rb.key)
          break
        case 'source':
          res = compareText(ra.sourceValue ?? '', rb.sourceValue ?? '')
          break
        case 'target':
          res = compareText(ra.value ?? '', rb.value ?? '')
          break
        case 'comment':
          res = compareText(ra.comment ?? '', rb.comment ?? '')
          break
        default:
          res = 0
      }

      if (res !== 0) return res * dir
      // Ensure stable sorting for equal values.
      return a.index - b.index
    })

    return decorated.map((d) => d.row)
  }, [rows, sort])

  const toggleSort = useCallback((column: SortColumn) => {
    setSort((prev) => {
      if (!prev || prev.column !== column) return { column, direction: 'asc' }
      if (prev.direction === 'asc') return { column, direction: 'desc' }
      return null
    })
  }, [])

  const indexByKey = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < displayRows.length; i += 1) {
      const row = displayRows[i]
      if (row) {
        map.set(row.key, i)
      }
    }
    return map
  }, [displayRows])

  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 6,
  })

  useEffect(() => {
    if (!scrollToKey) return

    const targetIndex = indexByKey.get(scrollToKey)
    if (targetIndex == null) {
      onScrollToKeyHandled?.()
      return
    }

    virtualizer.scrollToIndex(targetIndex, { align: 'center' })

    // Ensure the target has a chance to mount and then clear request.
    const frame = requestAnimationFrame(() => {
      onScrollToKeyHandled?.()
    })

    return () => cancelAnimationFrame(frame)
  }, [indexByKey, onScrollToKeyHandled, scrollToKey, virtualizer])

  const virtualItems = virtualizer.getVirtualItems()

  const isSourceLocale = locale === sourceLocale

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Column headers */}
      <div className="mb-2 overflow-x-auto rounded-md border border-border/60 bg-muted/10 px-2 py-1.5">
        <div className={cn(
          'grid gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
          isSourceLocale
            ? 'min-w-180 grid-cols-[minmax(160px,1.1fr)_minmax(220px,2fr)_minmax(180px,1.4fr)_minmax(140px,0.9fr)]'
            : 'min-w-230 grid-cols-[minmax(160px,1.1fr)_minmax(220px,2fr)_minmax(220px,2fr)_minmax(180px,1.4fr)_minmax(140px,0.9fr)]',
        )}>
          <SortableHeader label="Key" column="key" sort={sort} onToggle={toggleSort} />
          {!isSourceLocale && (
            <SortableHeader label={`Source (${sourceLocale})`} column="source" sort={sort} onToggle={toggleSort} />
          )}
          <SortableHeader label={locale} column="target" sort={sort} onToggle={toggleSort} />
          <SortableHeader label="Comment" column="comment" sort={sort} onToggle={toggleSort} />
          <span></span>
        </div>
      </div>

      {displayRows.length === 0 ? (
        <div className="rounded-md border border-border/60 bg-background p-6 text-center text-sm text-muted-foreground">
          No entries matching current filters.
        </div>
      ) : (
        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
          <div
            className="relative w-full"
            style={{
              height: `${virtualizer.getTotalSize()}px`,
            }}
          >
            {virtualItems.map((virtualItem) => {
              const row = displayRows[virtualItem.index]
              if (!row) return null

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full px-1 pb-2"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <DebouncedTranslationRow
                    row={row}
                    isSourceLocale={isSourceLocale}
                    onValueChange={onValueChange}
                    onCommentChange={onCommentChange}
                    onStateChange={onStateChange}
                    onShouldTranslateChange={onShouldTranslateChange}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
