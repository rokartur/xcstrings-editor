import { useCallback, useState, type ChangeEvent } from 'react'

import { Button } from './ui/button'
import { Input } from './ui/input'

interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

function createRange(page: number, pageCount: number) {
  const maxButtons = 7
  const pages: number[] = []

  if (pageCount <= maxButtons) {
    for (let i = 1; i <= pageCount; i += 1) {
      pages.push(i)
    }
    return pages
  }

  const start = Math.max(1, page - 2)
  const end = Math.min(pageCount, page + 2)

  for (let i = start; i <= end; i += 1) {
    pages.push(i)
  }

  if (!pages.includes(1)) {
    pages.unshift(1)
  }

  if (!pages.includes(pageCount)) {
    pages.push(pageCount)
  }

  return pages
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const [goToValue, setGoToValue] = useState('')

  const handleGoTo = useCallback(() => {
    const parsed = Number.parseInt(goToValue, 10)
    if (Number.isNaN(parsed)) return
    const safe = Math.min(Math.max(parsed, 1), pageCount)
    onPageChange(safe)
    setGoToValue('')
  }, [goToValue, pageCount, onPageChange])

  if (pageCount <= 1) {
    return null
  }

  const pages = createRange(page, pageCount)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            handleGoTo()
          }}
        >
          <Input
            type="number"
            min={1}
            max={pageCount}
            value={goToValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setGoToValue(e.target.value)}
            placeholder="#"
            className="h-7 w-16 px-2 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!goToValue.trim()}
          >
            Go
          </Button>
        </form>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        {pages.map((pageNumber, index) => {
          const isCurrent = pageNumber === page
          const previousPage = index > 0 ? pages[index - 1] : undefined
          const isEllipsis = previousPage !== undefined && pageNumber - previousPage > 1

          return (
            <div key={`${pageNumber}-${index}`} className="flex items-center">
              {isEllipsis && <span className="px-1 text-sm text-muted-foreground">…</span>}
              <Button
                variant={isCurrent ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNumber)}
                disabled={isCurrent}
              >
                {pageNumber}
              </Button>
            </div>
          )
        })}
        <Button
          variant="outline"
          size="sm"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
