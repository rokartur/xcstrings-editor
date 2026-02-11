import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Download } from 'lucide-react'

import { LanguagePicker } from '../components/language-picker'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useCatalog } from '../lib/catalog-context'
import type { GithubCatalogSource } from '../lib/catalog-context'
import { publishCatalogToGithub } from '../lib/github-publish'
import type { GithubPublishStatus, PublishCatalogResult } from '../lib/github-publish'
import { resolveLocaleValue } from '../lib/xcstrings'

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

function ExportPage() {
  const { catalog, exportContent, exportProjectFile } = useCatalog()

  const [githubToken, setGithubToken] = useState('')
  const [publishStep, setPublishStep] = useState<GithubPublishStatus | null>(null)
  const [publishResult, setPublishResult] = useState<PublishCatalogResult | null>(null)
  const [publishErrorMessage, setPublishErrorMessage] = useState<string | null>(null)
  const [selectedPublishLocale, setSelectedPublishLocale] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

  const githubSource: GithubCatalogSource | null =
    catalog?.source && catalog.source.type === 'github' ? catalog.source : null
  const hasDirtyChanges = catalog ? catalog.dirtyKeys.size > 0 : false
  const dirtyKeyCount = catalog?.dirtyKeys.size ?? 0

  // Reset publish state when source changes
  useEffect(() => {
    setPublishResult(null)
    setPublishErrorMessage(null)
    setPublishStep(null)
  }, [githubSource])

  // Set default locale for PR description
  useEffect(() => {
    if (!catalog) {
      setSelectedPublishLocale('')
      return
    }

    const { languages, document: doc } = catalog

    if (languages.length === 0) {
      setSelectedPublishLocale('')
      return
    }

    let nextLocale = selectedPublishLocale

    if (!nextLocale || !languages.includes(nextLocale)) {
      if (doc.sourceLanguage && languages.includes(doc.sourceLanguage)) {
        nextLocale = doc.sourceLanguage
      } else {
        nextLocale = languages[0] ?? ''
      }
    }

    setSelectedPublishLocale(nextLocale ?? '')
  }, [catalog, selectedPublishLocale])

  const handleDownloadCatalog = useCallback(() => {
    const exported = exportContent()
    if (!exported) return

    const blob = new Blob([exported.content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const baseName = catalog?.fileName?.replace(/\.xcstrings$/i, '') ?? 'catalog'
    link.download = `${baseName}-edited.xcstrings`
    link.click()
    URL.revokeObjectURL(url)
  }, [catalog?.fileName, exportContent])

  const handleDownloadProjectFile = useCallback(() => {
    const exported = exportProjectFile()
    if (!exported) return

    const blob = new Blob([exported.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exported.path.split('/').pop() ?? 'project.pbxproj'
    link.click()
    URL.revokeObjectURL(url)
  }, [exportProjectFile])

  const handlePublishToGithub = useCallback(async () => {
    if (!catalog || !githubSource) return

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
        if (sourceLanguage) locales.add(sourceLanguage)
        if (entry?.localizations) {
          for (const localeKey of Object.keys(entry.localizations)) {
            if (localeKey.trim()) locales.add(localeKey)
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
    const detectedLocaleDescriptor =
      sortedLocales.length > 0 ? sortedLocales.join(', ') : 'catalog'
    const preferredLocale = selectedPublishLocale.trim()
    const summaryDescriptor =
      preferredLocale ||
      (sortedLocales.length === 1 ? sortedLocales[0] : detectedLocaleDescriptor) ||
      'catalog'

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
      const message =
        error instanceof Error ? error.message : 'Failed to publish changes to GitHub.'
      setPublishErrorMessage(message)
      setPublishStep(null)
    } finally {
      setIsPublishing(false)
    }
  }, [catalog, exportContent, githubSource, githubToken, hasDirtyChanges, selectedPublishLocale])

  if (!catalog) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="grid gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      {/* Download / Export card */}
      <Card>
        <CardHeader>
          <CardTitle>Download catalog</CardTitle>
          <CardDescription>
            Export your edited{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{catalog.fileName}</code> as
            a file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
            <p>
              File:{' '}
              <span className="font-medium text-foreground">{catalog.fileName}</span>
            </p>
            <p>
              Keys:{' '}
              <span className="font-medium text-foreground">{catalog.entries.length}</span>
            </p>
            <p>
              Languages:{' '}
              <span className="font-medium text-foreground">
                {catalog.languages.join(', ')}
              </span>
            </p>
            <p>
              Pending changes:{' '}
              <span className="font-medium text-foreground">{dirtyKeyCount}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleDownloadCatalog} className="gap-1.5">
              <Download className="size-4" />
              Download .xcstrings
            </Button>
            {catalog.projectFile?.dirty && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadProjectFile}
                className="gap-1.5"
              >
                <Download className="size-4" />
                Download .pbxproj
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GitHub Publish card */}
      {githubSource && (
        <Card>
          <CardHeader>
            <CardTitle>Publish to GitHub</CardTitle>
            <CardDescription>
              Fork {githubSource.owner}/{githubSource.repo} and open a pull request with your
              translated file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="github-token">Personal access token</Label>
              <Input
                id="github-token"
                type="password"
                value={githubToken}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  if (publishErrorMessage) setPublishErrorMessage(null)
                  setGithubToken(event.target.value)
                }}
                placeholder="ghp_..."
                autoComplete="off"
                disabled={isPublishing}
              />
              <p className="text-xs text-muted-foreground">
                Requires the{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">public_repo</code>{' '}
                scope.{' '}
                <a
                  href="https://github.com/settings/tokens/new?scopes=public_repo&description=xcstrings-editor"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Create one →
                </a>
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

            <div className="space-y-1 rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
              <p>
                Target:{' '}
                <span className="font-medium text-foreground">
                  {githubSource.owner}/{githubSource.repo}@{githubSource.branch}
                </span>
              </p>
              <p>
                File:{' '}
                <span className="font-medium text-foreground">{githubSource.path}</span>
              </p>
              <p>
                Pending keys:{' '}
                <span className="font-medium text-foreground">{dirtyKeyCount}</span>
              </p>
            </div>

            {publishStep && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg
                  className="size-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {publishStatusLabels[publishStep]}
              </div>
            )}

            {publishErrorMessage && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {publishErrorMessage}
              </div>
            )}

            {publishResult && (
              <div className="space-y-1 rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300">
                <p>
                  Fork branch{' '}
                  <code>
                    {publishResult.forkOwner}:{publishResult.branchName}
                  </code>{' '}
                  is ready.
                </p>
                <p>
                  <a
                    href={publishResult.pullRequestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    View pull request →
                  </a>
                </p>
                <p>
                  <a
                    href={publishResult.forkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    View fork repository →
                  </a>
                </p>
              </div>
            )}

            {!hasDirtyChanges && (
              <p className="text-xs text-muted-foreground">
                No pending changes. Edit translations first before publishing.
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

export default ExportPage
