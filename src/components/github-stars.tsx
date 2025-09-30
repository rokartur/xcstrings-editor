import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const GITHUB_REPO = 'rokartur/xcstrings-editor'
const STORAGE_KEY = 'xcstrings-editor:github-stars'
const FETCH_TIMEOUT_MS = 5000

type GithubRepoResponse = {
  stargazers_count?: number
}

function readCachedStars(): number | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  } catch (error) {
    console.error('Failed to read cached GitHub stars', error)
    return null
  }
}

function cacheStars(count: number) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(count))
  } catch (error) {
    console.error('Failed to cache GitHub stars', error)
  }
}

export function GithubStarsButton({ className }: { className?: string }) {
  const [stars, setStars] = useState<number | null>(() => readCachedStars())

  useEffect(() => {
    if (stars !== null) {
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    async function loadStars() {
      try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
          signal: controller.signal,
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'xcstrings-editor',
          },
        })

        if (!response.ok) {
          return
        }

        const data: GithubRepoResponse = await response.json()
        if (typeof data.stargazers_count === 'number') {
          setStars(data.stargazers_count)
          cacheStars(data.stargazers_count)
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        console.error('Failed to fetch GitHub stars', error)
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    loadStars()

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [stars])

  const formattedStars = useMemo(() => {
    if (stars === null) {
      return '—'
    }
    return new Intl.NumberFormat('en-US').format(stars)
  }, [stars])

  return (
    <Button
      asChild
      variant="outline"
      className={cn('gap-2 px-3 font-medium', className)}
      aria-label={`${formattedStars} GitHub stars`}
    >
      <a
        href={`https://github.com/${GITHUB_REPO}`}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center gap-2"
      >
        <Star className="size-4 text-yellow-500" strokeWidth={1.8} aria-hidden="true" />
        <span className="tabular-nums">{formattedStars}</span>
        <span className="text-muted-foreground">stars</span>
      </a>
    </Button>
  )
}
