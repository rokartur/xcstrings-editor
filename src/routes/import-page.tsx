import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CloudUpload, Github } from 'lucide-react'

import { FileUploader } from '../components/file-uploader.tsx'
import { Badge } from '../components/ui/badge.tsx'
import { Button } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { Input } from '../components/ui/input.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx'
import { useCatalog } from '../lib/catalog-context.tsx'
import type { CatalogSource } from '../lib/catalog-context.tsx'
import { parseXcStrings } from '../lib/xcstrings.ts'
import { fetchGithubFileContent, listGithubXcstrings, parseGithubRepo } from '../lib/github.ts'
import { Label } from '@/components/ui/label.tsx'
import { Switch } from '@/components/ui/switch.tsx'

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

function ImportPage() {
  const {
    catalog,
    catalogLoading,
    setCatalogFromFile,
    storedCatalogs,
    loadCatalogById,
    removeCatalog,
  } = useCatalog()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<'upload' | 'github'>(() =>
    searchParams.has('github') ? 'github' : 'upload',
  )
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [githubWarning, setGithubWarning] = useState<string | null>(null)
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([])
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null)
  const [githubUrl, setGithubUrl] = useState(() => searchParams.get('github') ?? '')
  const [findMode, setFindMode] = useState<'manual' | 'auto'>(() =>
    searchParams.get('find') === 'auto' ? 'auto' : 'manual',
  )
  const autoFetchRecord = useRef<string | null>(null)

  // Auto-advance to /configure when catalog loads
  const prevCatalogRef = useRef(catalog)
  useEffect(() => {
    if (!prevCatalogRef.current && catalog) {
      navigate('/configure')
    }
    prevCatalogRef.current = catalog
  }, [catalog, navigate])

  useEffect(() => {
    const githubParam = searchParams.get('github') ?? ''
    const findParam = searchParams.get('find') === 'auto' ? 'auto' : 'manual'
    if (searchParams.has('github')) {
      setMode((current) => (current === 'github' ? current : 'github'))
    }
    setGithubUrl((current) => (current === githubParam ? current : githubParam))
    setFindMode((current) => (current === findParam ? current : findParam))
  }, [searchParams])

  const handleGithubUrlChange = useCallback(
    (value: string) => {
      setGithubUrl(value)
      const params = new URLSearchParams(searchParams)
      if (value.trim()) {
        params.set('github', value)
      } else {
        params.delete('github')
      }
      setSearchParams(params, { replace: true })
      autoFetchRecord.current = null
    },
    [searchParams, setSearchParams],
  )

  const handleModeChange = useCallback(
    (nextMode: 'upload' | 'github') => {
      setMode(nextMode)
      setError(null)
      setStatusMessage(null)
      if (nextMode !== 'github') {
        setGithubWarning(null)
      }
    },
    [],
  )

  const handleFindModeChange = useCallback(
    (modeValue: 'manual' | 'auto') => {
      setFindMode(modeValue)
      const params = new URLSearchParams(searchParams)
      if (modeValue === 'auto') {
        params.set('find', 'auto')
      } else {
        params.delete('find')
      }
      setSearchParams(params, { replace: true })
      autoFetchRecord.current = null
    },
    [searchParams, setSearchParams],
  )

  const openCatalog = useCallback(
    async (option: CatalogOption) => {
      setError(null)
      setStatusMessage(null)
      setIsLoading(true)
      try {
        const { fileName, content, originalContent, source } = await option.load()
        const optionsForCatalog: { catalogId?: string; source?: CatalogSource } = {}
        if (source) {
          optionsForCatalog.source = source
        }
        setCatalogFromFile(fileName, content, originalContent, optionsForCatalog)
        setSelectedOptionKey(option.key)
        setStatusMessage(`Loaded ${option.label}.`)
        setCatalogOptions((prev) => prev.filter((candidate) => candidate.key !== option.key))
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
        if (!shouldAutoOpen) {
          setStatusMessage(
            `Added ${nextOptions.length} file${nextOptions.length === 1 ? '' : 's'} from manual upload.`,
          )
        }
        if (shouldAutoOpen && nextOptions[0]) {
          await openCatalog(nextOptions[0])
        }
      }

      if (failures.length > 0) {
        setError(failures.join(' '))
      }
    },
    [catalog, openCatalog],
  )

  const executeGithubFetch = useCallback(async () => {
    setError(null)
    setStatusMessage(null)
    setGithubWarning(null)

    const reference = parseGithubRepo(githubUrl)
    if (!reference) {
      setError('Invalid GitHub repository reference.')
      return
    }

    setIsLoading(true)
    try {
      const result = await listGithubXcstrings(reference)
      if (result.files.length === 0) {
        setError('No .xcstrings files found in the specified repository.')
        return
      }

      const prefix = `github::${result.reference.owner}/${result.reference.repo}@${result.reference.branch}::`

      const options: CatalogOption[] = result.files.map((file) => {
        const label = file.relativePath
        const description = `${result.reference.owner}/${result.reference.repo}@${result.reference.branch}/${file.path}`
        return {
          key: `${prefix}${file.path}`,
          label,
          origin: 'github',
          description,
          load: async () => {
            const content = await fetchGithubFileContent(result.reference, file.path)
            return {
              fileName: label,
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
        }
      })

      setCatalogOptions((prev) => {
        const filtered = prev.filter((option) => !option.key.startsWith(prefix))
        return [...filtered, ...options]
      })

      const shouldAutoOpen = !catalog && options.length === 1
      if (!shouldAutoOpen) {
        setStatusMessage(
          `Found ${options.length} .xcstrings file${options.length === 1 ? '' : 's'} in ${result.reference.owner}/${result.reference.repo}.`,
        )
      }

      if (result.truncated) {
        setGithubWarning(
          'GitHub returned a truncated file list. Narrow the search path if some files are missing.',
        )
      } else {
        setGithubWarning(null)
      }

      if (shouldAutoOpen && options[0]) {
        await openCatalog(options[0])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to query GitHub.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [catalog, githubUrl, openCatalog])

  const handleGithubSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      await executeGithubFetch()
    },
    [executeGithubFetch],
  )

  const trimmedGithubUrl = githubUrl.trim()

  useEffect(() => {
    if (mode !== 'github') return
    if (findMode !== 'auto') return
    if (!trimmedGithubUrl) return
    if (autoFetchRecord.current === trimmedGithubUrl) return

    const timeoutId = window.setTimeout(() => {
      autoFetchRecord.current = trimmedGithubUrl
      void executeGithubFetch()
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [executeGithubFetch, findMode, mode, trimmedGithubUrl])

  const handleClearOptions = useCallback(() => {
    setCatalogOptions([])
    setSelectedOptionKey(null)
  }, [])

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
    <div className="grid gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      {/* Loading */}
      {catalogLoading && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-6 py-8 text-sm text-primary">
          <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Parsing catalog — this may take a moment for large files…</span>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {statusMessage && (
        <div className="rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          {statusMessage}
        </div>
      )}
      {githubWarning && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {githubWarning}
        </div>
      )}

      {/* Upload / GitHub tabs */}
      <Tabs
        value={mode}
        onValueChange={(next: string) => handleModeChange(next as 'upload' | 'github')}
        className="w-full"
      >
        <TabsList className="justify-start">
          <TabsTrigger value="upload" className="gap-1.5">
            <CloudUpload className="size-3.5" />
            Manual upload
          </TabsTrigger>
          <TabsTrigger value="github" className="gap-1.5">
            <Github className="size-3.5" />
            GitHub import
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-4">
          <FileUploader onFilesLoaded={handleFilesLoaded} disabled={isLoading} multiple />
        </TabsContent>
        <TabsContent value="github" className="mt-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Import from GitHub</CardTitle>
              <CardDescription>
                Paste a repository URL or <code className="rounded bg-muted px-1.5 py-0.5">owner/repo</code> reference to discover .xcstrings files.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleGithubSubmit}>
                <Input
                  value={githubUrl}
                  onChange={(event) => handleGithubUrlChange(event.target.value)}
                  placeholder="owner/repo, owner/repo@branch, or https://github.com/owner/repo"
                  disabled={isLoading}
                />
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  <Switch
                    id="auto-find"
                    checked={findMode === 'auto'}
                    onCheckedChange={(checked) => handleFindModeChange(checked ? 'auto' : 'manual')}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-find" className="text-xs font-medium text-foreground">
                      Auto-fetch .xcstrings
                    </Label>
                    <p className="text-[11px] text-muted-foreground/80">
                      Search GitHub automatically after you stop typing.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={isLoading || trimmedGithubUrl === ''}>
                    {isLoading ? 'Finding…' : 'Find files'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleGithubUrlChange('')}
                    disabled={isLoading || trimmedGithubUrl === ''}
                  >
                    Clear
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Examples: <code>apple/swift</code>, <code>owner/repo@develop</code>,{' '}
                  <code>https://github.com/owner/repo/tree/main/Subdir</code>
                </p>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Discovered catalog options */}
      {catalogOptions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Available catalogs</CardTitle>
              <CardDescription>Select a file to start editing.</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClearOptions}
              disabled={catalogOptions.length === 0 || isLoading}
            >
              Clear list
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {catalogOptions.map((option) => (
              <Button
                key={option.key}
                type="button"
                variant={selectedOptionKey === option.key ? 'default' : 'outline'}
                onClick={() => openCatalog(option)}
                disabled={isLoading}
                className="justify-between text-left"
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  )}
                </div>
                <Badge variant="secondary">{option.origin === 'upload' ? 'Upload' : 'GitHub'}</Badge>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Saved catalogs */}
      {formattedStoredCatalogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved catalogs</CardTitle>
            <CardDescription>Previously opened catalogs stored in this browser.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {formattedStoredCatalogs.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={currentCatalogId === item.id ? 'default' : 'outline'}
                  className="flex-1 justify-between text-left"
                  onClick={() => loadCatalogById(item.id)}
                  disabled={isLoading}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{item.fileName}</span>
                    <span className="text-xs text-muted-foreground">Last opened: {item.formattedLastOpened}</span>
                  </div>
                  {currentCatalogId === item.id && <Badge variant="secondary">Active</Badge>}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeCatalog(item.id)
                  }}
                  disabled={isLoading}
                >
                  Remove
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ImportPage
