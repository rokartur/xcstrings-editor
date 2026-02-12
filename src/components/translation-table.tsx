import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Textarea } from './ui/textarea'
import { cn } from '../lib/utils'
import type { TranslationState, ExtractionState } from '../lib/xcstrings'

export interface TranslationRow {
  key: string
  value: string
  sourceValue?: string
  comment?: string
  /** Per-locale comment stored in localizations[locale].comment */
  translationComment?: string
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
  onTranslationCommentChange: (key: string, comment: string) => void
}

const DEBOUNCE_MS = 300

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

function MetadataBadges({ row }: { row: TranslationRow }) {
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

  if (row.state) {
    const def = stateLabelMap[row.state]
    if (def) badges.push({ key: `state-${row.state}`, ...def })
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
  onValueChange: (key: string, value: string) => void
  onTranslationCommentChange: (key: string, comment: string) => void
}

const DebouncedTranslationRow = memo(function DebouncedTranslationRow({
  row,
  onValueChange,
  onTranslationCommentChange,
}: DebouncedRowProps) {
  const [localValue, setLocalValue] = useState(row.value)
  const [localTranslationComment, setLocalTranslationComment] = useState(row.translationComment ?? '')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestValue = useRef(localValue)
  const latestComment = useRef(localTranslationComment)

  // Sync from parent when the row changes (e.g. page navigation)
  useEffect(() => {
    setLocalValue(row.value)
    latestValue.current = row.value
  }, [row.value])

  useEffect(() => {
    const next = row.translationComment ?? ''
    setLocalTranslationComment(next)
    latestComment.current = next
  }, [row.translationComment])

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value
      setLocalValue(next)
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

  const handleTranslationCommentChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value
      setLocalTranslationComment(next)
      latestComment.current = next

      if (commentTimerRef.current) {
        clearTimeout(commentTimerRef.current)
      }

      commentTimerRef.current = setTimeout(() => {
        onTranslationCommentChange(row.key, next)
        commentTimerRef.current = null
      }, DEBOUNCE_MS)
    },
    [onTranslationCommentChange, row.key],
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
        onTranslationCommentChange(row.key, latestComment.current)
      }
    }
  }, [onTranslationCommentChange, onValueChange, row.key])

  return (
    <div
      data-translation-key={row.key}
      className={cn(
        'rounded-md border border-border/60 bg-background',
        row.shouldTranslate === false && 'opacity-50',
      )}
    >
      {/* Key header (matches ChangesPanel entry header) */}
      <div className="flex items-start gap-2 px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 truncate text-xs font-medium">{row.key}</span>
            <MetadataBadges row={row} />
          </div>
          {row.comment && (
            <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
              {row.comment}
            </div>
          )}
        </div>
      </div>

      {/* Content (matches ChangesPanel previous/current blocks) */}
      <div className="border-t border-border/60">
        <div className="flex flex-col gap-2 px-2 py-1.5 text-[11px] sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 rounded bg-muted/20 p-1.5 text-muted-foreground whitespace-pre-wrap">
            {row.sourceValue !== undefined ? (
              row.sourceValue.length > 0 ? (
                row.sourceValue
              ) : (
                <span className="text-muted-foreground/70">(empty)</span>
              )
            ) : (
              <span className="text-muted-foreground/70">(no data)</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Translation
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {row.key}
              </span>
            </div>
            <Textarea
              value={localValue}
              onChange={handleChange}
              placeholder={row.shouldTranslate === false ? 'Not translatable' : 'Type the translated copy here'}
              disabled={row.shouldTranslate === false}
              className={cn(
                'min-h-[96px]',
                row.shouldTranslate === false && 'cursor-not-allowed opacity-60',
              )}
            />

            <div className="mt-3 mb-1 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Comment
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                (for this locale only)
              </span>
            </div>
            <Textarea
              value={localTranslationComment}
              onChange={handleTranslationCommentChange}
              placeholder="Comment for this translation (optional)"
              disabled={row.shouldTranslate === false}
              className={cn(
                'min-h-[44px] text-xs dark:bg-input/20 bg-muted/10',
                row.shouldTranslate === false && 'cursor-not-allowed opacity-60',
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

export function TranslationTable({
  rows,
  locale,
  sourceLocale,
  scrollToKey,
  onScrollToKeyHandled,
  onValueChange,
  onTranslationCommentChange,
}: TranslationTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)

  const indexByKey = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < rows.length; i += 1) {
      map.set(rows[i].key, i)
    }
    return map
  }, [rows])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 260,
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Subtle column labels (kept, but in the ChangesPanel visual language) */}
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Source ({sourceLocale})
        </span>
        <span className="text-muted-foreground/40">→</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {locale}
        </span>
      </div>

      {rows.length === 0 ? (
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
              const row = rows[virtualItem.index]

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
                    onValueChange={onValueChange}
                    onTranslationCommentChange={onTranslationCommentChange}
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
