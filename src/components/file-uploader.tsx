import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { Button } from './ui/button.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card.tsx'
import { cn } from '../lib/utils.ts'

interface FileUploaderProps {
  onFileLoaded: (fileName: string, content: string) => Promise<void> | void
  disabled?: boolean
}

export function FileUploader({ onFileLoaded, disabled }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setDragging] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    const file = files[0]
    const content = await file.text()
    await onFileLoaded(file.name, content)

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload .xcstrings file</CardTitle>
        <CardDescription>Supports translation catalogs exported from Xcode in JSON format.</CardDescription>
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
            'flex h-44 flex-col items-center justify-center rounded-md border-2 border-dashed border-border text-center transition-colors',
            isDragging ? 'border-ring bg-muted/40' : 'hover:border-ring',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <p className="text-sm font-medium">Drag & drop a file here or use the button below</p>
          <p className="mt-2 text-xs text-muted-foreground">Accepted extensions: .xcstrings, .json</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xcstrings,application/json"
          className="hidden"
          onChange={onInputChange}
          disabled={disabled}
        />
      </CardContent>
      <CardFooter>
        <Button onClick={() => inputRef.current?.click()} disabled={disabled} className="w-full sm:w-auto">
          Choose file
        </Button>
      </CardFooter>
    </Card>
  )
}
