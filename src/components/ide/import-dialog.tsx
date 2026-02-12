import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { FileUploader } from '@/components/file-uploader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { useCatalog } from '@/lib/catalog-context'
import type { CatalogSource } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import { cn } from '@/lib/utils'
import { parseXcStrings } from '@/lib/xcstrings'
import { fetchGithubFileContent, listGithubXcstrings, parseGithubRepo } from '@/lib/github'
import { toast } from 'sonner'

type CatalogLoadResult = {
  fileName: string
  content: string
  originalContent?: string
  source?: CatalogSource
}

type CatalogOption = {
  key: string
  label: string
  origin: 'upload' | 'github'
  description?: string
  load: () => Promise<CatalogLoadResult>
}

type UploadedFile = {
  fileName: string
  content: string
}

export function ImportDialog() {
  const { importDialogOpen, setImportDialogOpen, setSidebarPanel, sidebarPanel, sidebarVisible } = useEditorStore()
  const {
    catalog,
    catalogLoading,
    storeCatalog,
    setCatalogFromFile,
    storedCatalogs,
    loadCatalogById,
    removeCatalog,
  } = useCatalog()

  const [mode, setMode] = useState<'upload' | 'github'>('upload')
  const [githubAdvancedOpen, setGithubAdvancedOpen] = useState(false)
  const [savedCatalogsOpen, setSavedCatalogsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [githubWarning, setGithubWarning] = useState<string | null>(null)
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([])
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [githubBranch, setGithubBranch] = useState('')
  const [findMode, setFindMode] = useState<'manual' | 'auto'>('manual')
  const autoFetchRecord = useRef<string | null>(null)

  // Close dialog when catalog loads
  const prevCatalogRef = useRef(catalog)
  useEffect(() => {
    if (!prevCatalogRef.current && catalog) {
      setImportDialogOpen(false)
      // Ensure the explorer is visible after a successful import,
      // but avoid toggling the sidebar off when it's already open.
      if (!(sidebarVisible && sidebarPanel === 'explorer')) {
        setSidebarPanel('explorer')
      }
    }
    prevCatalogRef.current = catalog
  }, [catalog, setImportDialogOpen, setSidebarPanel, sidebarPanel, sidebarVisible])

  const openCatalog = useCallback(
    async (option: CatalogOption) => {
      setError(null)
      setIsLoading(true)
      try {
        const { fileName, content, originalContent, source } = await option.load()
        const optionsForCatalog: { catalogId?: string; source?: CatalogSource } = {}
        if (source) optionsForCatalog.source = source
        setCatalogFromFile(fileName, content, originalContent, optionsForCatalog)
        setSelectedOptionKey(option.key)
        toast.success(`Loaded ${option.label}`)
        setCatalogOptions((prev) => prev.filter((c) => c.key !== option.key))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error while loading the file.'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [setCatalogFromFile],
  )

  const handleFilesLoaded = useCallback(
    async (files: UploadedFile[]) => {
      if (!files.length) return
      setError(null)
      setGithubWarning(null)

      const nextOptions: CatalogOption[] = []
      const failures: string[] = []

      files.forEach((file) => {
        try {
          parseXcStrings(file.content)
          nextOptions.push({
            key: `upload::${file.fileName.toLowerCase()}::${Math.random().toString(36).slice(2)}`,
            label: file.fileName,
            origin: 'upload',
            description: 'Uploaded manually',
            load: async () => ({
              fileName: file.fileName,
              content: file.content,
              originalContent: file.content,
              source: { type: 'upload' },
            }),
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Invalid .xcstrings file.'
          failures.push(`${file.fileName}: ${message}`)
        }
      })

      if (nextOptions.length > 0) {
        const shouldAutoOpen = !catalog && nextOptions.length === 1
        setCatalogOptions((prev) => [...prev, ...nextOptions])
        if (!shouldAutoOpen) toast.success(`Added ${nextOptions.length} file${nextOptions.length === 1 ? '' : 's'}`)
        if (shouldAutoOpen && nextOptions[0]) {
          await openCatalog(nextOptions[0])
        }
      }

      if (failures.length > 0) setError(failures.join(' '))
    },
    [catalog, openCatalog],
  )

  const handleImportAll = useCallback(async () => {
    if (catalogOptions.length === 0) return

    setError(null)
    setGithubWarning(null)
    setIsLoading(true)

    const successfulKeys = new Set<string>()
    const failures: string[] = []
    let importedCount = 0

    try {
      for (let index = 0; index < catalogOptions.length; index += 1) {
        const option = catalogOptions[index]!

        try {
          const { fileName, content, originalContent, source } = await option.load()

          // Validate content early so we can show meaningful errors
          parseXcStrings(content)

          if (!catalog && importedCount === 0) {
            // Open first imported catalog for immediate editing
            const optionsForCatalog: { source?: CatalogSource } = {}
            if (source) optionsForCatalog.source = source
            setCatalogFromFile(fileName, content, originalContent, optionsForCatalog)
          } else {
            storeCatalog(fileName, content, originalContent, source)
          }

          successfulKeys.add(option.key)
          importedCount += 1
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error while importing.'
          failures.push(`${option.label}: ${message}`)
        }
      }

      if (importedCount > 0) {
        setCatalogOptions((prev) => prev.filter((o) => !successfulKeys.has(o.key)))
        setSelectedOptionKey(null)
        toast.success(`Imported ${importedCount} catalog${importedCount === 1 ? '' : 's'}`)
      }

      if (failures.length > 0) {
        setError(failures.join(' '))
      }
    } finally {
      setIsLoading(false)
    }
  }, [catalog, catalogOptions, setCatalogFromFile, storeCatalog])

  const executeGithubFetch = useCallback(async () => {
    setError(null)
    setGithubWarning(null)

    const reference = parseGithubRepo(githubUrl)
    if (!reference) {
      setError('Invalid GitHub repository reference.')
      return
    }

    const branchOverride = githubBranch.trim()
    const effectiveReference = branchOverride
      ? { ...reference, branch: branchOverride }
      : reference

    setIsLoading(true)
    try {
      const result = await listGithubXcstrings(effectiveReference)
      if (result.files.length === 0) {
        setError('No .xcstrings files found in the specified repository.')
        return
      }

      const prefix = `github::${result.reference.owner}/${result.reference.repo}@${result.reference.branch}::`

      const options: CatalogOption[] = result.files.map((file) => ({
        key: `${prefix}${file.path}`,
        label: file.relativePath,
        origin: 'github',
        description: `${result.reference.owner}/${result.reference.repo}@${result.reference.branch}/${file.path}`,
        load: async () => {
          const content = await fetchGithubFileContent(result.reference, file.path)
          return {
            fileName: file.relativePath,
            content,
            originalContent: content,
            source: {
              type: 'github',
              owner: result.reference.owner,
              repo: result.reference.repo,
              branch: result.reference.branch,
              path: file.path,
              sha: file.sha,
            },
          }
        },
      }))

      setCatalogOptions((prev) => {
        const filtered = prev.filter((o) => !o.key.startsWith(prefix))
        return [...filtered, ...options]
      })

      const shouldAutoOpen = !catalog && options.length === 1
      if (!shouldAutoOpen) toast.success(`Found ${options.length} .xcstrings file${options.length === 1 ? '' : 's'}.`)
      if (result.truncated) {
        setGithubWarning('GitHub returned a truncated file list.')
      }
      if (shouldAutoOpen && options[0]) {
        await openCatalog(options[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query GitHub.')
    } finally {
      setIsLoading(false)
    }
  }, [catalog, githubBranch, githubUrl, openCatalog])

  const handleGithubSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      await executeGithubFetch()
    },
    [executeGithubFetch],
  )

  const trimmedGithubUrl = githubUrl.trim()

  useEffect(() => {
    if (!importDialogOpen) return
    if (mode !== 'github') return
    if (findMode !== 'auto') return
    if (!trimmedGithubUrl) return
    if (autoFetchRecord.current === trimmedGithubUrl) return

    const timeoutId = window.setTimeout(() => {
      autoFetchRecord.current = trimmedGithubUrl
      void executeGithubFetch()
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [executeGithubFetch, findMode, mode, trimmedGithubUrl, importDialogOpen])

  const formattedStoredCatalogs = useMemo(
    () =>
      storedCatalogs.map((item) => ({
        ...item,
        formattedLastOpened: new Date(item.lastOpened).toLocaleString(),
      })),
    [storedCatalogs],
  )

  const currentCatalogId = catalog?.id ?? null

  return (
    <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Import catalog</DialogTitle>
          <DialogDescription>
            Import <code>.xcstrings</code> from disk or GitHub.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-100px)] px-6 pb-6">
          <div className="grid gap-4 pt-2">
            {catalogLoading && (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-6 py-6 text-sm text-primary">
                <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Parsing catalog...</span>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {githubWarning && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                {githubWarning}
              </div>
            )}

            {/* Source picker */}
            <div className="flex w-full overflow-hidden rounded-md border border-border/60 bg-muted/10 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setMode('upload')
                  setError(null)
                }}
                className={cn(
                  'flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === 'upload'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('github')
                  setError(null)
                }}
                className={cn(
                  'flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === 'github'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                GitHub
              </button>
            </div>

            {/* Source content */}
            {mode === 'upload' && (
              <div className="pt-1">
                <FileUploader variant="minimal" onFilesLoaded={handleFilesLoaded} disabled={isLoading} multiple />
              </div>
            )}

            {mode === 'github' && (
              <div className="space-y-3 pt-1">
                <form className="space-y-3" onSubmit={handleGithubSubmit}>
                  <Input
                    value={githubUrl}
                    onChange={(e) => {
                      setGithubUrl(e.target.value)
                      autoFetchRecord.current = null
                    }}
                    placeholder="owner/repo or GitHub URL"
                    disabled={isLoading}
                  />

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={isLoading || !trimmedGithubUrl}>
                        {isLoading ? 'Finding…' : 'Find files'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setGithubUrl('')
                          autoFetchRecord.current = null
                          setError(null)
                          setGithubWarning(null)
                        }}
                        disabled={isLoading || !trimmedGithubUrl}
                      >
                        Clear
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setGithubAdvancedOpen((v) => !v)}
                      className="h-8 w-fit self-start px-0 text-xs sm:ml-auto"
                      disabled={isLoading}
                    >
                      {githubAdvancedOpen ? 'Hide options' : 'Options'}
                    </Button>
                  </div>
                </form>

                {githubAdvancedOpen && (
                  <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Switch
                        id="auto-find-dialog"
                        checked={findMode === 'auto'}
                        onCheckedChange={(checked) => {
                          setFindMode(checked ? 'auto' : 'manual')
                          autoFetchRecord.current = null
                        }}
                      />
                      <Label htmlFor="auto-find-dialog" className="text-xs font-medium">
                        Auto-fetch
                      </Label>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <Label htmlFor="github-branch" className="text-xs font-medium">
                        Branch
                      </Label>
                      <Input
                        id="github-branch"
                        value={githubBranch}
                        onChange={(e) => {
                          setGithubBranch(e.target.value)
                          autoFetchRecord.current = null
                        }}
                        placeholder="main"
                        disabled={isLoading}
                        className="h-8"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {catalogOptions.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium">Queue</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={handleImportAll} disabled={isLoading || catalogOptions.length === 0}>
                      Import all
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCatalogOptions([])
                        setSelectedOptionKey(null)
                      }}
                      disabled={isLoading}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border/60">
                  {catalogOptions.map((option) => (
                    <div
                      key={option.key}
                      className={cn(
                        'flex flex-col gap-2 border-b border-border/60 px-3 py-2.5 text-sm last:border-b-0 sm:flex-row sm:items-start sm:justify-between',
                        selectedOptionKey === option.key && 'bg-primary/5',
                      )}
                    >
                      <div className="min-w-0 flex-1 sm:pr-2">
                        <div className="flex items-center gap-2">
                          <span className="break-all font-medium leading-snug">{option.label}</span>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {option.origin}
                          </span>
                        </div>
                        {option.description && (
                          <div className="mt-0.5 break-all text-xs text-muted-foreground">
                            {option.description}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <Button
                          size="sm"
                          variant={selectedOptionKey === option.key ? 'default' : 'outline'}
                          onClick={() => openCatalog(option)}
                          disabled={isLoading}
                        >
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCatalogOptions((prev) => prev.filter((o) => o.key !== option.key))
                            setSelectedOptionKey((cur) => (cur === option.key ? null : cur))
                          }}
                          disabled={isLoading}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formattedStoredCatalogs.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setSavedCatalogsOpen((v) => !v)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1 text-left',
                    'hover:bg-accent',
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">Saved catalogs</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {savedCatalogsOpen ? 'Hide' : 'Show'}
                  </span>
                </button>

                {savedCatalogsOpen && (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-lg border border-border/60">
                      {formattedStoredCatalogs.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 border-b border-border/60 p-2 last:border-b-0">
                          <Button
                            variant={currentCatalogId === item.id ? 'default' : 'outline'}
                            className="flex-1 justify-between text-left"
                            onClick={() => loadCatalogById(item.id)}
                            disabled={isLoading}
                          >
                            <div className="flex min-w-0 flex-col items-start">
                              <span className="truncate font-medium">{item.fileName}</span>
                              <span className="text-xs text-muted-foreground">
                                Last opened: {item.formattedLastOpened}
                              </span>
                            </div>
                            {currentCatalogId === item.id && (
                              <span className="ml-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                                Active
                              </span>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeCatalog(item.id)}
                            disabled={isLoading}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
