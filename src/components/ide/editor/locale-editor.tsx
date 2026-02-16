import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Sparkles, X } from 'lucide-react'

import { TranslationTable } from '@/components/translation-table'
import type { TranslationRow } from '@/components/translation-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAiSettingsStore } from '@/lib/ai-settings-store'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import { translateText, translateBatch } from '@/lib/ollama'
import type { CatalogEntry, TranslationState } from '@/lib/xcstrings'

type StateFilter = 'all' | 'translated' | 'needs_review' | 'new' | 'stale' | 'untranslated'
type ExtractionFilter = 'all' | 'manual' | 'extracted_with_value' | 'migrated' | 'stale_key'
type TranslatableFilter = 'all' | 'yes' | 'no'
type CommentFilter = 'all' | 'with' | 'without'

function matchesFilters(
  entry: CatalogEntry,
  locale: string,
  stateFilter: StateFilter,
  extractionFilter: ExtractionFilter,
  translatableFilter: TranslatableFilter,
  commentFilter: CommentFilter,
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
    } else if (stateFilter === 'stale') {
      // "Stale" can come from translation state or extraction state in xcstrings.
      if (localeState !== 'stale' && entry.extractionState !== 'stale') return false
    } else {
      if (localeState !== stateFilter) return false
    }
  }

  if (commentFilter !== 'all') {
    const hasComment = (entry.comment ?? '').trim().length > 0
    if (commentFilter === 'with' && !hasComment) return false
    if (commentFilter === 'without' && hasComment) return false
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
  { value: 'stale_key', label: 'Stale' },
]

const translatableOptions: { value: TranslatableFilter; label: string }[] = [
  { value: 'all', label: 'All translatable' },
  { value: 'yes', label: 'Translatable' },
  { value: 'no', label: 'Not translatable' },
]

const commentOptions: { value: CommentFilter; label: string }[] = [
  { value: 'all', label: 'All comments' },
  { value: 'with', label: 'With comments' },
  { value: 'without', label: 'Without comments' },
]

function parseStateFilter(value: string | null): StateFilter {
  switch (value) {
    case 'translated':
    case 'needs_review':
    case 'new':
    case 'stale':
    case 'untranslated':
      return value
    default:
      return 'all'
  }
}

function parseExtractionFilter(value: string | null): ExtractionFilter {
  switch (value) {
    case 'manual':
    case 'extracted_with_value':
    case 'migrated':
    case 'stale_key':
      return value
    default:
      return 'all'
  }
}

function parseTranslatableFilter(value: string | null): TranslatableFilter {
  switch (value) {
    case 'yes':
    case 'no':
      return value
    default:
      return 'all'
  }
}

function parseCommentFilter(value: string | null): CommentFilter {
  switch (value) {
    case 'with':
    case 'without':
      return value
    default:
      return 'all'
  }
}

export function LocaleEditor({ locale }: { locale: string }) {
  const { catalog, updateTranslation, updateTranslationComment, updateTranslationState, updateShouldTranslate } = useCatalog()
  const { jumpToEntry, clearJumpToEntry } = useEditorStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const { ollamaUrl, model, isConnected } = useAiSettingsStore()

  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null)
  const [aiTranslatingKeys, setAiTranslatingKeys] = useState<Set<string>>(new Set())
  const [batchTranslating, setBatchTranslating] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number } | null>(null)
  const batchAbortRef = useRef<AbortController | null>(null)

  const stateFilter = useMemo(
    () => parseStateFilter(searchParams.get('state')),
    [searchParams],
  )
  const extractionFilter = useMemo(
    () => parseExtractionFilter(searchParams.get('extraction')),
    [searchParams],
  )
  const translatableFilter = useMemo(
    () => parseTranslatableFilter(searchParams.get('translatable')),
    [searchParams],
  )
  const commentFilter = useMemo(
    () => parseCommentFilter(searchParams.get('comments')),
    [searchParams],
  )
  const searchQuery = useMemo(() => searchParams.get('q') ?? '', [searchParams])

  const updateFilterParams = useCallback((updates: {
    stateFilter?: StateFilter
    extractionFilter?: ExtractionFilter
    translatableFilter?: TranslatableFilter
    commentFilter?: CommentFilter
    searchQuery?: string
  }) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)

      if (updates.stateFilter !== undefined) {
        if (updates.stateFilter === 'all') next.delete('state')
        else next.set('state', updates.stateFilter)
      }

      if (updates.extractionFilter !== undefined) {
        if (updates.extractionFilter === 'all') next.delete('extraction')
        else next.set('extraction', updates.extractionFilter)
      }

      if (updates.translatableFilter !== undefined) {
        if (updates.translatableFilter === 'all') next.delete('translatable')
        else next.set('translatable', updates.translatableFilter)
      }

      if (updates.commentFilter !== undefined) {
        if (updates.commentFilter === 'all') next.delete('comments')
        else next.set('comments', updates.commentFilter)
      }

      if (updates.searchQuery !== undefined) {
        const normalized = updates.searchQuery.trim()
        if (normalized.length === 0) next.delete('q')
        else next.set('q', updates.searchQuery)
      }

      return next
    }, { replace: true })
  }, [setSearchParams])

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
      commentFilter !== 'all' ||
      searchQuery.length > 0

    if (!hasAnyFilter) return visibleEntries

    return visibleEntries.filter((entry) => {
      return matchesFilters(
        entry,
        locale,
        stateFilter,
        extractionFilter,
        translatableFilter,
        commentFilter,
        searchQuery,
        sourceLocale,
      )
    })
  }, [catalog, locale, sourceLocale, stateFilter, extractionFilter, translatableFilter, commentFilter, searchQuery])

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

  const commentFilterLabel = useMemo(
    () => commentOptions.find((opt) => opt.value === commentFilter)?.label ?? 'All comments',
    [commentFilter],
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
    updateFilterParams({
      stateFilter: 'all',
      extractionFilter: 'all',
      translatableFilter: 'all',
      commentFilter: 'all',
      searchQuery: '',
    })
    setPendingScrollKey(jumpToEntry.key)
    clearJumpToEntry()
  }, [catalog, clearJumpToEntry, jumpToEntry, locale, updateFilterParams])

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

  const handleValueChange = useCallback((key: string, value: string) => {
    updateTranslation(key, locale, value)
  }, [locale, updateTranslation])

  const handleCommentChange = useCallback((key: string, comment: string) => {
    updateTranslationComment(key, comment)
  }, [updateTranslationComment])

  const handleStateChange = useCallback((key: string, state: TranslationState) => {
    updateTranslationState(key, locale, state)
  }, [locale, updateTranslationState])

  const handleShouldTranslateChange = useCallback((key: string, shouldTranslate: boolean) => {
    updateShouldTranslate(key, shouldTranslate)
  }, [updateShouldTranslate])

  const handleAiTranslate = useCallback(async (key: string) => {
    if (!catalog || !sourceLocale) return
    const entry = catalog.entries.find((e) => e.key === key)
    if (!entry) return

    const sourceText = entry.values[sourceLocale] ?? ''
    if (!sourceText.trim()) return

    const comment = catalog.document.strings[key]?.comment

    setAiTranslatingKeys((prev) => new Set(prev).add(key))
    try {
      const translation = await translateText({
        text: sourceText,
        sourceLocale,
        targetLocale: locale,
        key,
        comment,
        baseUrl: ollamaUrl,
        model,
      })
      if (translation) {
        updateTranslation(key, locale, translation)
        updateTranslationState(key, locale, 'needs_review')
      }
    } catch {
      // silently fail for individual translations
    } finally {
      setAiTranslatingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [catalog, sourceLocale, locale, ollamaUrl, model, updateTranslation, updateTranslationState])

  const missingCount = useMemo(() => {
    if (!catalog || !sourceLocale || locale === sourceLocale) return 0
    return catalog.entries.filter((e) => {
      if (!e.shouldTranslate) return false
      const val = (e.values[locale] ?? '').trim()
      const src = (e.values[sourceLocale] ?? '').trim()
      return val.length === 0 && src.length > 0
    }).length
  }, [catalog, locale, sourceLocale])

  const handleBatchTranslate = useCallback(async () => {
    if (!catalog || !sourceLocale || batchTranslating) return

    const entries = catalog.entries.filter((e) => {
      if (!e.shouldTranslate) return false
      const val = (e.values[locale] ?? '').trim()
      const src = (e.values[sourceLocale] ?? '').trim()
      return val.length === 0 && src.length > 0
    })

    if (entries.length === 0) return

    const abort = new AbortController()
    batchAbortRef.current = abort
    setBatchTranslating(true)
    setBatchProgress({ completed: 0, total: entries.length })

    try {
      await translateBatch({
        entries: entries.map((e) => ({
          key: e.key,
          sourceText: e.values[sourceLocale] ?? '',
          comment: catalog.document.strings[e.key]?.comment,
        })),
        sourceLocale,
        targetLocale: locale,
        baseUrl: ollamaUrl,
        model,
        signal: abort.signal,
        onProgress: (completed, total, key, translation) => {
          setBatchProgress({ completed, total })
          if (translation) {
            updateTranslation(key, locale, translation)
            updateTranslationState(key, locale, 'needs_review')
          }
        },
      })
    } catch {
      // abort or error
    } finally {
      setBatchTranslating(false)
      setBatchProgress(null)
      batchAbortRef.current = null
    }
  }, [catalog, sourceLocale, locale, ollamaUrl, model, batchTranslating, updateTranslation, updateTranslationState])

  const handleCancelBatch = useCallback(() => {
    batchAbortRef.current?.abort()
  }, [])

  if (!catalog) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Filter toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5">
        <Select
          value={stateFilter}
          onValueChange={(value) => updateFilterParams({ stateFilter: value as StateFilter })}
        >
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
          onValueChange={(value) => updateFilterParams({ extractionFilter: value as ExtractionFilter })}
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
          onValueChange={(value) => updateFilterParams({ translatableFilter: value as TranslatableFilter })}
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

        <Select
          value={commentFilter}
          onValueChange={(value) => updateFilterParams({ commentFilter: value as CommentFilter })}
        >
          <SelectTrigger size="sm" className="h-6 min-w-32 text-xs">
            <SelectValue placeholder="All comments">{commentFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {commentOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={searchQuery}
          onChange={(e) => updateFilterParams({ searchQuery: e.target.value })}
          placeholder="Filter keys..."
          className="h-6 max-w-48 text-xs"
        />
        <span className="ml-auto text-[11px] text-muted-foreground">
          {totalEntries} of {visibleEntryCount} entries
        </span>

        {/* AI Translate All Missing */}
        {isConnected && locale !== sourceLocale && (
          batchTranslating ? (
            <div className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin text-violet-500" />
              <span className="text-[11px] text-muted-foreground">
                {batchProgress ? `${batchProgress.completed}/${batchProgress.total}` : 'Starting…'}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCancelBatch}
                title="Cancel"
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : missingCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
              onClick={handleBatchTranslate}
            >
              <Sparkles className="size-3.5" strokeWidth={1.5} />
              Translate {missingCount} missing
            </Button>
          ) : null
        )}
      </div>

      {/* Translation table */}
      <div className="min-h-0 flex-1 p-3">
        <TranslationTable
          rows={rows}
          sourceLocale={sourceLocale ?? 'N/A'}
          locale={locale}
          scrollToKey={pendingScrollKey}
          onScrollToKeyHandled={handleVirtualScrollDone}
          onValueChange={handleValueChange}
          onCommentChange={handleCommentChange}
          onStateChange={handleStateChange}
          onShouldTranslateChange={handleShouldTranslateChange}
          onAiTranslate={isConnected && locale !== sourceLocale ? handleAiTranslate : undefined}
          aiTranslatingKeys={aiTranslatingKeys}
        />
      </div>
    </div>
  )
}
