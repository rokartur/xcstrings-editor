import { useMemo, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'

import { Button, buttonVariants } from './components/ui/button.tsx'
import { Badge } from './components/ui/badge.tsx'
import { GithubStarsButton } from './components/github-stars.tsx'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog.tsx'
import { useCatalog } from './lib/catalog-context.tsx'
import { useTheme } from './lib/theme-context.tsx'
import { Moon, Sparkles, Sun } from 'lucide-react'

function App() {
  const navigate = useNavigate()
  const { catalog, resetCatalog, exportContent } = useCatalog()
  const { theme, toggleTheme } = useTheme()
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)

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
    setConfirmResetOpen(true)
  }

  const handleConfirmReset = () => {
    setConfirmResetOpen(false)
    resetCatalog()
    navigate('/')
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 -top-48 h-64 rounded-full bg-[radial-gradient(circle_at_top,_hsl(var(--primary))/25%,_transparent_60%)] blur-3xl" />
        <div className="absolute inset-y-0 right-[-20%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,_hsl(var(--accent))/18%,_transparent_60%)] blur-3xl" />
      </div>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-1 items-center gap-3 overflow-hidden">
            <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <svg
                id="Translate language icon"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="size-10 text-foreground transition-colors"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M13.7149 14.5214C13.9649 14.5604 14.2389 14.5694 14.6269 14.5694C14.7739 14.5694 14.9729 14.5344 15.1809 14.4884L14.4559 13.0684L13.7149 14.5214Z"
                  fill="currentColor"
                ></path>
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M17.247 16.888C17.138 16.944 17.021 16.97 16.907 16.97C16.634 16.97 16.371 16.821 16.238 16.561L15.882 15.862C15.472 15.966 15.029 16.071 14.627 16.071C13.971 16.071 13.517 16.038 13.012 15.899L12.675 16.561C12.487 16.93 12.033 17.075 11.666 16.888C11.297 16.7 11.15 16.248 11.339 15.879L13.788 11.079C14.044 10.577 14.868 10.577 15.124 11.079L17.574 15.879C17.763 16.248 17.616 16.7 17.247 16.888ZM10.272 14.387C10.18 14.307 10.087 14.216 9.994 14.125C9.341 14.575 8.566 14.977 7.613 15.268C7.54 15.289 7.466 15.3 7.393 15.3C7.073 15.3 6.775 15.092 6.677 14.769C6.556 14.373 6.779 13.953 7.175 13.832C7.912 13.607 8.525 13.307 9.04 12.966C8.597 12.284 8.27 11.532 8.08 10.747C7.982 10.345 8.229 9.94 8.632 9.842C9.035 9.743 9.44 9.992 9.538 10.394C9.673 10.95 9.901 11.483 10.196 11.974C11.037 11.04 11.403 10.036 11.557 9.39H7.093C6.679 9.39 6.343 9.054 6.343 8.64C6.343 8.226 6.679 7.89 7.093 7.89H9.639V7.781C9.639 7.367 9.975 7.031 10.389 7.031C10.803 7.031 11.139 7.367 11.139 7.781V7.89H12.396C12.396 7.89 12.4 7.89 12.403 7.89H14.042C14.456 7.89 14.792 8.226 14.792 8.64C14.792 9.054 14.456 9.39 14.042 9.39H13.095C12.994 9.935 12.795 10.566 12.559 11.085C12.268 11.724 11.815 12.454 11.15 13.148C11.184 13.179 11.221 13.225 11.254 13.254C11.567 13.526 11.601 13.999 11.33 14.312C11.182 14.483 10.973 14.571 10.763 14.571C10.589 14.571 10.414 14.51 10.272 14.387ZM16.218 2.5H7.783C4.623 2.5 2.5 4.723 2.5 8.031V15.97C2.5 19.278 4.623 21.5 7.783 21.5H16.217C19.377 21.5 21.5 19.278 21.5 15.97V8.031C21.5 4.723 19.377 2.5 16.218 2.5Z"
                  fill="currentColor"
                ></path>
              </svg>
            </Link>
            <GithubStarsButton />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="border border-border/60 bg-background/60"
            >
              {theme === 'dark' ? (
                <Sun className="size-5" strokeWidth={1.6} aria-hidden="true" />
              ) : (
                <Moon className="size-5" strokeWidth={1.6} aria-hidden="true" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {catalog && (
              <div className="hidden items-center gap-2 md:flex">
                <span className="flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                  <span className="truncate">{catalog.fileName}</span>
                  <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
                    {catalog.languages.length} locales
                  </Badge>
                  {dirtyCount > 0 && <Badge variant="outline">{dirtyCount} dirty</Badge>}
                </span>
              </div>
            )}
            {catalog && (
              <>
                <Link
                  to="/diff"
                  className={buttonVariants({ variant: dirtyCount > 0 ? 'default' : 'outline', size: 'sm' })}
                >
                  View diff
                </Link>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  Export
                </Button>
                <Button variant="destructive" size="sm" onClick={handleReset}>
                  Reset
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <section className="mb-8 flex flex-col gap-4 rounded-3xl border border-border/40 bg-card/70 p-6 shadow-lg shadow-primary/5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs">
              <Sparkles className="size-3" aria-hidden="true" />
              New fuzzy locale picker
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Translate Xcode catalogs faster</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Import .xcstrings files, edit translations with instant fuzzy search, and publish polished updates straight to GitHub without leaving your browser.
            </p>
          </div>
          {catalog ? (
            <div className="grid gap-2 rounded-2xl border border-border/60 bg-background/60 p-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{catalog.fileName}</span>
                <Badge variant="outline">{catalog.languages.length} locales</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span>Pending keys</span>
                <Badge variant={dirtyCount > 0 ? 'default' : 'outline'}>{dirtyCount}</Badge>
              </div>
            </div>
          ) : (
            <div className="grid gap-2 rounded-2xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
              <span>No catalog loaded yet.</span>
              <span>Upload a file or connect to GitHub to get started.</span>
            </div>
          )}
        </section>
        <Outlet />
      </main>
      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear current catalog?</DialogTitle>
            <DialogDescription>
              This action removes the loaded translations and any pending changes from the editor. You can re-import the
              file again later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Keep editing
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={handleConfirmReset} autoFocus>
              Clear catalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
