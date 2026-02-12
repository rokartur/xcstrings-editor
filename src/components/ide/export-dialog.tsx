import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Download } from 'lucide-react'

import { LanguagePicker } from '@/components/language-picker'
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
import { useCatalog } from '@/lib/catalog-context'
import type { GithubCatalogSource } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import { publishCatalogToGithub } from '@/lib/github-publish'
import type { GithubPublishStatus, PublishCatalogResult } from '@/lib/github-publish'
import { resolveLocaleValue } from '@/lib/xcstrings'

function encodeGithubPath(value: string) {
  return value.split('/').map((s) => encodeURIComponent(s)).join('/')
}

const publishStatusLabels: Record<GithubPublishStatus, string> = {
  'validating-token': 'Validating access token',
  'creating-fork': 'Creating repository fork',
  'waiting-for-fork': 'Waiting for fork to be ready',
  'creating-branch': 'Preparing branch in fork',
  'committing-changes': 'Uploading updated file',
  'creating-pull-request': 'Opening pull request',
}

export function ExportDialog() {
  const { exportDialogOpen, setExportDialogOpen } = useEditorStore()
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

  useEffect(() => {
    setPublishResult(null)
    setPublishErrorMessage(null)
    setPublishStep(null)
  }, [githubSource])

  useEffect(() => {
    if (!catalog) { setSelectedPublishLocale(''); return }
    const { languages, document: doc } = catalog
    if (languages.length === 0) { setSelectedPublishLocale(''); return }
    let nextLocale = selectedPublishLocale
    if (!nextLocale || !languages.includes(nextLocale)) {
      nextLocale = (doc.sourceLanguage && languages.includes(doc.sourceLanguage))
        ? doc.sourceLanguage
        : languages[0] ?? ''
    }
    setSelectedPublishLocale(nextLocale)
  }, [catalog, selectedPublishLocale])

  const handleDownloadCatalog = useCallback(() => {
    const exported = exportContent()
    if (!exported) return
    const blob = new Blob([exported.content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${catalog?.fileName?.replace(/\.xcstrings$/i, '') ?? 'catalog'}-edited.xcstrings`
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
    if (!trimmedToken) { setPublishErrorMessage('Paste a personal access token.'); return }
    if (!hasDirtyChanges) { setPublishErrorMessage('No pending changes.'); return }

    const exported = exportContent()
    if (!exported) { setPublishErrorMessage('Failed to export.'); return }

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
      const addFromEntry = (entry: typeof currentEntry, sl?: string) => {
        if (sl) locales.add(sl)
        if (entry?.localizations) for (const l of Object.keys(entry.localizations)) if (l.trim()) locales.add(l)
      }
      addFromEntry(currentEntry, catalog.document.sourceLanguage)
      addFromEntry(previousEntry, catalog.originalDocument.sourceLanguage)
      for (const locale of locales) {
        const next = currentEntry ? resolveLocaleValue(currentEntry, locale, catalog.document.sourceLanguage, key) : ''
        const prev = previousEntry ? resolveLocaleValue(previousEntry, locale, catalog.originalDocument.sourceLanguage, key) : ''
        if (next !== prev) changedLocales.add(locale)
      }
    }

    const sortedLocales = Array.from(changedLocales).sort((a, b) => a.localeCompare(b))
    const detectedDescriptor = sortedLocales.length > 0 ? sortedLocales.join(', ') : 'catalog'
    const preferredLocale = selectedPublishLocale.trim()
    const summary = preferredLocale || (sortedLocales.length === 1 ? sortedLocales[0] : detectedDescriptor) || 'catalog'

    const fileLink = githubSource
      ? `https://github.com/${encodeGithubPath(githubSource.owner)}/${encodeGithubPath(githubSource.repo)}/blob/${encodeGithubPath(githubSource.branch)}/${encodeGithubPath(githubSource.path)}`
      : null
    const fileRef = fileLink ? `[${catalog.fileName}](${fileLink})` : catalog.fileName

    let body = `This pull request was created via [xcstrings.vercel.app](https://xcstrings.vercel.app).\n\nUpdated file: ${fileRef}`
    if (sortedLocales.length > 0) body += `\nUpdated locale${sortedLocales.length === 1 ? '' : 's'}: ${detectedDescriptor}`
    if (sampleKeys.length > 0) {
      body += `\n\nModified keys:\n${sampleKeys.map((k) => `- ${k}`).join('\n')}`
      if (dirtyKeys.length > sampleKeys.length) body += `\n- ...and ${dirtyKeys.length - sampleKeys.length} more`
    }

    const title = `chore(localization): update ${summary} translation`

    try {
      const result = await publishCatalogToGithub({
        token: trimmedToken,
        source: githubSource,
        content: exported.content,
        commitMessage: title,
        pullRequestTitle: title,
        pullRequestBody: body,
        onStatus: (status) => setPublishStep(status),
      })
      setPublishResult(result)
      setPublishStep(null)
    } catch (error) {
      setPublishErrorMessage(error instanceof Error ? error.message : 'Failed to publish.')
      setPublishStep(null)
    } finally {
      setIsPublishing(false)
    }
  }, [catalog, exportContent, githubSource, githubToken, hasDirtyChanges, selectedPublishLocale])

  if (!catalog) return null

  return (
    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Export or publish</DialogTitle>
          <DialogDescription>Download or publish {catalog.fileName}.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-100px)] px-6 pb-6">
          <div className="grid gap-4 pt-2">
            {/* Download section */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Download</p>
              <div className="space-y-1 rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
                <p>File: <span className="font-medium text-foreground">{catalog.fileName}</span></p>
                <p>Keys: <span className="font-medium text-foreground">{catalog.entries.length}</span></p>
                <p>Languages: <span className="font-medium text-foreground">{catalog.languages.join(', ')}</span></p>
                <p>Pending: <span className="font-medium text-foreground">{dirtyKeyCount}</span></p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDownloadCatalog} className="gap-1.5">
                  <Download className="size-4" />
                  Download .xcstrings
                </Button>
                {catalog.projectFile?.dirty && (
                  <Button variant="outline" onClick={handleDownloadProjectFile} className="gap-1.5">
                    <Download className="size-4" />
                    Download .pbxproj
                  </Button>
                )}
              </div>
            </div>

            {/* GitHub publish section */}
            {githubSource && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium">Publish to GitHub</p>
                <p className="text-xs text-muted-foreground">
                  Fork {githubSource.owner}/{githubSource.repo} and open a pull request.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="github-token-export">Personal access token</Label>
                  <Input
                    id="github-token-export"
                    type="password"
                    value={githubToken}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => { if (publishErrorMessage) setPublishErrorMessage(null); setGithubToken(e.target.value) }}
                    placeholder="ghp_..."
                    autoComplete="off"
                    disabled={isPublishing}
                  />
                  <p className="text-xs text-muted-foreground">
                    Requires <code className="rounded bg-muted px-1 py-0.5 text-[11px]">public_repo</code> scope.
                  </p>
                </div>

                <LanguagePicker
                  languages={catalog.languages}
                  value={selectedPublishLocale}
                  onSelect={(l) => setSelectedPublishLocale(l)}
                  disabled={isPublishing}
                  placeholder="Language for commit"
                  label="Language for PR"
                />

                <div className="space-y-1 rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
                  <p>Target: <span className="font-medium text-foreground">{githubSource.owner}/{githubSource.repo}@{githubSource.branch}</span></p>
                  <p>File: <span className="font-medium text-foreground">{githubSource.path}</span></p>
                  <p>Pending: <span className="font-medium text-foreground">{dirtyKeyCount}</span></p>
                </div>

                {publishStep && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
                    <p>Fork branch <code>{publishResult.forkOwner}:{publishResult.branchName}</code> is ready.</p>
                    <p><a href={publishResult.pullRequestUrl} target="_blank" rel="noreferrer" className="underline">View pull request</a></p>
                    <p><a href={publishResult.forkUrl} target="_blank" rel="noreferrer" className="underline">View fork</a></p>
                  </div>
                )}

                {!hasDirtyChanges && (
                  <p className="text-xs text-muted-foreground">No pending changes.</p>
                )}

                <div className="flex gap-2">
                  <Button onClick={handlePublishToGithub} disabled={isPublishing || !hasDirtyChanges}>
                    {isPublishing ? 'Publishing...' : 'Create fork & PR'}
                  </Button>
                  <Button variant="outline" onClick={() => { setGithubToken(''); setPublishErrorMessage(null) }} disabled={isPublishing || !githubToken.trim()}>
                    Clear token
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
