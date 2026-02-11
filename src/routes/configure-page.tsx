import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Download } from 'lucide-react'

import { LanguagePicker } from '../components/language-picker.tsx'
import { Badge } from '../components/ui/badge.tsx'
import { Button } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { Input } from '../components/ui/input.tsx'
import { useCatalog } from '../lib/catalog-context.tsx'
import { findLocaleOption, formatLocaleCode, getLocaleOptions } from '@/lib/locale-options.ts'
import { cn } from '@/lib/utils.ts'

function ConfigurePage() {
  const {
    catalog,
    addLanguage,
    attachProjectFile,
    updateProjectFilePath,
    exportProjectFile,
  } = useCatalog()

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
    setLanguageFeedback(null)
  }, [catalog?.languages.length])

  useEffect(() => {
    if (!catalog?.projectFile) {
      setProjectFilePathDraft('')
      setProjectFileMessage(null)
      return
    }
    setProjectFilePathDraft(catalog.projectFile.path)
    setProjectFileMessage(null)
  }, [catalog?.projectFile])

  const handleAddLanguage = useCallback(
    (rawLocale: string) => {
      if (!catalog) return

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
      if (!file) return

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

  if (!catalog) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="grid gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      {/* Current languages overview */}
      <Card>
        <CardHeader>
          <CardTitle>Current languages</CardTitle>
          <CardDescription>
            {catalog.fileName} contains {catalog.entries.length} keys across {catalog.languages.length} locale{catalog.languages.length !== 1 ? 's' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {catalog.languages.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {catalog.languages.map((language) => (
                <Badge key={language} variant="secondary" className="px-2.5 py-1 text-xs font-normal">
                  {language}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No languages detected in this catalog.</p>
          )}
        </CardContent>
      </Card>

      {/* Add language + Project file side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a language</CardTitle>
            <CardDescription>
              Search for any locale or enter a custom tag like <code className="rounded bg-muted px-1 py-0.5 text-[11px]">en-GB</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LanguagePicker
              languages={availableLanguageCodes}
              onSelect={handleAddLanguage}
              placeholder="Type to find locales"
              label="Locale lookup"
            />
            <p className="text-xs text-muted-foreground">
              Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium">Enter</kbd> to add the highlighted suggestion.
            </p>
            {languageFeedback && (
              <p
                className={cn(
                  'rounded-md px-3 py-2 text-xs',
                  languageFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    : 'bg-destructive/10 text-destructive',
                )}
              >
                {languageFeedback.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project file</CardTitle>
            <CardDescription>
              Attach <code className="rounded bg-muted px-1 py-0.5 text-[11px]">project.pbxproj</code> to update Xcode&apos;s known regions automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {catalog.projectFile ? (
              <div className="space-y-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{catalog.projectFile.path}</p>
                <p className="text-[11px] text-muted-foreground">
                  {catalog.projectFile.dirty ? 'Pending changes' : 'Synced with catalog'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No project file attached yet.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleProjectFileButtonClick}>
                {catalog.projectFile ? 'Replace file' : 'Attach file'}
              </Button>
              {catalog.projectFile && (
                <Button type="button" variant="ghost" size="sm" onClick={handleDownloadProjectFile}>
                  <Download className="mr-1.5 size-3.5" />
                  Download
                </Button>
              )}
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
          </CardContent>
        </Card>
      </div>

      <input
        ref={projectFileInputRef}
        type="file"
        accept=".pbxproj,text/plain,application/octet-stream"
        className="hidden"
        onChange={handleProjectFileChange}
      />
    </div>
  )
}

export default ConfigurePage
