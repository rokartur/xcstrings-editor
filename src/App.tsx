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
              <span className="inline-flex size-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-bold text-primary">
                XC
              </span>
              <span className="truncate">XCStrings Editor</span>
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
