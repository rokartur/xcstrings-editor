import { Moon, Sun } from 'lucide-react'

import { useCatalog } from '@/lib/catalog-context'
import { useTheme } from '@/lib/theme-context'

export function StatusBar() {
  const { catalog } = useCatalog()
  const { theme, toggleTheme } = useTheme()

  const dirtyCount = catalog ? catalog.dirtyKeys.size : 0

  return (
    <div className="flex h-7 shrink-0 items-center border-t border-border bg-background px-3 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-3">
        {catalog ? (
          <>
            <span>{catalog.fileName}</span>
            <span>{catalog.languages.length} languages</span>
            <span>{catalog.entries.length} keys</span>
          </>
        ) : (
          <span>No catalog loaded</span>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {dirtyCount > 0 && <span className="font-medium text-foreground">{dirtyCount} dirty</span>}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-1 hover:text-foreground"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </div>
  )
}
