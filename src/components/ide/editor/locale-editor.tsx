import { useCallback, useEffect, useMemo, useState } from 'react'

import { TranslationTable } from '@/components/translation-table'
import type { TranslationRow } from '@/components/translation-table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import type { CatalogEntry } from '@/lib/xcstrings'

type StateFilter = 'all' | 'translated' | 'needs_review' | 'new' | 'stale' | 'untranslated'
type ExtractionFilter = 'all' | 'manual' | 'extracted_with_value' | 'migrated' | 'stale_key'
type TranslatableFilter = 'all' | 'yes' | 'no'

function matchesFilters(
  entry: CatalogEntry,
  locale: string,
  stateFilter: StateFilter,
  extractionFilter: ExtractionFilter,
  translatableFilter: TranslatableFilter,
  searchQuery: string,
  sourceLocale: string | undefined,
): boolean {
  if (translatableFilter === 'yes' && !entry.shouldTranslate) return false
  if (translatableFilter === 'no' && entry.shouldTranslate) return false

  if (extractionFilter !== 'all') {
    const target = extractionFilter === 'stale_key' ? 'stale' : extractionFilter
    if (entry.extractionState !== target) return false
  }

  if (stateFilter !== 'all') {
    const localeState = entry.states[locale]
    if (stateFilter === 'untranslated') {
      const val = (entry.values[locale] ?? '').trim()
      if (sourceLocale) {
        const sourceVal = (entry.values[sourceLocale] ?? '').trim()
        // If there is no source text, we treat the state as "empty" (neither translated nor untranslated).
        if (sourceVal.length === 0) return false
      }
      // Treat empty string as untranslated even if state metadata says otherwise.
      // This keeps filters consistent with the % stats (which are based on value presence).
      if (val.length > 0) return false
    } else {
      if (localeState !== stateFilter) return false
    }
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    const keyMatch = entry.key.toLowerCase().includes(q)
    const valueMatch = (entry.values[locale] ?? '').toLowerCase().includes(q)
    const commentMatch = (entry.comment ?? '').toLowerCase().includes(q)
    if (!keyMatch && !valueMatch && !commentMatch) return false
  }

  return true
}

const stateOptions: { value: StateFilter; label: string }[] = [
  { value: 'all', label: 'All states' },
  { value: 'translated', label: 'Translated' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'new', label: 'New' },
  { value: 'stale', label: 'Stale' },
  { value: 'untranslated', label: 'Untranslated' },
]

const extractionOptions: { value: ExtractionFilter; label: string }[] = [
  { value: 'all', label: 'All extraction' },
  { value: 'manual', label: 'Manual' },
  { value: 'extracted_with_value', label: 'Extracted' },
  { value: 'migrated', label: 'Migrated' },
  { value: 'stale_key', label: 'Stale key' },
]

const translatableOptions: { value: TranslatableFilter; label: string }[] = [
  { value: 'all', label: 'All translatable' },
  { value: 'yes', label: 'Translatable' },
  { value: 'no', label: 'Not translatable' },
]

export function LocaleEditor({ locale }: { locale: string }) {
  const { catalog, updateTranslation, updateTranslationComment, updateTranslationState, updateShouldTranslate } = useCatalog()
  const { jumpToEntry, clearJumpToEntry } = useEditorStore()

  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [extractionFilter, setExtractionFilter] = useState<ExtractionFilter>('all')
  const [translatableFilter, setTranslatableFilter] = useState<TranslatableFilter>('yes')
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null)

  const sourceLocale = useMemo(() => {
    if (!catalog) return undefined
    const documentSource = catalog.document.sourceLanguage

    if (documentSource) {
      const directMatch = catalog.languages.find((lang) => lang === documentSource)
      if (directMatch) return directMatch

      const lowerSource = documentSource.toLowerCase()
      const caseInsensitiveMatch = catalog.languages.find(
        (lang) => lang.toLowerCase() === lowerSource,
      )
      if (caseInsensitiveMatch) return caseInsensitiveMatch

      const prefixMatch = catalog.languages.find((lang) =>
        lang.toLowerCase().startsWith(`${lowerSource}-`),
      )
      if (prefixMatch) return prefixMatch
    }

    return catalog.languages.find((lang) => lang !== locale) ?? catalog.languages[0]
  }, [catalog, locale])

  const filteredEntries = useMemo(() => {
    if (!catalog) return []

    // Hide invalid rows with empty keys.
    const visibleEntries = catalog.entries.filter((entry) => entry.key.trim().length > 0)

    const hasAnyFilter =
      stateFilter !== 'all' ||
      extractionFilter !== 'all' ||
      translatableFilter !== 'all' ||
      searchQuery.length > 0
    if (!hasAnyFilter) return visibleEntries
    return visibleEntries.filter((entry) =>
      matchesFilters(
        entry,
        locale,
        stateFilter,
        extractionFilter,
        translatableFilter,
        searchQuery,
        sourceLocale,
      ),
    )
  }, [catalog, locale, sourceLocale, stateFilter, extractionFilter, translatableFilter, searchQuery])

  const stateFilterLabel = useMemo(
    () => stateOptions.find((opt) => opt.value === stateFilter)?.label ?? 'All states',
    [stateFilter],
  )

  const extractionFilterLabel = useMemo(
    () => extractionOptions.find((opt) => opt.value === extractionFilter)?.label ?? 'All extraction',
    [extractionFilter],
  )

  const translatableFilterLabel = useMemo(
    () =>
      translatableOptions.find((opt) => opt.value === translatableFilter)?.label ??
      'All translatable',
    [translatableFilter],
  )

  const totalEntries = filteredEntries.length
  const visibleEntryCount = useMemo(
    () => (catalog ? catalog.entries.filter((entry) => entry.key.trim().length > 0).length : 0),
    [catalog],
  )

  // Handle jump requests (from Search/Problems/etc)
  useEffect(() => {
    if (!catalog) return
    if (!jumpToEntry) return
    if (jumpToEntry.locale !== locale) return

    const index = catalog.entries.findIndex((e) => e.key === jumpToEntry.key)
    if (index === -1) {
      clearJumpToEntry()
      return
    }

    // Ensure the entry is visible: reset filters before jump scrolling.
    setStateFilter('all')
    setExtractionFilter('all')
    setTranslatableFilter('yes')
    setSearchQuery('')
    setPendingScrollKey(jumpToEntry.key)
    clearJumpToEntry()
  }, [catalog, clearJumpToEntry, jumpToEntry, locale])

  const rows = useMemo(() => {
    return filteredEntries.map<TranslationRow>((entry) => {
      const row: TranslationRow = {
        key: entry.key,
        value: entry.values[locale] ?? '',
        comment: catalog?.document.strings[entry.key]?.comment ?? '',
        state: entry.states[locale],
        extractionState: entry.extractionState,
        shouldTranslate: entry.shouldTranslate,
      }

      if (sourceLocale) {
        row.sourceValue = entry.values[sourceLocale] ?? ''
      }

      return row
    })
  }, [catalog, filteredEntries, locale, sourceLocale])

  const handleVirtualScrollDone = useCallback(() => {
    setPendingScrollKey(null)
  }, [])

  if (!catalog) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Filter toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5">
        <Select value={stateFilter} onValueChange={(value) => setStateFilter(value as StateFilter)}>
          <SelectTrigger size="sm" className="h-6 min-w-32 text-xs">
            <SelectValue placeholder="All states">{stateFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {stateOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={extractionFilter}
          onValueChange={(value) => setExtractionFilter(value as ExtractionFilter)}
        >
          <SelectTrigger size="sm" className="h-6 min-w-32 text-xs">
            <SelectValue placeholder="All extraction">{extractionFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {extractionOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={translatableFilter}
          onValueChange={(value) => setTranslatableFilter(value as TranslatableFilter)}
        >
          <SelectTrigger size="sm" className="h-6 min-w-28 text-xs">
            <SelectValue placeholder="All translatable">{translatableFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {translatableOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter keys..."
          className="h-6 max-w-48 text-xs"
        />
        <span className="ml-auto text-[11px] text-muted-foreground">
          {totalEntries} of {visibleEntryCount} entries
        </span>
      </div>

      {/* Translation table */}
      <div className="min-h-0 flex-1 p-3">
        <TranslationTable
          rows={rows}
          sourceLocale={sourceLocale ?? 'N/A'}
          locale={locale}
          scrollToKey={pendingScrollKey}
          onScrollToKeyHandled={handleVirtualScrollDone}
          onValueChange={(key, value) => updateTranslation(key, locale, value)}
          onCommentChange={(key, comment) => updateTranslationComment(key, comment)}
          onStateChange={(key, state) => updateTranslationState(key, locale, state)}
          onShouldTranslateChange={(key, shouldTranslate) => updateShouldTranslate(key, shouldTranslate)}
        />
      </div>
    </div>
  )
}
