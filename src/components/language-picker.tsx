import { useEffect, useId, useMemo, useState } from 'react'

import { Check, ChevronsUpDown, Sparkles } from 'lucide-react'
import Fuse from 'fuse.js'

import { Button } from '@/components/ui/button.tsx'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx'
import { findLocaleOption } from '@/lib/locale-options.ts'
import { cn } from '@/lib/utils.ts'

interface LanguagePickerProps {
  languages: string[]
  value?: string
  onSelect: (locale: string) => void
  disabled?: boolean
  placeholder?: string
  label?: string
}

const fuseOptions: Fuse.IFuseOptions<LanguageOption> = {
  keys: [
    { name: 'code', weight: 0.5 },
    { name: 'label', weight: 0.3 },
    { name: 'keywords', weight: 0.2 },
  ],
  threshold: 0.35,
  minMatchCharLength: 1,
}

type LanguageOption = {
  code: string
  label: string
  keywords: string
}

const MAX_RESULTS = 200

export function LanguagePicker({
  languages,
  value,
  onSelect,
  disabled,
  placeholder = 'Select language',
  label = 'Available languages',
}: LanguagePickerProps) {
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const options = useMemo<LanguageOption[]>(
    () =>
      languages.map((code) => {
        const option = findLocaleOption(code)
        const displayName = option?.label ?? code
        const keywords = [code, option?.label, option?.location, option?.language]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return {
          code,
          label: displayName,
          keywords,
        }
      }),
    [languages],
  )

  const fuse = useMemo(() => new Fuse(options, fuseOptions), [options])

  const suggestions = useMemo(() => {
    if (query.trim().length === 0) {
      // Show all options (up to a safe cap) and let the CommandList scroll.
      return options.slice(0, MAX_RESULTS)
    }
    return fuse
      .search(query.trim())
      .map((result) => result.item)
      .slice(0, MAX_RESULTS)
  }, [fuse, options, query])

  const activeOption = value ? options.find((option) => option.code === value) : null

  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  const handleSelect = (code: string) => {
    onSelect(code)
    setOpen(false)
  }

  const handleCustomSubmit = () => {
    const normalized = query.trim()
    if (!normalized) return
    onSelect(normalized)
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="flex items-center gap-1 text-sm font-medium">
        <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
        {label}
      </Label>
      <Popover open={open} onOpenChange={(nextOpen: boolean) => {
        if (disabled) return
        setOpen(nextOpen)
      }}>
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || languages.length === 0}
            className={cn(
              'h-8 w-full justify-between rounded-lg px-2.5 text-left text-sm',
              disabled && 'opacity-60',
            )}
          >
            <span className="truncate">
              {activeOption ? `${activeOption.label} (${activeOption.code})` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(320px,90vw)] p-0" align="start">
          <Command shouldFilter={false} className="border-0 shadow-none">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Type to search locales..."
              autoFocus
            />
            <CommandList
              // When used inside scrollable dialogs/panels, prevent the parent from
              // stealing the wheel/trackpad scroll from this list.
              onWheelCapture={(e) => e.stopPropagation()}
              onTouchMoveCapture={(e) => e.stopPropagation()}
            >
              <CommandEmpty>No languages found.</CommandEmpty>
              <CommandGroup heading="Matches">
                {suggestions.map((option: LanguageOption) => (
                  <CommandItem
                    key={option.code}
                    value={option.code}
                    onSelect={(selected: string) => handleSelect(selected)}
                  >
                    <Check
                      className={cn('size-4', value === option.code ? 'opacity-100' : 'opacity-0')}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {query.trim() &&
                !options.find((option) => option.code.toLowerCase() === query.trim().toLowerCase()) && (
                <CommandGroup heading="Use custom">
                  <CommandItem value={query.trim()} onSelect={handleCustomSubmit}>
                    <Check className="size-4 opacity-0" aria-hidden="true" />
                    <span className="font-medium">Use “{query.trim()}”</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
