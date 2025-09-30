import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.tsx'
import { Textarea } from './ui/textarea.tsx'

export interface TranslationRow {
  key: string
  value: string
  sourceValue?: string
  comment?: string
}

interface TranslationTableProps {
  rows: TranslationRow[]
  locale: string
  sourceLocale: string
  onValueChange: (key: string, value: string) => void
}

export function TranslationTable({ rows, locale, sourceLocale, onValueChange }: TranslationTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm shadow-primary/5">
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
            <TableRow key={row.key} className="align-top last:border-0 hover:bg-muted/30">
              <TableCell className="space-y-2">
                <div className="font-medium text-foreground">{row.key}</div>
                {row.comment && <p className="rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">{row.comment}</p>}
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
                  value={row.value}
                  onChange={(event) => onValueChange(row.key, event.target.value)}
                  placeholder="Type the translated copy here"
                  className="min-h-[96px]"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">No entries on this page.</div>
      )}
    </div>
  )
}
