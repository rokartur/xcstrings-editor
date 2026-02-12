import { X } from 'lucide-react'

import { DIFF_TAB_ID, useEditorStore } from '@/lib/editor-store'
import { findLocaleOption, formatLocaleCode } from '@/lib/locale-options'
import { cn } from '@/lib/utils'

function getLocaleTabLabel(rawLocale: string): string {
  if (rawLocale === DIFF_TAB_ID) return 'Diff'
  const formatted = formatLocaleCode(rawLocale)
  if (formatted.toLowerCase() === 'base') return 'Base'
  const language = findLocaleOption(formatted)?.language
  if (language && language.trim().length > 0 && language.toLowerCase() !== formatted.toLowerCase()) {
    return `${language} (${formatted})`
  }
  return formatted
}

export function EditorTabBar() {
  const { openTabs, activeTab, setActiveTab, closeLocaleTab } = useEditorStore()

  if (openTabs.length === 0) return null

  return (
    <div className="flex h-9 shrink-0 items-center border-b border-border bg-background">
      {openTabs.map((tab) => {
        const isActive = tab === activeTab
        const label = getLocaleTabLabel(tab)
        return (
          <div
            key={tab}
            className={cn(
              'group relative flex h-full cursor-pointer items-center gap-1 border-r border-border px-3 text-xs',
              isActive
                ? 'bg-background text-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50',
            )}
            onClick={() => setActiveTab(tab)}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                closeLocaleTab(tab)
              }
            }}
          >
            {isActive && (
              <div className="absolute inset-x-0 top-0 h-px bg-primary" />
            )}
            <span className="max-w-40 truncate" title={label}>{label}</span>
            <button
              type="button"
              className="ml-1 rounded p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                closeLocaleTab(tab)
              }}
            >
              <X className="size-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
