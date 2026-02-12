import { useMemo, useState } from 'react'
import Fuse from 'fuse.js'

import { Input } from '@/components/ui/input'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'

interface SearchItem {
  key: string
  locale: string
  value: string
  comment: string | undefined
}

export function SearchPanel() {
  const { catalog } = useCatalog()
  const { openLocaleTab, setActiveTab, requestJumpToEntry } = useEditorStore()
  const [query, setQuery] = useState('')

  const { fuse } = useMemo(() => {
    if (!catalog) return { fuse: null, items: [] }

    const searchItems: SearchItem[] = []
    for (const entry of catalog.entries) {
      for (const lang of catalog.languages) {
        searchItems.push({
          key: entry.key,
          locale: lang,
          value: entry.values[lang] ?? '',
          comment: entry.comment,
        })
      }
    }

    const fuseInstance = new Fuse(searchItems, {
      keys: ['key', 'value', 'comment'],
      threshold: 0.3,
      includeMatches: true,
    })

    return { fuse: fuseInstance, items: searchItems }
  }, [catalog])

  const results = useMemo(() => {
    if (!fuse || !query.trim()) return []
    return fuse.search(query.trim(), { limit: 50 })
  }, [fuse, query])

  if (!catalog) {
    return (
      <div className="p-3 text-xs text-muted-foreground">Import a catalog to search.</div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 overflow-hidden p-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search keys, values, comments..."
        className="h-7 text-xs truncate"
      />
      {query.trim() && (
        <div className="text-[11px] text-muted-foreground">
          {results.length} result{results.length !== 1 ? 's' : ''}
        </div>
      )}
      <div className="flex w-full min-w-0 flex-col overflow-hidden">
        {results.map((result) => (
          <button
            key={`${result.item.key}-${result.item.locale}`}
            type="button"
            className="flex w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
            onClick={() => {
              openLocaleTab(result.item.locale)
              setActiveTab(result.item.locale)
              requestJumpToEntry(result.item.locale, result.item.key)
            }}
          >
            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
              <span className="block min-w-0 truncate font-medium">{result.item.key}</span>
              <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                {result.item.locale}
              </span>
            </div>
            {result.item.value && (
              <span className="block min-w-0 truncate text-muted-foreground">{result.item.value}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
