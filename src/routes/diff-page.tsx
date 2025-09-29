import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { useCatalog } from '../lib/catalog-context.tsx'
import { collectLanguages, resolveLocaleValue } from '../lib/xcstrings.ts'
import { buttonVariants } from '../components/ui/button.tsx'

interface DiffChange {
  locale: string
  previous: string
  current: string
}

interface DiffEntry {
  key: string
  comment?: string
  changes: DiffChange[]
}

function groupDifferences(catalog: ReturnType<typeof useCatalog>['catalog']): DiffEntry[] {
  if (!catalog) {
    return []
  }

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

    if (!currentEntry && !originalEntry) {
      continue
    }

    const changes: DiffChange[] = []

    for (const locale of languages) {
      const previousValue = originalEntry
        ? resolveLocaleValue(originalEntry, locale, catalog.originalDocument.sourceLanguage, key)
        : ''
      const currentValue = currentEntry
        ? resolveLocaleValue(currentEntry, locale, catalog.document.sourceLanguage, key)
        : ''

      if (previousValue !== currentValue) {
        changes.push({ locale, previous: previousValue, current: currentValue })
      }
    }

    if (changes.length > 0) {
      diffEntries.push({
        key,
        comment: currentEntry?.comment ?? originalEntry?.comment,
        changes,
      })
    }
  }

  return diffEntries.sort((a, b) => a.key.localeCompare(b.key))
}

function DiffPage() {
  const { catalog } = useCatalog()

  if (!catalog) {
    return <Navigate to="/" replace />
  }

  const diffEntries = useMemo(() => groupDifferences(catalog), [catalog])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Changes overview</CardTitle>
          <CardDescription>
            {diffEntries.length > 0
              ? `Detected ${diffEntries.length} key${diffEntries.length === 1 ? '' : 's'} with changes.`
              : 'No differences between the original file and your edits.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              Back to home
            </Link>
            {catalog.languages.length > 0 && (
              <Link
                to={`/locale/${catalog.languages[0]}`}
                className={buttonVariants({ variant: 'ghost' })}
              >
                Go to first language
              </Link>
            )}
          </div>
          {diffEntries.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Key</TableHead>
                    <TableHead className="w-32">Locale</TableHead>
                    <TableHead>Previous value</TableHead>
                    <TableHead>Current value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffEntries.map((entry) =>
                    entry.changes.map((change, index) => (
                      <TableRow key={`${entry.key}-${change.locale}`} className="align-top">
                        {index === 0 && (
                          <TableCell rowSpan={entry.changes.length} className="align-top">
                            <div className="font-medium">{entry.key}</div>
                            {entry.comment && (
                              <p className="mt-1 text-xs text-muted-foreground">{entry.comment}</p>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-xs sm:text-sm">{change.locale}</TableCell>
                        <TableCell>
                          <div className="rounded-md border border-border-muted bg-muted/40 p-2 text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
                            {change.previous || <span className="text-muted-foreground/70">(empty)</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="rounded-md border border-border bg-background p-2 text-xs sm:text-sm whitespace-pre-wrap">
                            {change.current || <span className="text-muted-foreground/70">(empty)</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-md border border-border-muted bg-muted/40 p-6 text-sm text-muted-foreground">
              Nothing to compare right now. Make some changes and come back to see the diff.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default DiffPage
