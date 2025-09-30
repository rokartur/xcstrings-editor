import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { FileUploader } from '../components/file-uploader.tsx'
import { LanguagePicker } from '../components/language-picker.tsx'
import { Badge } from '../components/ui/badge.tsx'
import { Button } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { Input } from '../components/ui/input.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx'
import { useCatalog } from '../lib/catalog-context.tsx'
import type { CatalogSource } from '../lib/catalog-context.tsx'
import { parseXcStrings, resolveLocaleValue } from '../lib/xcstrings.ts'
import { fetchGithubFileContent, listGithubXcstrings, parseGithubRepo } from '../lib/github.ts'
import { publishCatalogToGithub } from '../lib/github-publish.ts'
import type { GithubPublishStatus, PublishCatalogResult } from '../lib/github-publish.ts'
import { Label } from '@/components/ui/label.tsx'
import { Switch } from '@/components/ui/switch.tsx'
import { findLocaleOption, formatLocaleCode, getLocaleOptions } from '@/lib/locale-options.ts'
import { cn } from '@/lib/utils.ts'

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

function encodeGithubPath(value: string) {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

const publishStatusLabels: Record<GithubPublishStatus, string> = {
  'validating-token': 'Validating access token',
  'creating-fork': 'Creating repository fork',
  'waiting-for-fork': 'Waiting for fork to be ready',
  'creating-branch': 'Preparing branch in fork',
  'committing-changes': 'Uploading updated file',
  'creating-pull-request': 'Opening pull request',
}

function HomePage() {
  const {
    catalog,
    setCatalogFromFile,
    storedCatalogs,
    loadCatalogById,
    removeCatalog,
    exportContent,
    addLanguage,
    attachProjectFile,
    updateProjectFilePath,
    exportProjectFile,
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
  const [githubToken, setGithubToken] = useState('')
  const [publishStep, setPublishStep] = useState<GithubPublishStatus | null>(null)
  const [publishResult, setPublishResult] = useState<PublishCatalogResult | null>(null)
  const [publishErrorMessage, setPublishErrorMessage] = useState<string | null>(null)
  const [selectedPublishLocale, setSelectedPublishLocale] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const autoFetchRecord = useRef<string | null>(null)
  const githubSource = catalog?.source && catalog.source.type === 'github' ? catalog.source : null
  const hasDirtyChanges = catalog ? catalog.dirtyKeys.size > 0 : false
  const dirtyKeyCount = catalog?.dirtyKeys.size ?? 0
  const [languageFeedback, setLanguageFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [projectFileMessage, setProjectFileMessage] = useState<string | null>(null)
  const projectFileInputRef = useRef<HTMLInputElement>(null)
  const [projectFilePathDraft, setProjectFilePathDraft] = useState('')

  const availableLanguageOptions = useMemo(
    () => getLocaleOptions(catalog?.languages ?? []),
    [catalog?.languages],
  )

  const availableLanguageCodes = useMemo(
    () => availableLanguageOptions.map((option) => option.code),
    [availableLanguageOptions],
  )

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
    [setGithubWarning],
  )

  useEffect(() => {
    setPublishResult(null)
    setPublishErrorMessage(null)
    setPublishStep(null)
  }, [githubSource])

  useEffect(() => {
    if (!catalog) {
      setSelectedPublishLocale('')
      return
    }

    const { languages, document } = catalog

    if (languages.length === 0) {
      setSelectedPublishLocale('')
      return
    }

    let nextLocale = selectedPublishLocale

    if (!nextLocale || !languages.includes(nextLocale)) {
      if (document.sourceLanguage && languages.includes(document.sourceLanguage)) {
        nextLocale = document.sourceLanguage
      } else {
        nextLocale = languages[0] ?? ''
      }
    }

    setSelectedPublishLocale(nextLocale ?? '')
  }, [catalog, selectedPublishLocale])

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

  const handleAddLanguage = useCallback(
    (rawLocale: string) => {
      if (!catalog) {
        return
      }

      const normalized = formatLocaleCode(rawLocale).trim()
      if (!normalized) {
        setLanguageFeedback({ type: 'error', message: 'Enter a valid locale identifier.' })
        return
      }

      const existing = catalog.languages.map((lang) => formatLocaleCode(lang).toLowerCase())
      if (existing.includes(normalized.toLowerCase())) {
        setLanguageFeedback({ type: 'error', message: `${normalized} is already part of this catalog.` })
        return
      }

      addLanguage(normalized)
      const optionLabel = findLocaleOption(normalized)?.label ?? normalized
      setLanguageFeedback({ type: 'success', message: `Added ${optionLabel}.` })
    },
    [addLanguage, catalog],
  )

  const handleProjectFileButtonClick = useCallback(() => {
    projectFileInputRef.current?.click()
  }, [])

  const handleProjectFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      try {
        setProjectFileMessage(null)
        const content = await file.text()
        attachProjectFile(file.name, content)
        setProjectFileMessage(`Attached ${file.name}.`)
        setProjectFilePathDraft(file.name)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to read the selected file.'
        setProjectFileMessage(message)
      } finally {
        event.target.value = ''
      }
    },
    [attachProjectFile],
  )

  const handleProjectPathSave = useCallback(() => {
    if (!projectFilePathDraft.trim()) {
      setProjectFileMessage('Enter a project file path.')
      return
    }

    updateProjectFilePath(projectFilePathDraft.trim())
    setProjectFileMessage('Project file path updated.')
  }, [projectFilePathDraft, updateProjectFilePath])

  const handleDownloadProjectFile = useCallback(() => {
    const exported = exportProjectFile()
    if (!exported) {
      setProjectFileMessage('Attach a project file before exporting.')
      return
    }

    const blob = new Blob([exported.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exported.path.split('/').pop() ?? 'project.pbxproj'
    link.click()
    URL.revokeObjectURL(url)
  }, [exportProjectFile])

  useEffect(() => {
    if (!catalog?.projectFile) {
      setProjectFilePathDraft('')
      setProjectFileMessage(null)
      return
    }
    setProjectFilePathDraft(catalog.projectFile.path)
    setProjectFileMessage(null)
  }, [catalog?.projectFile])

  const handleFilesLoaded = useCallback(
    async (files: UploadedFile[]) => {
      if (!files.length) {
        return
      }

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

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [executeGithubFetch, findMode, mode, trimmedGithubUrl])

  const handleClearOptions = useCallback(() => {
    setCatalogOptions([])
    setSelectedOptionKey(null)
  }, [])

  useEffect(() => {
    setLanguageFeedback(null)
  }, [catalog?.languages.length])

  const handleLanguageSelect = (locale: string) => {
    if (!locale) return
    navigate(`/locale/${locale}`)
  }

  const handlePublishToGithub = useCallback(async () => {
    if (!catalog || !githubSource) {
      return
    }

    const trimmedToken = githubToken.trim()

    if (!trimmedToken) {
      setPublishErrorMessage('Paste a personal access token before publishing.')
      return
    }

    if (!hasDirtyChanges) {
      setPublishErrorMessage('There are no pending changes to publish.')
      return
    }

    const exported = exportContent()

    if (!exported) {
      setPublishErrorMessage('Failed to export the catalog content.')
      return
    }

    setPublishErrorMessage(null)
    setPublishResult(null)
    setPublishStep(null)
    setIsPublishing(true)

    const dirtyKeys = Array.from(catalog.dirtyKeys).sort()
    const sampleKeys = dirtyKeys.slice(0, 10)

    const changedLocales = new Set<string>()

    for (const key of dirtyKeys) {
      const currentEntry = catalog.document.strings[key]
      const previousEntry = catalog.originalDocument.strings[key]

      const locales = new Set<string>()

      const addLocalesFromEntry = (entry: typeof currentEntry, sourceLanguage?: string) => {
        if (sourceLanguage) {
          locales.add(sourceLanguage)
        }
        if (entry?.localizations) {
          for (const localeKey of Object.keys(entry.localizations)) {
            if (localeKey.trim()) {
              locales.add(localeKey)
            }
          }
        }
      }

      addLocalesFromEntry(currentEntry, catalog.document.sourceLanguage)
      addLocalesFromEntry(previousEntry, catalog.originalDocument.sourceLanguage)

      for (const locale of locales) {
        const nextValue = currentEntry
          ? resolveLocaleValue(currentEntry, locale, catalog.document.sourceLanguage, key)
          : ''
        const previousValue = previousEntry
          ? resolveLocaleValue(previousEntry, locale, catalog.originalDocument.sourceLanguage, key)
          : ''

        if (nextValue !== previousValue) {
          changedLocales.add(locale)
        }
      }
    }

    const sortedLocales = Array.from(changedLocales).sort((a, b) => a.localeCompare(b))
    const detectedLocaleDescriptor = sortedLocales.length > 0 ? sortedLocales.join(', ') : 'catalog'
    const preferredLocale = selectedPublishLocale.trim()
    const summaryDescriptor = preferredLocale
      || (sortedLocales.length === 1 ? sortedLocales[0] : detectedLocaleDescriptor)
      || 'catalog'

    const fileLink = githubSource
      ? `https://github.com/${encodeGithubPath(githubSource.owner)}/${encodeGithubPath(githubSource.repo)}/blob/${encodeGithubPath(githubSource.branch)}/${encodeGithubPath(githubSource.path)}`
      : null
    const fileReference = fileLink ? `[${catalog.fileName}](${fileLink})` : catalog.fileName

    let pullRequestBody = `This pull request was created automatically via the [xcstrings.vercel.app](https://xcstrings.vercel.app) web application.\n\nUpdated file: ${fileReference}`

    if (sortedLocales.length > 0) {
      pullRequestBody += `\nUpdated locale${sortedLocales.length === 1 ? '' : 's'}: ${detectedLocaleDescriptor}`
    }

    if (sampleKeys.length > 0) {
      const bulletList = sampleKeys.map((key) => `- ${key}`).join('\n')
      pullRequestBody += `\n\nModified keys:\n${bulletList}`

      if (dirtyKeys.length > sampleKeys.length) {
        pullRequestBody += `\n- ...and ${dirtyKeys.length - sampleKeys.length} more`
      }
    }

    const summaryTitle = `chore(localization): update ${summaryDescriptor} translation`

    try {
      const result = await publishCatalogToGithub({
        token: trimmedToken,
        source: githubSource,
        content: exported.content,
        commitMessage: summaryTitle,
        pullRequestTitle: summaryTitle,
        pullRequestBody,
        onStatus: (status) => setPublishStep(status),
      })
      setPublishResult(result)
      setPublishStep(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish changes to GitHub.'
      setPublishErrorMessage(message)
      setPublishStep(null)
    } finally {
      setIsPublishing(false)
    }
  }, [catalog, exportContent, githubSource, githubToken, hasDirtyChanges, selectedPublishLocale])

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
    <div className="grid gap-6">
      <Tabs
        value={mode}
        onValueChange={(next: string) => handleModeChange(next as 'upload' | 'github')}
        className="w-full"
      >
        <TabsList className="justify-start">
          <TabsTrigger value="upload">Manual upload</TabsTrigger>
          <TabsTrigger value="github">GitHub import</TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-4">
          <FileUploader onFilesLoaded={handleFilesLoaded} disabled={isLoading} multiple />
        </TabsContent>
        <TabsContent value="github" className="mt-4">
          <Card className="border border-primary/20 shadow-lg shadow-primary/10">
            <CardHeader>
              <CardTitle>Import from GitHub</CardTitle>
              <CardDescription>
                Paste a repository URL or <code>owner/repo</code> reference to discover .xcstrings files automatically.
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
                    onCheckedChange={(checked) => {
                      handleFindModeChange(checked ? 'auto' : 'manual')
                    }}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-find" className="text-xs font-medium text-foreground">
                      Auto-fetch .xcstrings
                    </Label>
                    <p className="text-[11px] text-muted-foreground/80">
                      When enabled, we search GitHub after you stop typing for a moment.
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

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-700">
          {statusMessage}
        </div>
      )}

      {githubWarning && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          {githubWarning}
        </div>
      )}

      {formattedStoredCatalogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved catalogs</CardTitle>
            <CardDescription>Switch between catalogs stored in this browser.</CardDescription>
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

      {catalogOptions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Available catalogs</CardTitle>
              <CardDescription>Select a file to start editing or diffing translations.</CardDescription>
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

      {catalog && (
        <Card>
          <CardHeader>
            <CardTitle>Your translations</CardTitle>
            <CardDescription>
              This file contains {catalog.entries.length} keys and {catalog.languages.length} languages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <LanguagePicker
              languages={catalog.languages}
              onSelect={handleLanguageSelect}
              placeholder="Select a language to edit"
            />
            <div className="flex flex-wrap gap-2">
              {catalog.languages.map((language) => (
                <Button key={language} variant="secondary" onClick={() => handleLanguageSelect(language)}>
                  {language}
                </Button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Add a language</h3>
                  <p className="text-xs text-muted-foreground">
                    Search for any locale or enter a custom tag (for example <code>en-GB</code>). We&apos;ll prevent
                    duplicates automatically.
                  </p>
                </div>
                <div className="space-y-3 rounded-xl border border-dashed border-border/50 bg-muted/10 p-4">
                  <LanguagePicker
                    languages={availableLanguageCodes}
                    onSelect={handleAddLanguage}
                    placeholder="Type to find locales"
                    label="Locale lookup"
                  />
                  <p className="text-xs text-muted-foreground">
                    Press <kbd>Enter</kbd> to add the highlighted suggestion or use the custom option to insert the
                    exact code you typed.
                  </p>
                  {languageFeedback && (
                    <p
                      className={cn(
                        'rounded-md px-3 py-2 text-xs',
                        languageFeedback.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'bg-destructive/10 text-destructive',
                      )}
                    >
                      {languageFeedback.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Project file</h3>
                  <p className="text-xs text-muted-foreground">
                    Attach your <code>project.pbxproj</code> to update Xcode&apos;s known regions automatically when adding languages.
                  </p>
                </div>
                <div className="space-y-3 rounded-md border border-muted bg-muted/10 p-3">
                  {catalog.projectFile ? (
                    <>
                      <p className="text-xs text-muted-foreground">Current file: {catalog.projectFile.path}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: {catalog.projectFile.dirty ? 'Pending changes' : 'Synced'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No project file attached yet.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleProjectFileButtonClick}>
                      Attach project file
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleDownloadProjectFile}>
                      Download current
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={projectFilePathDraft}
                      onChange={(event) => setProjectFilePathDraft(event.target.value)}
                      placeholder="Path inside repository"
                      className="sm:flex-1"
                    />
                    <Button type="button" size="sm" onClick={handleProjectPathSave}>
                      Save path
                    </Button>
                  </div>
                  {projectFileMessage && <p className="text-xs text-muted-foreground">{projectFileMessage}</p>}
                </div>
              </div>
            </div>

            <input
              ref={projectFileInputRef}
              type="file"
              accept=".pbxproj,text/plain,application/octet-stream"
              className="hidden"
              onChange={handleProjectFileChange}
            />
          </CardContent>
        </Card>
      )}

      {catalog && githubSource && (
        <Card>
          <CardHeader>
            <CardTitle>Publish to GitHub</CardTitle>
            <CardDescription>
              Fork {githubSource.owner}/{githubSource.repo} and open a pull request with your translated file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="github-token">Personal access token</Label>
              <Input
                id="github-token"
                type="password"
                value={githubToken}
                onChange={(event) => {
                  if (publishErrorMessage) {
                    setPublishErrorMessage(null)
                  }
                  setGithubToken(event.target.value)
                }}
                placeholder="ghp_..."
                autoComplete="off"
                disabled={isPublishing}
              />
              <p className="text-xs text-muted-foreground">
                The token must include the <code>public_repo</code> scope (use <code>repo</code> for private repositories).
                You can create one in{' '}
                <a
                  href="https://github.com/settings/tokens/new?scopes=public_repo&description=xcstrings-editor"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  GitHub settings
                </a>
                . Tokens are only stored in memory while this page is open.
              </p>
            </div>

            <LanguagePicker
              languages={catalog.languages}
              value={selectedPublishLocale}
              onSelect={(locale) => setSelectedPublishLocale(locale)}
              disabled={isPublishing}
              placeholder="Select language for commit"
              label="Language for commit & pull request"
            />
            <p className="text-xs text-muted-foreground">
              The selected language appears in the generated commit message and pull request title.
            </p>

            <div className="space-y-1 rounded-md border border-muted bg-muted/5 p-3 text-xs text-muted-foreground">
              <p>
                Target repository: {githubSource.owner}/{githubSource.repo}@{githubSource.branch}
              </p>
              <p>File path: {githubSource.path}</p>
              <p>Pending keys: {dirtyKeyCount}</p>
            </div>

            {publishStep && (
              <div className="text-sm text-muted-foreground">
                {publishStatusLabels[publishStep]}
              </div>
            )}

            {publishErrorMessage && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {publishErrorMessage}
              </div>
            )}

            {publishResult && (
              <div className="space-y-1 rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-700">
                <p>
                  Fork branch <code>{publishResult.forkOwner}:{publishResult.branchName}</code> is ready.
                </p>
                <p>
                  <a href={publishResult.pullRequestUrl} target="_blank" rel="noreferrer" className="underline">
                    View pull request
                  </a>
                </p>
                <p>
                  <a href={publishResult.forkUrl} target="_blank" rel="noreferrer" className="underline">
                    View fork repository
                  </a>
                </p>
              </div>
            )}

            {!hasDirtyChanges && (
              <p className="text-xs text-muted-foreground">
                There are no pending changes in this catalog. Update translations before publishing.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handlePublishToGithub}
                disabled={isPublishing || !hasDirtyChanges}
              >
                {isPublishing ? 'Publishing…' : 'Create fork & pull request'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setGithubToken('')
                  setPublishErrorMessage(null)
                }}
                disabled={isPublishing || githubToken.trim() === ''}
              >
                Clear token
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default HomePage
