import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx'
import { Badge } from '../components/ui/badge.tsx'
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
      const diffEntry: DiffEntry = {
        key,
        changes,
      }

      const comment = currentEntry?.comment ?? originalEntry?.comment
      if (typeof comment === 'string' && comment.length > 0) {
        diffEntry.comment = comment
      }

      diffEntries.push(diffEntry)
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
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">Changes overview</CardTitle>
            <CardDescription>
              {diffEntries.length > 0
                ? `Detected ${diffEntries.length} key${diffEntries.length === 1 ? '' : 's'} with changes.`
                : 'No differences between the original file and your edits.'}
            </CardDescription>
          </div>
          <Badge variant={diffEntries.length > 0 ? 'default' : 'secondary'} className="w-fit text-xs">
            {diffEntries.length > 0 ? `${diffEntries.length} updated` : 'Clean'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              Back to home
            </Link>
            {catalog.languages.length > 0 && (
              <Link to={`/locale/${catalog.languages[0]}`} className={buttonVariants({ variant: 'ghost' })}>
                Go to first language
              </Link>
            )}
          </div>
          {diffEntries.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border/60">
                    <TableHead className="w-72 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                      Key
                    </TableHead>
                    <TableHead className="w-32 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                      Locale
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                      Previous value
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                      Current value
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffEntries.map((entry) =>
                    entry.changes.map((change, index) => (
                      <TableRow key={`${entry.key}-${change.locale}`} className="align-top last:border-0">
                        {index === 0 && (
                          <TableCell rowSpan={entry.changes.length} className="min-w-0 align-top">
                            <div className="font-medium text-foreground">{entry.key}</div>
                            {entry.comment && (
                              <p className="mt-1 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                                {entry.comment}
                              </p>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-xs sm:text-sm">{change.locale}</TableCell>
                        <TableCell>
                          <div className="rounded-md bg-muted/20 p-3 text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
                            {change.previous || <span className="text-muted-foreground/70">(empty)</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="rounded-md border border-primary/30 bg-background p-3 text-xs sm:text-sm whitespace-pre-wrap">
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
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
              Nothing to compare right now. Make some changes and come back to see the diff.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default DiffPage
