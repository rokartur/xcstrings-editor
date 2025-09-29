import { useId } from 'react'

import { Select } from './ui/select.tsx'
import { Label } from './ui/label.tsx'

interface LanguagePickerProps {
  languages: string[]
  value?: string
  onSelect: (locale: string) => void
  disabled?: boolean
  placeholder?: string
  label?: string
}

export function LanguagePicker({
  languages,
  value,
  onSelect,
  disabled,
  placeholder = 'Select language',
  label = 'Available languages',
}: LanguagePickerProps) {
  const selectId = useId()

  return (
    <div className="space-y-2">
      <Label htmlFor={selectId}>{label}</Label>
      <Select
        id={selectId}
        value={value ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        disabled={disabled || languages.length === 0}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {languages.map((language) => (
          <option key={language} value={language}>
            {language}
          </option>
        ))}
      </Select>
    </div>
  )
}
