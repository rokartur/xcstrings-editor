import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { CatalogEntry, ParsedCatalog, XcStringsDocument } from './xcstrings'
import { parseXcStrings, resolveLocaleValue, serializeDocument, setValueForLocale } from './xcstrings'

interface CatalogState extends ParsedCatalog {
  fileName: string
  dirtyKeys: Set<string>
  originalDocument: XcStringsDocument
  originalContent: string
}

interface CatalogContextValue {
  catalog: CatalogState | null
  setCatalogFromFile: (fileName: string, fileContent: string, originalContent?: string) => void
  updateTranslation: (key: string, locale: string, value: string) => void
  resetCatalog: () => void
  exportContent: () => { fileName: string; content: string } | null
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined)

const STORAGE_KEY = 'xcstrings-editor-catalog'

interface StoredCatalogPayload {
  fileName: string
  content: string
  originalContent?: string
  timestamp: number
}

function persistCatalog(
  fileName: string,
  document: XcStringsDocument,
  originalDocument: XcStringsDocument,
  originalContent?: string,
) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const serializedOriginal = originalContent ?? serializeDocument(originalDocument)
    const payload: StoredCatalogPayload = {
      fileName,
      content: serializeDocument(document),
      originalContent: serializedOriginal,
      timestamp: Date.now(),
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (error) {
    console.warn('Failed to persist catalog', error)
  }
}

function clearPersistedCatalog() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear persisted catalog', error)
  }
}

function collectLocalesForKey(
  key: string,
  document: XcStringsDocument,
  originalDocument: XcStringsDocument,
) {
  const locales = new Set<string>()

  const addFromEntry = (entry: XcStringsDocument['strings'][string] | undefined) => {
    if (!entry?.localizations) {
      return
    }
    for (const locale of Object.keys(entry.localizations)) {
      if (locale.trim()) {
        locales.add(locale)
      }
    }
  }

  addFromEntry(document.strings[key])
  addFromEntry(originalDocument.strings[key])

  const addFromDocument = (doc: XcStringsDocument) => {
    if (doc.sourceLanguage) {
      locales.add(doc.sourceLanguage)
    }
    if (Array.isArray(doc.availableLocales)) {
      for (const locale of doc.availableLocales) {
        if (typeof locale === 'string' && locale.trim()) {
          locales.add(locale)
        }
      }
    }
  }

  addFromDocument(document)
  addFromDocument(originalDocument)

  return locales
}

function isEntryDirty(
  key: string,
  document: XcStringsDocument,
  originalDocument: XcStringsDocument,
) {
  const currentEntry = document.strings[key]
  const originalEntry = originalDocument.strings[key]

  if (!currentEntry && !originalEntry) {
    return false
  }

  if (!currentEntry || !originalEntry) {
    return true
  }

  const currentComment = currentEntry.comment ?? ''
  const originalComment = originalEntry.comment ?? ''

  if (currentComment !== originalComment) {
    return true
  }

  const locales = collectLocalesForKey(key, document, originalDocument)

  for (const locale of locales) {
    const currentValue = resolveLocaleValue(currentEntry, locale, document.sourceLanguage, key)
    const previousValue = resolveLocaleValue(originalEntry, locale, originalDocument.sourceLanguage, key)

    if (currentValue !== previousValue) {
      return true
    }
  }

  return false
}

function calculateDirtyKeys(document: XcStringsDocument, originalDocument: XcStringsDocument) {
  const keys = new Set<string>([
    ...Object.keys(originalDocument.strings ?? {}),
    ...Object.keys(document.strings ?? {}),
  ])
  const dirty = new Set<string>()

  for (const key of keys) {
    if (isEntryDirty(key, document, originalDocument)) {
      dirty.add(key)
    }
  }

  return dirty
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<CatalogState | null>(null)

  const setCatalogFromFile = useCallback(
    (fileName: string, fileContent: string, originalContent?: string) => {
      const parsed = parseXcStrings(fileContent)

      let originalDocument: XcStringsDocument | null = null

      if (originalContent) {
        try {
          const parsedOriginal = JSON.parse(originalContent) as XcStringsDocument
          if (parsedOriginal && typeof parsedOriginal === 'object' && parsedOriginal.strings) {
            originalDocument = parsedOriginal
          }
        } catch (error) {
          console.warn('Failed to parse original catalog content', error)
        }
      }

      if (!originalDocument) {
        originalDocument = structuredClone(parsed.document)
      }

      const serializedOriginal = serializeDocument(originalDocument)
      const dirtyKeys = calculateDirtyKeys(parsed.document, originalDocument)

      persistCatalog(fileName, parsed.document, originalDocument, serializedOriginal)

      setCatalog({
        ...parsed,
        fileName,
        dirtyKeys,
        originalDocument,
        originalContent: serializedOriginal,
      })
    },
    [],
  )

  const updateEntries = useCallback(
    (entries: CatalogEntry[], key: string, locale: string, value: string) =>
      entries.map((entry) => {
        if (entry.key !== key) {
          return entry
        }

        if (entry.values[locale] === value) {
          return entry
        }

        return {
          ...entry,
          values: {
            ...entry.values,
            [locale]: value,
          },
        }
      }),
    [],
  )

  const updateTranslation = useCallback(
    (key: string, locale: string, value: string) => {
      setCatalog((current) => {
        if (!current) {
          return current
        }

        const entry = current.document.strings[key]

        if (!entry) {
          return current
        }

        const nextDocument = structuredClone(current.document)
        const nextEntry = nextDocument.strings[key]

        setValueForLocale(nextEntry, locale, value)

        const nextDirty = new Set(current.dirtyKeys)
        if (isEntryDirty(key, nextDocument, current.originalDocument)) {
          nextDirty.add(key)
        } else {
          nextDirty.delete(key)
        }

        persistCatalog(current.fileName, nextDocument, current.originalDocument, current.originalContent)

        return {
          ...current,
          document: nextDocument,
          entries: updateEntries(current.entries, key, locale, value),
          dirtyKeys: nextDirty,
          originalDocument: current.originalDocument,
          originalContent: current.originalContent,
        }
      })
    },
    [updateEntries],
  )

  const resetCatalog = useCallback(() => {
    setCatalog(null)
    clearPersistedCatalog()
  }, [])

  const exportContent = useCallback(() => {
    if (!catalog) {
      return null
    }

    const content = serializeDocument(catalog.document)
    return {
      fileName: catalog.fileName,
      content,
    }
  }, [catalog])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)

      if (!stored) {
        return
      }

      const payload = JSON.parse(stored) as StoredCatalogPayload

      if (!payload || typeof payload.fileName !== 'string' || typeof payload.content !== 'string') {
        return
      }

      const originalContent =
        typeof payload.originalContent === 'string' ? payload.originalContent : payload.content

      setCatalogFromFile(payload.fileName, payload.content, originalContent)
    } catch (error) {
      console.warn('Failed to restore catalog from storage', error)
    }
  }, [setCatalogFromFile])

  const value = useMemo<CatalogContextValue>(
    () => ({ catalog, setCatalogFromFile, updateTranslation, resetCatalog, exportContent }),
    [catalog, exportContent, resetCatalog, setCatalogFromFile, updateTranslation],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const context = useContext(CatalogContext)

  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider')
  }

  return context
}
