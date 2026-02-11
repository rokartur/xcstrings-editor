import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Textarea } from './ui/textarea'
import { cn } from '../lib/utils'
import type { TranslationState, ExtractionState } from '../lib/xcstrings'

export interface TranslationRow {
  key: string
  value: string
  sourceValue?: string
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
  onValueChange: (key: string, value: string) => void
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
}

const DebouncedTranslationRow = memo(function DebouncedTranslationRow({
  row,
  onValueChange,
}: DebouncedRowProps) {
  const [localValue, setLocalValue] = useState(row.value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestValue = useRef(localValue)

  // Sync from parent when the row changes (e.g. page navigation)
  useEffect(() => {
    setLocalValue(row.value)
    latestValue.current = row.value
  }, [row.value])

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

  // Flush pending debounce on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        onValueChange(row.key, latestValue.current)
      }
    }
  }, [onValueChange, row.key])

  return (
    <TableRow className={cn(
      'align-top last:border-0 hover:bg-muted/30',
      row.shouldTranslate === false && 'opacity-50',
    )}>
      <TableCell className="space-y-2">
        <div className="font-medium text-foreground">{row.key}</div>
        <MetadataBadges row={row} />
        {row.comment && (
          <p className="rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
            {row.comment}
          </p>
        )}
      </TableCell>
      <TableCell>
        {row.sourceValue !== undefined ? (
          row.sourceValue.length > 0 ? (
            <p className="whitespace-pre-line rounded-md bg-muted/20 p-3 text-sm text-muted-foreground">
              {row.sourceValue}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/70">No source value</p>
          )
        ) : (
          <p className="text-xs text-muted-foreground/70">No data</p>
        )}
      </TableCell>
      <TableCell>
        <Textarea
          value={localValue}
          onChange={handleChange}
          placeholder={row.shouldTranslate === false ? 'Not translatable' : 'Type the translated copy here'}
          disabled={row.shouldTranslate === false}
          className={cn('min-h-[96px]', row.shouldTranslate === false && 'cursor-not-allowed opacity-60')}
        />
      </TableCell>
    </TableRow>
  )
})

export function TranslationTable({ rows, locale, sourceLocale, onValueChange }: TranslationTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="border-border/60">
            <TableHead className="w-72 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              Key
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {`Source value (${sourceLocale})`}
            </TableHead>
            <TableHead className="w-[42%] text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {locale}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <DebouncedTranslationRow
              key={row.key}
              row={row}
              onValueChange={onValueChange}
            />
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">No entries on this page.</div>
      )}
    </div>
  )
}
