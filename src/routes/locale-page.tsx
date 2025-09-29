import { useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { Pagination } from '@/components/pagination.tsx'
import { TranslationTable } from '@/components/translation-table.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { LanguagePicker } from '@/components/language-picker.tsx'
import { useCatalog } from '@/lib/catalog-context.tsx'

const PAGE_SIZE = 15

function LocalePage() {
  const { locale } = useParams<{ locale: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const pageFromParams = Number.isNaN(pageParam) ? 1 : pageParam

  const { catalog, updateTranslation } = useCatalog()

  if (!catalog) {
    return <Navigate to="/" replace />
  }

  if (!locale || !catalog.languages.includes(locale)) {
    return <Navigate to="/" replace />
  }

  const totalEntries = catalog.entries.length
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
    const paginated = catalog.entries.slice(startIndex, startIndex + PAGE_SIZE)

    return paginated.map((entry) => ({
      key: entry.key,
      value: entry.values[locale] ?? '',
      sourceValue: sourceLocale ? entry.values[sourceLocale] ?? '' : undefined,
      comment: entry.comment,
    }))
  }, [catalog.entries, currentPage, locale, sourceLocale])

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
      <Card>
        <CardHeader>
          <CardTitle>Editing language: {locale}</CardTitle>
          <CardDescription>
            Showing keys {1 + (currentPage - 1) * PAGE_SIZE} –
            {Math.min(currentPage * PAGE_SIZE, totalEntries)} of {totalEntries}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[2fr,1fr]">
          <LanguagePicker
            languages={catalog.languages}
            value={locale}
            onSelect={handleLanguageChange}
            label="Change language"
          />
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
