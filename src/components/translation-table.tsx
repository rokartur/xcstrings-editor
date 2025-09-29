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
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-64">Key</TableHead>
            <TableHead>{`Source value (${sourceLocale})`}</TableHead>
            <TableHead className="w-[40%]">{locale}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} className="align-top">
              <TableCell>
                <div className="font-medium">{row.key}</div>
                {row.comment && <p className="mt-1 text-xs text-muted-foreground">{row.comment}</p>}
              </TableCell>
              <TableCell>
                {row.sourceValue !== undefined ? (
                  row.sourceValue.length > 0 ? (
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{row.sourceValue}</p>
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
