import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import type { CatalogEntry, ParsedCatalog, XcStringsDocument } from './xcstrings'
import { parseXcStrings, resolveLocaleValue, serializeDocument, setValueForLocale } from './xcstrings'
import { applyJsonChanges, detectFormattingOptions } from './json-edit'
import { formatLocaleCode } from './locale-options'
import { addKnownRegion } from './pbxproj'

const STORAGE_DEBOUNCE_MS = 1500

export interface GithubCatalogSource {
  type: 'github'
  owner: string
  repo: string
  branch: string
  path: string
  sha: string
}

export interface UploadCatalogSource {
  type: 'upload'
}

export type CatalogSource = GithubCatalogSource | UploadCatalogSource

interface ProjectFileState {
  path: string
  currentContent: string
  originalContent: string
  dirty: boolean
}

interface CatalogState extends ParsedCatalog {
  id: string
  fileName: string
  dirtyKeys: Set<string>
  documentDirty: boolean
  originalDocument: XcStringsDocument
  originalContent: string
  currentContent: string
  source?: CatalogSource
  projectFile?: ProjectFileState
}

export interface CatalogSummary {
  id: string
  fileName: string
  timestamp: number
  lastOpened: number
}

interface CatalogContextValue {
  catalog: CatalogState | null
  catalogLoading: boolean
  storedCatalogs: CatalogSummary[]
  setCatalogFromFile: (
    fileName: string,
    fileContent: string,
    originalContent?: string,
    options?: { catalogId?: string; source?: CatalogSource },
  ) => void
  loadCatalogById: (catalogId: string) => void
  removeCatalog: (catalogId: string) => void
  updateTranslation: (key: string, locale: string, value: string) => void
  addLanguage: (locale: string) => void
  resetCatalog: () => void
  exportContent: () => { fileName: string; content: string } | null
  attachProjectFile: (path: string, content: string, originalContent?: string) => void
  updateProjectFilePath: (path: string) => void
  exportProjectFile: () => { path: string; content: string } | null
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined)

const STORAGE_KEY = 'xcstrings-editor-catalogs'
const LEGACY_STORAGE_KEY = 'xcstrings-editor-catalog'
const STORAGE_VERSION = 2

interface StoredProjectFileRecord {
  path: string
  content: string
  originalContent: string
}

interface StoredCatalogRecord {
  id: string
  fileName: string
  content: string
  originalContent: string
  timestamp: number
  lastOpened: number
  source?: CatalogSource
  projectFile?: StoredProjectFileRecord
  documentDirty?: boolean
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

function normalizeSource(value: unknown): CatalogSource | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const source = value as { [key: string]: unknown }

  if (source.type === 'github') {
    const owner = typeof source.owner === 'string' ? source.owner : null
    const repo = typeof source.repo === 'string' ? source.repo : null
    const branch = typeof source.branch === 'string' ? source.branch : null
    const path = typeof source.path === 'string' ? source.path : null
    const sha = typeof source.sha === 'string' ? source.sha : null

    if (owner && repo && branch && path && sha) {
      return {
        type: 'github',
        owner,
        repo,
        branch,
        path,
        sha,
      }
    }
  }

  if (source.type === 'upload') {
    return { type: 'upload' }
  }

  return undefined
}

function normalizeProjectFileRecord(value: unknown): StoredProjectFileRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const record = value as { [key: string]: unknown }
  const path = typeof record.path === 'string' ? record.path.trim() : ''
  const content = typeof record.content === 'string' ? record.content : null
  const original = typeof record.originalContent === 'string' ? record.originalContent : content

  if (!path || !content) {
    return undefined
  }

  return {
    path,
    content,
    originalContent: original ?? content,
  }
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
  const originalContent = typeof entry.originalContent === 'string' ? entry.originalContent : content
  const source = normalizeSource(entry.source)
  const projectFile = normalizeProjectFileRecord(entry.projectFile)

  const record: StoredCatalogRecord = {
    id,
    fileName,
    content,
    originalContent,
    timestamp,
    lastOpened,
  }

  if (source) {
    record.source = source
  }

  if (projectFile) {
    record.projectFile = projectFile
  }

  return record
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
            typeof payload.originalContent === 'string' ? payload.originalContent : payload.content,
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
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [storedCatalogs, setStoredCatalogs] = useState<CatalogSummary[]>([])
  const storageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingStorageState = useRef<StoredCatalogState | null>(null)

  // Flush pending storage writes on unmount
  useEffect(() => {
    return () => {
      if (storageTimerRef.current) {
        clearTimeout(storageTimerRef.current)
        if (pendingStorageState.current) {
          writeStoredState(pendingStorageState.current)
          pendingStorageState.current = null
        }
      }
    }
  }, [])

  const updateStoredState = useCallback(
    (updater: (state: StoredCatalogState) => StoredCatalogState, immediate?: boolean) => {
      const currentState = pendingStorageState.current ?? readStoredState()
      const nextState = updater(currentState)
      pendingStorageState.current = nextState
      setStoredCatalogs(summariesFromRecords(nextState.catalogs))

      if (immediate) {
        if (storageTimerRef.current) {
          clearTimeout(storageTimerRef.current)
          storageTimerRef.current = null
        }
        writeStoredState(nextState)
        pendingStorageState.current = null
      } else {
        if (storageTimerRef.current) {
          clearTimeout(storageTimerRef.current)
        }
        storageTimerRef.current = setTimeout(() => {
          storageTimerRef.current = null
          if (pendingStorageState.current) {
            writeStoredState(pendingStorageState.current)
            pendingStorageState.current = null
          }
        }, STORAGE_DEBOUNCE_MS)
      }

      return nextState
    },
    [],
  )

  const setCatalogFromFile = useCallback(
    (
      fileName: string,
      fileContent: string,
      originalContent?: string,
      options?: { catalogId?: string; source?: CatalogSource },
    ) => {
      // Show loading indicator and yield to the browser before heavy work
      setCatalogLoading(true)

      setTimeout(() => {
        try {
          _setCatalogFromFileSync(fileName, fileContent, originalContent, options)
        } finally {
          setCatalogLoading(false)
        }
      }, 0)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateStoredState],
  )

  const _setCatalogFromFileSync = useCallback(
    (
      fileName: string,
      fileContent: string,
      originalContent?: string,
      options?: { catalogId?: string; source?: CatalogSource },
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

      const currentContent = fileContent
      const serializedOriginal = originalContent ?? serializeDocument(originalDocument)
      const dirtyKeys = new Set<string>()
      const catalogId = options?.catalogId ?? createCatalogId()
      const lastOpened = Date.now()
      let resolvedSource = options?.source
      let storedProjectFile: StoredProjectFileRecord | undefined
      let storedDocumentDirty = false

      updateStoredState((state) => {
        const index = state.catalogs.findIndex((entry) => entry.id === catalogId)
        const previous = index !== -1 ? state.catalogs[index] : undefined

        if (!resolvedSource && previous?.source) {
          resolvedSource = previous.source
        }

        if (previous?.projectFile) {
          storedProjectFile = previous.projectFile
        }

        if (previous?.documentDirty) {
          storedDocumentDirty = true
        }

        const nextRecord: StoredCatalogRecord = {
          id: catalogId,
          fileName,
          content: currentContent,
          originalContent: serializedOriginal,
          timestamp: previous ? previous.timestamp : lastOpened,
          lastOpened,
        }

        if (resolvedSource) {
          nextRecord.source = resolvedSource
        }

        if (storedProjectFile) {
          nextRecord.projectFile = storedProjectFile
        }

        if (storedDocumentDirty) {
          nextRecord.documentDirty = true
        }

        const nextCatalogs = index === -1
          ? [...state.catalogs, nextRecord]
          : state.catalogs.map((entry, entryIndex) => (entryIndex === index ? nextRecord : entry))

        return {
          version: STORAGE_VERSION,
          currentId: catalogId,
          catalogs: nextCatalogs,
        }
      }, true)

      const projectFileState: ProjectFileState | undefined = storedProjectFile
        ? {
            path: storedProjectFile.path,
            currentContent: storedProjectFile.content,
            originalContent: storedProjectFile.originalContent,
            dirty: storedProjectFile.content !== storedProjectFile.originalContent,
          }
        : undefined

      const nextCatalog = {
        ...parsed,
        id: catalogId,
        fileName,
        dirtyKeys,
        documentDirty: storedDocumentDirty,
        originalDocument,
        originalContent: serializedOriginal,
        currentContent,
      } as CatalogState

      if (resolvedSource) {
        nextCatalog.source = resolvedSource
      }

      if (projectFileState) {
        nextCatalog.projectFile = projectFileState
      }

      setCatalog(nextCatalog)

      // Defer dirty-key calculation to avoid blocking the main thread on large catalogs
      const deferredOriginal = originalDocument
      const deferredDocument = parsed.document
      const deferredId = catalogId
      const scheduleCalc = typeof requestIdleCallback === 'function'
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 0)

      scheduleCalc(() => {
        const computed = calculateDirtyKeys(deferredDocument, deferredOriginal)
        setCatalog((cur) => {
          if (!cur || cur.id !== deferredId) return cur
          if (computed.size === 0 && cur.dirtyKeys.size === 0) return cur
          return { ...cur, dirtyKeys: computed }
        })
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

  // Track pending content serialization to debounce expensive JSON operations
  const contentSerializationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Flush pending serialization on unmount
  useEffect(() => {
    return () => {
      if (contentSerializationTimer.current) {
        clearTimeout(contentSerializationTimer.current)
      }
    }
  }, [])

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

        // Only clone the single entry being edited, not the entire document
        const clonedEntry = structuredClone(entry)
        setValueForLocale(clonedEntry, locale, value)
        current.document.strings[key] = clonedEntry

        const nextDirty = new Set(current.dirtyKeys)
        if (isEntryDirty(key, current.document, current.originalDocument)) {
          nextDirty.add(key)
        } else {
          nextDirty.delete(key)
        }

        // Debounce the expensive JSON content serialization
        if (contentSerializationTimer.current) {
          clearTimeout(contentSerializationTimer.current)
        }

        const catalogId = current.id
        contentSerializationTimer.current = setTimeout(() => {
          contentSerializationTimer.current = null
          setCatalog((cur) => {
            if (!cur || cur.id !== catalogId) return cur

            const formatting = detectFormattingOptions(cur.currentContent)
            const nextContent = applyJsonChanges(
              cur.currentContent,
              [
                {
                  path: ['strings', key],
                  value: cur.document.strings[key],
                },
              ],
              formatting,
            )

            updateStoredState((state) => {
              const index = state.catalogs.findIndex((entry) => entry.id === cur.id)
              if (index === -1) {
                return state
              }

              const existing = state.catalogs[index]!
              const updatedRecord: StoredCatalogRecord = {
                ...existing,
                content: nextContent,
                documentDirty: true,
              }

              const nextCatalogs = [...state.catalogs]
              nextCatalogs[index] = updatedRecord

              return {
                version: STORAGE_VERSION,
                currentId: cur.id,
                catalogs: nextCatalogs,
              }
            })

            return {
              ...cur,
              currentContent: nextContent,
            }
          })
        }, 500)

        return {
          ...current,
          entries: updateEntries(current.entries, key, locale, value),
          dirtyKeys: nextDirty,
          documentDirty: true,
        }
      })
    },
    [updateEntries, updateStoredState],
  )

  const addLanguage = useCallback(
    (locale: string) => {
      const formatted = formatLocaleCode(locale).trim()
      if (!formatted) {
        return
      }

      setCatalog((current) => {
        if (!current) {
          return current
        }

        const normalizedExisting = new Set(
          current.languages.map((entry) => formatLocaleCode(entry).toLowerCase()),
        )

        if (normalizedExisting.has(formatted.toLowerCase())) {
          return current
        }

        const nextLanguages = [...current.languages, formatted].sort((a, b) =>
          a.localeCompare(b, 'en', { sensitivity: 'base' }),
        )

        // Update availableLocales on the existing document in-place (lightweight)
        const availableLocales = new Set(current.document.availableLocales ?? [])
        availableLocales.add(formatted)
        current.document.availableLocales = Array.from(availableLocales).sort((a, b) =>
          a.localeCompare(b, 'en', { sensitivity: 'base' }),
        )

        // Add empty values for the new locale to each entry's values map
        // This is fast — we only add one key to existing objects, no deep clone
        const nextEntries = current.entries.map((entry) => ({
          ...entry,
          values: {
            ...entry.values,
            [formatted]: '',
          },
        }))

        // Handle project file synchronously (pbxproj is small)
        let nextProjectFileState = current.projectFile

        if (current.projectFile) {
          const projectUpdate = addKnownRegion(current.projectFile.currentContent, formatted)
          if (projectUpdate.updated) {
            nextProjectFileState = {
              ...current.projectFile,
              currentContent: projectUpdate.content,
              dirty: true,
            }
          }
        }

        const nextState = {
          ...current,
          languages: nextLanguages,
          entries: nextEntries,
          dirtyKeys: new Set(current.dirtyKeys),
          documentDirty: true,
        } as CatalogState

        if (nextProjectFileState) {
          nextState.projectFile = nextProjectFileState
        }

        // Defer ALL heavy work: document mutation, JSON serialization, storage
        const catalogId = current.id
        const scheduleHeavyWork = typeof requestIdleCallback === 'function'
          ? requestIdleCallback
          : (cb: () => void) => setTimeout(cb, 0)

        scheduleHeavyWork(() => {
          setCatalog((cur) => {
            if (!cur || cur.id !== catalogId) return cur

            // Mutate document entries in-place (no structuredClone of entire doc)
            const doc = cur.document
            if (doc.strings) {
              for (const entry of Object.values(doc.strings)) {
                if (!entry) continue
                setValueForLocale(entry, formatted, '')
              }
            }

            // Full serialization is MUCH faster than 900+ individual jsonc-parser
            // modify calls. Each modify() re-parses the entire JSON string, so with
            // 900 keys the O(n²) cost freezes the browser for minutes.
            const formatting = detectFormattingOptions(cur.currentContent)
            const indent = formatting.insertSpaces
              ? ' '.repeat(formatting.tabSize ?? 2)
              : '\t'
            let nextContent = JSON.stringify(doc, null, indent)
            // Preserve trailing newline if the original had one
            if (cur.currentContent.endsWith('\n') && !nextContent.endsWith('\n')) {
              nextContent += '\n'
            }
            // Preserve EOL style (CRLF vs LF)
            if (formatting.eol === '\r\n' && !nextContent.includes('\r\n')) {
              nextContent = nextContent.replace(/\n/g, '\r\n')
            }

            // Persist to storage
            updateStoredState((state) => {
              const index = state.catalogs.findIndex((entry) => entry.id === cur.id)
              if (index === -1) {
                return state
              }

              const existing = state.catalogs[index]!
              const updatedRecord: StoredCatalogRecord = {
                ...existing,
                content: nextContent,
                documentDirty: true,
              }

              if (cur.projectFile) {
                updatedRecord.projectFile = {
                  path: cur.projectFile.path,
                  content: cur.projectFile.currentContent,
                  originalContent: cur.projectFile.originalContent,
                }
              }

              const nextCatalogs = [...state.catalogs]
              nextCatalogs[index] = updatedRecord

              return {
                ...state,
                catalogs: nextCatalogs,
              }
            })

            return {
              ...cur,
              currentContent: nextContent,
            }
          })
        })

        return nextState
      })
    },
    [updateStoredState],
  )

  const attachProjectFile = useCallback(
    (path: string, content: string, originalContent?: string) => {
      const normalizedPath = path.trim() || 'project.pbxproj'
      const currentContent = content
      const initialContent = originalContent ?? content

      setCatalog((current) => {
        if (!current) {
          return current
        }

        const nextProjectFile: ProjectFileState = {
          path: normalizedPath,
          currentContent,
          originalContent: initialContent,
          dirty: currentContent !== initialContent,
        }

        updateStoredState((state) => {
          const index = state.catalogs.findIndex((entry) => entry.id === current.id)
          if (index === -1) {
            return state
          }

          const existing = state.catalogs[index]!
          const updatedRecord: StoredCatalogRecord = {
            ...existing,
            projectFile: {
              path: normalizedPath,
              content: currentContent,
              originalContent: initialContent,
            },
          }

          const nextCatalogs = [...state.catalogs]
          nextCatalogs[index] = updatedRecord

          return {
            ...state,
            catalogs: nextCatalogs,
          }
        })

        return {
          ...current,
          projectFile: nextProjectFile,
        }
      })
    },
    [updateStoredState],
  )

  const updateProjectFilePath = useCallback(
    (path: string) => {
      const normalizedPath = path.trim()
      if (!normalizedPath) {
        return
      }

      setCatalog((current) => {
        if (!current?.projectFile) {
          return current
        }

        const nextProjectFile: ProjectFileState = {
          ...current.projectFile,
          path: normalizedPath,
        }

        updateStoredState((state) => {
          const index = state.catalogs.findIndex((entry) => entry.id === current.id)
          if (index === -1) {
            return state
          }

          const existing = state.catalogs[index]!
          const updatedRecord: StoredCatalogRecord = {
            ...existing,
            projectFile: {
              path: normalizedPath,
              content: nextProjectFile.currentContent,
              originalContent: nextProjectFile.originalContent,
            },
          }

          const nextCatalogs = [...state.catalogs]
          nextCatalogs[index] = updatedRecord

          return {
            ...state,
            catalogs: nextCatalogs,
          }
        })

        return {
          ...current,
          projectFile: nextProjectFile,
        }
      })
    },
    [updateStoredState],
  )

  const exportProjectFile = useCallback(() => {
    if (!catalog?.projectFile) {
      return null
    }

    return {
      path: catalog.projectFile.path,
      content: catalog.projectFile.currentContent,
    }
  }, [catalog])

  const loadCatalogById = useCallback(
    (catalogId: string) => {
      const stored = readStoredState()
      const record = stored.catalogs.find((entry) => entry.id === catalogId)

      if (!record) {
        return
      }

      const options: { catalogId?: string; source?: CatalogSource } = { catalogId }
      if (record.source) {
        options.source = record.source
      }

      setCatalogFromFile(record.fileName, record.content, record.originalContent, options)
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

    // If there's a pending content serialization, generate fresh content now
    if (catalog.documentDirty && contentSerializationTimer.current) {
      clearTimeout(contentSerializationTimer.current)
      contentSerializationTimer.current = null

      // Full serialization instead of 900+ individual jsonc-parser patches
      const formatting = detectFormattingOptions(catalog.currentContent)
      const indent = formatting.insertSpaces
        ? ' '.repeat(formatting.tabSize ?? 2)
        : '\t'
      let freshContent = JSON.stringify(catalog.document, null, indent)
      if (catalog.currentContent.endsWith('\n') && !freshContent.endsWith('\n')) {
        freshContent += '\n'
      }
      if (formatting.eol === '\r\n' && !freshContent.includes('\r\n')) {
        freshContent = freshContent.replace(/\n/g, '\r\n')
      }

      return {
        fileName: catalog.fileName,
        content: freshContent,
      }
    }

    return {
      fileName: catalog.fileName,
      content: catalog.currentContent,
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

    const options: { catalogId?: string; source?: CatalogSource } = { catalogId: record.id }
    if (record.source) {
      options.source = record.source
    }

    setCatalogFromFile(record.fileName, record.content, record.originalContent, options)
  }, [setCatalogFromFile])

  const value = useMemo<CatalogContextValue>(
    () => ({
      catalog,
      catalogLoading,
      storedCatalogs,
      setCatalogFromFile,
      loadCatalogById,
      removeCatalog,
      updateTranslation,
      addLanguage,
      resetCatalog,
      exportContent,
      attachProjectFile,
      updateProjectFilePath,
      exportProjectFile,
    }),
    [
      addLanguage,
      attachProjectFile,
      catalog,
      catalogLoading,
      exportContent,
      exportProjectFile,
      loadCatalogById,
      removeCatalog,
      resetCatalog,
      setCatalogFromFile,
      storedCatalogs,
      updateProjectFilePath,
      updateTranslation,
    ],
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
