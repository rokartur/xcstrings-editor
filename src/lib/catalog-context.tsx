import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { CatalogEntry, ParsedCatalog, XcStringsDocument } from './xcstrings'
import { parseXcStrings, resolveLocaleValue, serializeDocument, setValueForLocale } from './xcstrings'

interface CatalogState extends ParsedCatalog {
  id: string
  fileName: string
  dirtyKeys: Set<string>
  originalDocument: XcStringsDocument
  originalContent: string
}

export interface CatalogSummary {
  id: string
  fileName: string
  timestamp: number
  lastOpened: number
}

interface CatalogContextValue {
  catalog: CatalogState | null
  storedCatalogs: CatalogSummary[]
  setCatalogFromFile: (
    fileName: string,
    fileContent: string,
    originalContent?: string,
    options?: { catalogId?: string },
  ) => void
  loadCatalogById: (catalogId: string) => void
  removeCatalog: (catalogId: string) => void
  updateTranslation: (key: string, locale: string, value: string) => void
  resetCatalog: () => void
  exportContent: () => { fileName: string; content: string } | null
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined)

const STORAGE_KEY = 'xcstrings-editor-catalogs'
const LEGACY_STORAGE_KEY = 'xcstrings-editor-catalog'
const STORAGE_VERSION = 2

interface StoredCatalogRecord {
  id: string
  fileName: string
  content: string
  originalContent?: string
  timestamp: number
  lastOpened: number
}

interface StoredCatalogState {
  version: number
  currentId: string | null
  catalogs: StoredCatalogRecord[]
}

interface LegacyStoredCatalogPayload {
  fileName: string
  content: string
  originalContent?: string
  timestamp: number
}

function createCatalogId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function normalizeRecord(entry: Partial<StoredCatalogRecord>): StoredCatalogRecord | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const { id, fileName, content } = entry

  if (typeof id !== 'string' || !id) {
    return null
  }

  if (typeof fileName !== 'string' || !fileName) {
    return null
  }

  if (typeof content !== 'string') {
    return null
  }

  const timestamp = typeof entry.timestamp === 'number' ? entry.timestamp : Date.now()
  const lastOpened = typeof entry.lastOpened === 'number' ? entry.lastOpened : timestamp

  return {
    id,
    fileName,
    content,
    originalContent: typeof entry.originalContent === 'string' ? entry.originalContent : undefined,
    timestamp,
    lastOpened,
  }
}

function summariesFromRecords(records: StoredCatalogRecord[]): CatalogSummary[] {
  return [...records]
    .sort((a, b) => b.lastOpened - a.lastOpened)
    .map((record) => ({
      id: record.id,
      fileName: record.fileName,
      timestamp: record.timestamp,
      lastOpened: record.lastOpened,
    }))
}

function readStoredState(): StoredCatalogState {
  if (typeof window === 'undefined') {
    return { version: STORAGE_VERSION, currentId: null, catalogs: [] }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredCatalogState>
      if (parsed && Array.isArray(parsed.catalogs)) {
        const catalogs = parsed.catalogs
          .map((entry) => normalizeRecord(entry))
          .filter((entry): entry is StoredCatalogRecord => entry !== null)

        return {
          version: typeof parsed.version === 'number' ? parsed.version : STORAGE_VERSION,
          currentId: typeof parsed.currentId === 'string' ? parsed.currentId : null,
          catalogs,
        }
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      const payload = JSON.parse(legacyRaw) as LegacyStoredCatalogPayload

      if (payload && typeof payload.fileName === 'string' && typeof payload.content === 'string') {
        const now = Date.now()
        const id = createCatalogId()
        const record: StoredCatalogRecord = {
          id,
          fileName: payload.fileName,
          content: payload.content,
          originalContent:
            typeof payload.originalContent === 'string' ? payload.originalContent : undefined,
          timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : now,
          lastOpened: now,
        }

        const migrated: StoredCatalogState = {
          version: STORAGE_VERSION,
          currentId: id,
          catalogs: [record],
        }

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
        return migrated
      }
    }
  } catch (error) {
    console.warn('Failed to read stored catalogs', error)
  }

  return { version: STORAGE_VERSION, currentId: null, catalogs: [] }
}

function writeStoredState(state: StoredCatalogState) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('Failed to persist catalogs', error)
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
  const [storedCatalogs, setStoredCatalogs] = useState<CatalogSummary[]>([])

  const updateStoredState = useCallback(
    (updater: (state: StoredCatalogState) => StoredCatalogState) => {
      const currentState = readStoredState()
      const nextState = updater(currentState)
      writeStoredState(nextState)
      setStoredCatalogs(summariesFromRecords(nextState.catalogs))
      return nextState
    },
    [],
  )

  const setCatalogFromFile = useCallback(
    (
      fileName: string,
      fileContent: string,
      originalContent?: string,
      options?: { catalogId?: string },
    ) => {
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

      const serializedDocument = serializeDocument(parsed.document)
      const serializedOriginal = originalContent ?? serializeDocument(originalDocument)
      const dirtyKeys = calculateDirtyKeys(parsed.document, originalDocument)
      const catalogId = options?.catalogId ?? createCatalogId()
      const lastOpened = Date.now()

      updateStoredState((state) => {
        const index = state.catalogs.findIndex((entry) => entry.id === catalogId)
        const nextRecord: StoredCatalogRecord = {
          id: catalogId,
          fileName,
          content: serializedDocument,
          originalContent: serializedOriginal,
          timestamp: index === -1 ? lastOpened : state.catalogs[index].timestamp,
          lastOpened,
        }

        const nextCatalogs = index === -1
          ? [...state.catalogs, nextRecord]
          : state.catalogs.map((entry, entryIndex) => (entryIndex === index ? nextRecord : entry))

        return {
          version: STORAGE_VERSION,
          currentId: catalogId,
          catalogs: nextCatalogs,
        }
      })

      setCatalog({
        ...parsed,
        id: catalogId,
        fileName,
        dirtyKeys,
        originalDocument,
        originalContent: serializedOriginal,
      })
    },
    [updateStoredState],
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

        const serializedContent = serializeDocument(nextDocument)

        updateStoredState((state) => {
          const index = state.catalogs.findIndex((entry) => entry.id === current.id)
          if (index === -1) {
            return state
          }

          const existing = state.catalogs[index]
          const updatedRecord: StoredCatalogRecord = {
            ...existing,
            content: serializedContent,
          }

          const nextCatalogs = [...state.catalogs]
          nextCatalogs[index] = updatedRecord

          return {
            version: STORAGE_VERSION,
            currentId: current.id,
            catalogs: nextCatalogs,
          }
        })

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
    [updateEntries, updateStoredState],
  )

  const loadCatalogById = useCallback(
    (catalogId: string) => {
      const stored = readStoredState()
      const record = stored.catalogs.find((entry) => entry.id === catalogId)

      if (!record) {
        return
      }

      setCatalogFromFile(record.fileName, record.content, record.originalContent, { catalogId })
    },
    [setCatalogFromFile],
  )

  const resetCatalog = useCallback(() => {
    setCatalog((current) => {
      const currentId = current?.id ?? null

      updateStoredState((state) => {
        if (!currentId) {
          return {
            version: STORAGE_VERSION,
            currentId: null,
            catalogs: state.catalogs,
          }
        }

        const nextCatalogs = state.catalogs.filter((entry) => entry.id !== currentId)
        const nextCurrentId = state.currentId === currentId ? null : state.currentId

        return {
          version: STORAGE_VERSION,
          currentId: nextCurrentId,
          catalogs: nextCatalogs,
        }
      })

      return null
    })
  }, [updateStoredState])

  const removeCatalog = useCallback(
    (catalogId: string) => {
      setCatalog((current) => (current?.id === catalogId ? null : current))

      updateStoredState((state) => {
        const nextCatalogs = state.catalogs.filter((entry) => entry.id !== catalogId)
        const nextCurrentId = state.currentId === catalogId ? null : state.currentId

        return {
          version: STORAGE_VERSION,
          currentId: nextCurrentId,
          catalogs: nextCatalogs,
        }
      })
    },
    [updateStoredState],
  )

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
    const stored = readStoredState()
    setStoredCatalogs(summariesFromRecords(stored.catalogs))

    if (!stored.currentId) {
      return
    }

    const record = stored.catalogs.find((entry) => entry.id === stored.currentId)

    if (!record) {
      return
    }

    setCatalogFromFile(record.fileName, record.content, record.originalContent, {
      catalogId: record.id,
    })
  }, [setCatalogFromFile])

  const value = useMemo<CatalogContextValue>(
    () => ({
      catalog,
      storedCatalogs,
      setCatalogFromFile,
      loadCatalogById,
      removeCatalog,
      updateTranslation,
      resetCatalog,
      exportContent,
    }),
    [catalog, exportContent, loadCatalogById, removeCatalog, resetCatalog, setCatalogFromFile, storedCatalogs, updateTranslation],
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
