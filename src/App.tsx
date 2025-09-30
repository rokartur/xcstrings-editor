import { useMemo } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'

import { Button, buttonVariants } from './components/ui/button.tsx'
import { Badge } from './components/ui/badge.tsx'
import { GithubStarsButton } from './components/github-stars.tsx'
import { useCatalog } from './lib/catalog-context.tsx'
import { useTheme } from './lib/theme-context.tsx'
import { Moon, Sun } from 'lucide-react'

function App() {
  const navigate = useNavigate()
  const { catalog, resetCatalog, exportContent } = useCatalog()
  const { theme, toggleTheme } = useTheme()

  const dirtyCount = catalog ? catalog.dirtyKeys.size : 0

  const downloadName = useMemo(() => {
    if (!catalog) return null
    if (!catalog.fileName.endsWith('.xcstrings')) {
      return `${catalog.fileName}-edited.xcstrings`
    }
    const base = catalog.fileName.replace(/\.xcstrings$/i, '')
    return `${base}-edited.xcstrings`
  }, [catalog])

  const handleDownload = () => {
    const exported = exportContent()
    if (!exported) {
      return
    }

    const blob = new Blob([exported.content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = downloadName ?? 'catalog-edited.xcstrings'

    link.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    resetCatalog()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-1 items-center gap-3">
            <Link to="/" className="text-lg font-semibold tracking-tight">
              XCStrings Editor
            </Link>
            {catalog && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="truncate">{catalog.fileName}</span>
                <Badge variant="secondary">{catalog.languages.length} languages</Badge>
                {dirtyCount > 0 && <Badge variant="outline">{dirtyCount} changes</Badge>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <GithubStarsButton />
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="size-5" strokeWidth={1.6} aria-hidden="true" />
              ) : (
                <Moon className="size-5" strokeWidth={1.6} aria-hidden="true" />
              )}
            </Button>
            {catalog && (
              <>
                <Link
                  to="/diff"
                  className={buttonVariants({ variant: dirtyCount > 0 ? 'default' : 'outline' })}
                >
                  View diff
                </Link>
                <Button variant="outline" onClick={handleDownload}>
                  Export
                </Button>
                <Button variant="destructive" onClick={handleReset}>
                  Clear all
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}

export default App
