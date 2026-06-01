import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type PaginationProps = {
  /** Total number of items being paginated. */
  totalItems: number
  /** Items per page. */
  pageSize: number
  /** Current page (1-indexed). */
  page: number
  /** Called with the next page number when the user navigates. */
  onPageChange: (page: number) => void
  /** Optional label for the items being paginated (e.g. "ads", "images"). */
  itemLabel?: string
  className?: string
}

/**
 * Compact pagination control: prev / next + a small window of page numbers
 * around the current page. Always renders a result summary so it's still
 * useful when there's only a single page (in that case nav buttons are hidden).
 */
export function Pagination({
  totalItems,
  pageSize,
  page,
  onPageChange,
  itemLabel = 'items',
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(totalItems, safePage * pageSize)

  // Build a small window of pages around the current one. We always include
  // the first and last page, with an ellipsis when there's a gap.
  const pageNumbers = useMemo(() => buildPageWindow(safePage, totalPages), [safePage, totalPages])

  if (totalItems === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 pt-1', className)}>
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start.toLocaleString()}</span>-
        <span className="font-medium text-foreground">{end.toLocaleString()}</span> of{' '}
        <span className="font-medium text-foreground">{totalItems.toLocaleString()}</span> {itemLabel}
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </Button>

          <div className="hidden items-center gap-1 sm:flex">
            {pageNumbers.map((entry, idx) =>
              entry === 'ellipsis' ? (
                <span key={`gap-${idx}`} className="px-1.5 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={entry}
                  type="button"
                  size="sm"
                  variant={entry === safePage ? 'default' : 'outline'}
                  className="min-w-8 px-2"
                  onClick={() => onPageChange(entry)}
                  aria-current={entry === safePage ? 'page' : undefined}
                >
                  {entry}
                </Button>
              ),
            )}
          </div>

          <span className="px-2 text-xs text-muted-foreground sm:hidden">
            Page {safePage} / {totalPages}
          </span>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function buildPageWindow(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const window: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) window.push('ellipsis')
  for (let i = start; i <= end; i++) window.push(i)
  if (end < total - 1) window.push('ellipsis')

  window.push(total)
  return window
}
