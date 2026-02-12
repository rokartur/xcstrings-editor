import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { CloudUpload } from 'lucide-react'

import { Button } from './ui/button.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card.tsx'
import { cn } from '../lib/utils.ts'

interface LoadedFile {
  fileName: string
  content: string
}

interface FileUploaderProps {
  onFilesLoaded: (files: LoadedFile[]) => Promise<void> | void
  disabled?: boolean
  multiple?: boolean
  variant?: 'default' | 'minimal'
}

export function FileUploader({ onFilesLoaded, disabled, multiple = false, variant = 'default' }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setDragging] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    const loaded = await Promise.all(
      Array.from(files).map(async (file) => ({
        fileName: file.name,
        content: await file.text(),
      })),
    )

    await onFilesLoaded(loaded)

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const onInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await handleFiles(event.target.files)
  }

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) {
      return
    }
    await handleFiles(event.dataTransfer.files)
  }

  if (variant === 'minimal') {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex h-24 items-center justify-between gap-3 rounded-md border border-dashed px-3 transition-colors',
            isDragging ? 'border-primary/50 bg-primary/5' : 'border-border/70 bg-background/40',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">Drop .xcstrings here</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              or choose from disk
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            Browse
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xcstrings,application/json"
          multiple={multiple}
          className="hidden"
          onChange={onInputChange}
          disabled={disabled}
        />
      </div>
    )
  }

  return (
    <Card className="overflow-hidden border border-primary/20 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <CloudUpload className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Upload .xcstrings files</CardTitle>
            <CardDescription>Drag & drop translation catalogs or browse from your computer.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) {
              setDragging(true)
            }
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'group relative flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-gradient-to-br from-muted/40 via-muted/20 to-background text-center transition-all',
            isDragging ? 'border-primary/50 shadow-inner' : 'hover:border-primary/40 hover:shadow-md',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Drop files to import
            </span>
            <p className="text-sm font-medium text-foreground">Drag & drop your .xcstrings files</p>
            <p className="text-xs text-muted-foreground">You can drop multiple files and we&apos;ll queue them automatically.</p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xcstrings,application/json"
          multiple={multiple}
          className="hidden"
          onChange={onInputChange}
          disabled={disabled}
        />
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Accepted formats: <code>.xcstrings</code> or JSON exports from Xcode.
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={disabled} className="w-full sm:w-auto">
          Browse files
        </Button>
      </CardFooter>
    </Card>
  )
}
