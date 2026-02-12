import { useState } from 'react'
import { Download, FileDiff, FilePlus, Languages, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'

export function Toolbar() {
  const { catalog, resetCatalog } = useCatalog()
  const { setImportDialogOpen, setExportDialogOpen, setAddLanguageDialogOpen, closeAllTabs, openDiffTab } =
    useEditorStore()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const handleConfirmDelete = () => {
    setConfirmDeleteOpen(false)
    closeAllTabs()
    resetCatalog()
  }

  return (
    <>
      <div className="flex h-10 shrink-0 items-center border-b border-border bg-background px-2">
        <div className="flex items-center gap-1.5 px-1">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-foreground"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M13.7149 14.5214C13.9649 14.5604 14.2389 14.5694 14.6269 14.5694C14.7739 14.5694 14.9729 14.5344 15.1809 14.4884L14.4559 13.0684L13.7149 14.5214Z"
              fill="currentColor"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M17.247 16.888C17.138 16.944 17.021 16.97 16.907 16.97C16.634 16.97 16.371 16.821 16.238 16.561L15.882 15.862C15.472 15.966 15.029 16.071 14.627 16.071C13.971 16.071 13.517 16.038 13.012 15.899L12.675 16.561C12.487 16.93 12.033 17.075 11.666 16.888C11.297 16.7 11.15 16.248 11.339 15.879L13.788 11.079C14.044 10.577 14.868 10.577 15.124 11.079L17.574 15.879C17.763 16.248 17.616 16.7 17.247 16.888ZM10.272 14.387C10.18 14.307 10.087 14.216 9.994 14.125C9.341 14.575 8.566 14.977 7.613 15.268C7.54 15.289 7.466 15.3 7.393 15.3C7.073 15.3 6.775 15.092 6.677 14.769C6.556 14.373 6.779 13.953 7.175 13.832C7.912 13.607 8.525 13.307 9.04 12.966C8.597 12.284 8.27 11.532 8.08 10.747C7.982 10.345 8.229 9.94 8.632 9.842C9.035 9.743 9.44 9.992 9.538 10.394C9.673 10.95 9.901 11.483 10.196 11.974C11.037 11.04 11.403 10.036 11.557 9.39H7.093C6.679 9.39 6.343 9.054 6.343 8.64C6.343 8.226 6.679 7.89 7.093 7.89H9.639V7.781C9.639 7.367 9.975 7.031 10.389 7.031C10.803 7.031 11.139 7.367 11.139 7.781V7.89H12.396C12.396 7.89 12.4 7.89 12.403 7.89H14.042C14.456 7.89 14.792 8.226 14.792 8.64C14.792 9.054 14.456 9.39 14.042 9.39H13.095C12.994 9.935 12.795 10.566 12.559 11.085C12.268 11.724 11.815 12.454 11.15 13.148C11.184 13.179 11.221 13.225 11.254 13.254C11.567 13.526 11.601 13.999 11.33 14.312C11.182 14.483 10.973 14.571 10.763 14.571C10.589 14.571 10.414 14.51 10.272 14.387ZM16.218 2.5H7.783C4.623 2.5 2.5 4.723 2.5 8.031V15.97C2.5 19.278 4.623 21.5 7.783 21.5H16.217C19.377 21.5 21.5 19.278 21.5 15.97V8.031C21.5 4.723 19.377 2.5 16.218 2.5Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-sm font-semibold">xcstrings editor</span>
        </div>

        {catalog && (
          <>
            <Separator orientation="vertical" className="mx-1.5 h-5" />
            <span className="truncate px-1 text-xs text-muted-foreground">{catalog.fileName}</span>
          </>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setImportDialogOpen(true)}
          >
            <FilePlus className="size-4" />
            Import
          </Button>

          {catalog && (
            <>
              <Button
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={openDiffTab}
              >
                <FileDiff className="size-4" />
                Diff
                {catalog.dirtyKeys.size > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                    {catalog.dirtyKeys.size}
                  </Badge>
                )}
              </Button>

              <Button
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setAddLanguageDialogOpen(true)}
              >
                <Languages className="size-4" />
                Add language
              </Button>

              <Button
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setExportDialogOpen(true)}
              >
                <Download className="size-4" />
                Export or publish
              </Button>

              <Button
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete file locally
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file locally?</DialogTitle>
            <DialogDescription>
              This removes the currently loaded catalog and any pending changes from this device.
              You can import the file again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Keep editing
            </DialogClose>
            <Button type="button" variant="destructive" onClick={handleConfirmDelete} autoFocus>
              Delete file locally
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
