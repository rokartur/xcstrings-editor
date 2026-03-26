import { useCallback, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'

import { FileUploader } from '@/components/file-uploader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCatalog } from '@/lib/catalog-context'
import { useCompareStore } from '@/lib/compare-store'
import { useEditorStore } from '@/lib/editor-store'
import { parseXcStrings } from '@/lib/xcstrings'
import { toast } from 'sonner'

export function CompareDialog() {
  const { compareDialogOpen, setCompareDialogOpen, openCompareTab } = useEditorStore()
  const { catalog } = useCatalog()
  const compare = useCompareStore((s) => s.compare)
  const [secondFile, setSecondFile] = useState<{ fileName: string; content: string } | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleFilesLoaded = useCallback(
    async (files: { fileName: string; content: string }[]) => {
      const file = files[0]
      if (!file) return

      try {
        parseXcStrings(file.content)
        setSecondFile(file)
        setValidationError(null)
      } catch (error) {
        setValidationError(error instanceof Error ? error.message : 'Invalid .xcstrings file')
        setSecondFile(null)
      }
    },
    [],
  )

  const handleCompare = useCallback(() => {
    if (!catalog || !secondFile) return

    try {
      compare(
        { document: catalog.document, languages: catalog.languages, entries: catalog.entries },
        catalog.fileName,
        secondFile.content,
        secondFile.fileName,
      )
      setCompareDialogOpen(false)
      openCompareTab()
      setSecondFile(null)
      setValidationError(null)
    } catch (error) {
      toast.error('Comparison failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [catalog, secondFile, compare, setCompareDialogOpen, openCompareTab])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setCompareDialogOpen(open)
      if (!open) {
        setSecondFile(null)
        setValidationError(null)
      }
    },
    [setCompareDialogOpen],
  )

  return (
    <Dialog open={compareDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="size-4" />
            Compare .xcstrings files
          </DialogTitle>
          <DialogDescription>
            Upload a second .xcstrings file to compare against the currently loaded catalog.
          </DialogDescription>
        </DialogHeader>

        {/* Current file info */}
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            File A (current)
          </div>
          <div className="mt-0.5 truncate text-xs font-medium">
            {catalog?.fileName ?? 'No catalog loaded'}
          </div>
          {catalog && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {Object.keys(catalog.document.strings).length} keys · {catalog.languages.length} languages
            </div>
          )}
        </div>

        {/* Second file upload */}
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            File B (compare with)
          </div>
          {secondFile ? (
            <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{secondFile.fileName}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  Ready to compare
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => {
                  setSecondFile(null)
                  setValidationError(null)
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <FileUploader onFilesLoaded={handleFilesLoaded} variant="minimal" />
          )}
          {validationError && (
            <p className="mt-1.5 text-[11px] text-destructive">{validationError}</p>
          )}
        </div>

        {/* Compare button */}
        <div className="flex justify-end pt-1">
          <Button
            onClick={handleCompare}
            disabled={!catalog || !secondFile}
            className="gap-1.5"
          >
            <ArrowLeftRight className="size-3.5" />
            Compare files
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
