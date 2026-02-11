import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { Pagination } from '@/components/pagination.tsx'
import { TranslationTable } from '@/components/translation-table.tsx'
import type { TranslationRow } from '@/components/translation-table.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { Input } from '@/components/ui/input.tsx'
import { LanguagePicker } from '@/components/language-picker.tsx'
import { useCatalog } from '@/lib/catalog-context.tsx'
import type { TranslationState, ExtractionState, CatalogEntry } from '@/lib/xcstrings.ts'
import { cn } from '@/lib/utils.ts'

const PAGE_SIZE = 15

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
): boolean {
  // Translatable filter
  if (translatableFilter === 'yes' && !entry.shouldTranslate) return false
  if (translatableFilter === 'no' && entry.shouldTranslate) return false

  // Extraction state filter
  if (extractionFilter !== 'all') {
    const target = extractionFilter === 'stale_key' ? 'stale' : extractionFilter
    if (entry.extractionState !== target) return false
  }

  // Per-locale state filter
  if (stateFilter !== 'all') {
    const localeState = entry.states[locale]
    if (stateFilter === 'untranslated') {
      // "untranslated" = no value and state is not "translated"
      const val = entry.values[locale] ?? ''
      if (val.length > 0 || localeState === 'translated') return false
    } else {
      if (localeState !== stateFilter) return false
    }
  }

  // Text search
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    const keyMatch = entry.key.toLowerCase().includes(q)
    const valueMatch = (entry.values[locale] ?? '').toLowerCase().includes(q)
    const commentMatch = (entry.comment ?? '').toLowerCase().includes(q)
    if (!keyMatch && !valueMatch && !commentMatch) return false
  }

  return true
}

function LocalePage() {
  const { locale } = useParams<{ locale: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const pageFromParams = Number.isNaN(pageParam) ? 1 : pageParam

  const { catalog, catalogLoading, updateTranslation } = useCatalog()

  // Filter state
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [extractionFilter, setExtractionFilter] = useState<ExtractionFilter>('all')
  const [translatableFilter, setTranslatableFilter] = useState<TranslatableFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  if (catalogLoading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-6 py-12 text-sm text-primary">
        <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>Loading catalog…</span>
      </div>
    )
  }

  if (!catalog) {
    return <Navigate to="/" replace />
  }

  if (!locale || !catalog.languages.includes(locale)) {
    return <Navigate to="/" replace />
  }

  // Apply filters to get filtered entries
  const filteredEntries = useMemo(() => {
    if (!locale) return []
    const hasAnyFilter = stateFilter !== 'all' || extractionFilter !== 'all' || translatableFilter !== 'all' || searchQuery.length > 0
    if (!hasAnyFilter) return catalog.entries
    return catalog.entries.filter((entry) =>
      matchesFilters(entry, locale, stateFilter, extractionFilter, translatableFilter, searchQuery),
    )
  }, [catalog.entries, locale, stateFilter, extractionFilter, translatableFilter, searchQuery])

  const totalEntries = filteredEntries.length
  const totalUnfiltered = catalog.entries.length
  const pageCount = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE))
  const currentPage = Math.min(Math.max(pageFromParams, 1), pageCount)

  useEffect(() => {
    if (currentPage !== pageFromParams) {
      setSearchParams({ page: currentPage.toString() }, { replace: true })
    }
  }, [currentPage, pageFromParams, setSearchParams])

  const sourceLocale = useMemo(() => {
    const documentSource = catalog.document.sourceLanguage

    if (documentSource) {
      const directMatch = catalog.languages.find((lang) => lang === documentSource)
      if (directMatch) {
        return directMatch
      }

      const lowerSource = documentSource.toLowerCase()

      const caseInsensitiveMatch = catalog.languages.find((lang) => lang.toLowerCase() === lowerSource)
      if (caseInsensitiveMatch) {
        return caseInsensitiveMatch
      }

      const prefixMatch = catalog.languages.find((lang) => lang.toLowerCase().startsWith(`${lowerSource}-`))
      if (prefixMatch) {
        return prefixMatch
      }
    }

    return catalog.languages.find((lang) => lang !== locale) ?? catalog.languages[0]
  }, [catalog.document.sourceLanguage, catalog.languages, locale])

  const rows = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    const paginated = filteredEntries.slice(startIndex, startIndex + PAGE_SIZE)

    return paginated.map<TranslationRow>((entry) => {
      const row: TranslationRow = {
        key: entry.key,
        value: entry.values[locale] ?? '',
        state: entry.states[locale],
        extractionState: entry.extractionState,
        shouldTranslate: entry.shouldTranslate,
      }

      if (sourceLocale) {
        row.sourceValue = entry.values[sourceLocale] ?? ''
      }

      if (typeof entry.comment === 'string' && entry.comment.length > 0) {
        row.comment = entry.comment
      }

      return row
    })
  }, [filteredEntries, currentPage, locale, sourceLocale])

  const handleLanguageChange = (nextLocale: string) => {
    if (!nextLocale) return
    navigate({ pathname: `/locale/${nextLocale}`, search: '?page=1' })
  }

  const handlePageChange = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), pageCount)
    setSearchParams({ page: safePage.toString() }, { replace: true })
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-lg sm:text-xl">Editing locale: {locale}</CardTitle>
            <CardDescription>
              Showing keys {1 + (currentPage - 1) * PAGE_SIZE} –
              {Math.min(currentPage * PAGE_SIZE, totalEntries)} of {totalEntries} total entries.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit self-start text-xs">
            Source reference: {sourceLocale ?? '—'}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[2fr,1fr]">
          <div className="space-y-3">
            <LanguagePicker
              languages={catalog.languages}
              value={locale}
              onSelect={handleLanguageChange}
              label="Jump to another locale"
              placeholder="Type to find locales"
            />
            <p className="text-xs text-muted-foreground">
              Use the fuzzy combobox above to switch locales instantly. Press <kbd>Enter</kbd> to confirm or move with
              the arrow keys while the list is open.
            </p>
          </div>
          <div className="space-y-2 rounded-xl border border-dashed border-border/60 bg-muted/10 p-4 text-xs text-muted-foreground">
            <div className="flex items-center justify-between text-sm text-foreground">
              <span>Locale</span>
              <span className="font-semibold">{locale}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Source locale</span>
              <span className="font-medium text-foreground/80">{sourceLocale ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Entries in view</span>
              <span className="font-medium text-foreground/80">{rows.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Catalog languages</span>
              <span className="font-medium text-foreground/80">{catalog.languages.length}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate('/translate')}
            >
              Back to overview
            </Button>
          </div>
        </CardContent>
      </Card>

      <TranslationTable
        rows={rows}
        sourceLocale={sourceLocale ?? 'N/A'}
        locale={locale}
        onValueChange={(key, value) => updateTranslation(key, locale, value)}
      />

      <Pagination page={currentPage} pageCount={pageCount} onPageChange={handlePageChange} />
    </div>
  )
}

export default LocalePage
