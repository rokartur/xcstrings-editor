import { Button } from './ui/button.tsx'

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
  if (pageCount <= 1) {
    return null
  }

  const pages = createRange(page, pageCount)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        {pages.map((pageNumber, index) => {
          const isCurrent = pageNumber === page
          const isEllipsis = index > 0 && pageNumber - pages[index - 1] > 1

          return (
            <div key={`${pageNumber}-${index}`} className="flex items-center">
              {isEllipsis && <span className="px-1 text-sm text-muted-foreground">…</span>}
              <Button
                variant={isCurrent ? 'default' : 'ghost'}
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
          variant="ghost"
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
