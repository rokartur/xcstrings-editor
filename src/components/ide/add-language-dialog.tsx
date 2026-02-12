import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import { findLocaleOption, formatLocaleCode, getLocaleOptions } from '@/lib/locale-options'
import { cn } from '@/lib/utils'

export function AddLanguageDialog() {
  const { addLanguageDialogOpen, setAddLanguageDialogOpen } = useEditorStore()
  const { catalog, addLanguage, attachProjectFile, updateProjectFilePath, exportProjectFile } =
    useCatalog()

  const [languageFeedback, setLanguageFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [projectFileMessage, setProjectFileMessage] = useState<string | null>(null)
  const projectFileInputRef = useRef<HTMLInputElement>(null)
  const [projectFilePathDraft, setProjectFilePathDraft] = useState('')

  const availableLanguageOptions = useMemo(
    () => getLocaleOptions(catalog?.languages ?? []),
    [catalog?.languages],
  )

  const availableLanguageCodes = useMemo(
    () => availableLanguageOptions.map((o) => o.code),
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
      const existing = catalog.languages.map((l) => formatLocaleCode(l).toLowerCase())
      if (existing.includes(normalized.toLowerCase())) {
        setLanguageFeedback({ type: 'error', message: `${normalized} is already in the catalog.` })
        return
      }
      addLanguage(normalized)
      const label = findLocaleOption(normalized)?.label ?? normalized
      setLanguageFeedback({ type: 'success', message: `Added ${label}.` })
    },
    [addLanguage, catalog],
  )

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
        setProjectFileMessage(err instanceof Error ? err.message : 'Unable to read file.')
      } finally {
        event.target.value = ''
      }
    },
    [attachProjectFile],
  )

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

  if (!catalog) return null

  return (
    <Dialog open={addLanguageDialogOpen} onOpenChange={setAddLanguageDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add language</DialogTitle>
          <DialogDescription>
            Add a new locale to {catalog.fileName}. Currently {catalog.languages.length} language
            {catalog.languages.length !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <LanguagePicker
              languages={availableLanguageCodes}
              onSelect={handleAddLanguage}
              placeholder="Type to find locales"
              label="Locale lookup"
            />
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
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium">Project file</p>
            {catalog.projectFile ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {catalog.projectFile.path}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {catalog.projectFile.dirty ? 'Pending changes' : 'Synced'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No project file attached.</p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => projectFileInputRef.current?.click()}
              >
                {catalog.projectFile ? 'Replace' : 'Attach'} file
              </Button>
              {catalog.projectFile && (
                <Button type="button" variant="ghost" size="sm" onClick={handleDownloadProjectFile}>
                  <Download className="mr-1.5 size-3.5" />
                  Download
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={projectFilePathDraft}
                onChange={(e) => setProjectFilePathDraft(e.target.value)}
                placeholder="Path inside repository"
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!projectFilePathDraft.trim()) return
                  updateProjectFilePath(projectFilePathDraft.trim())
                  setProjectFileMessage('Path updated.')
                }}
              >
                Save
              </Button>
            </div>
            {projectFileMessage && (
              <p className="text-xs text-muted-foreground">{projectFileMessage}</p>
            )}
          </div>
        </div>

        <input
          ref={projectFileInputRef}
          type="file"
          accept=".pbxproj,text/plain,application/octet-stream"
          className="hidden"
          onChange={handleProjectFileChange}
        />
      </DialogContent>
    </Dialog>
  )
}
