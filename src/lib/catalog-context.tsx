import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { CatalogEntry, ParsedCatalog, XcStringsDocument } from './xcstrings'
import { parseXcStrings, resolveLocaleValue, serializeDocument, setValueForLocale } from './xcstrings'
import { applyJsonChanges, detectFormattingOptions } from './json-edit'
import { formatLocaleCode } from './locale-options'
import { addKnownRegion } from './pbxproj'

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
      const dirtyKeys = calculateDirtyKeys(parsed.document, originalDocument)
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
      })

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
        if (!nextEntry) {
          return current
        }

        setValueForLocale(nextEntry, locale, value)

        const nextDirty = new Set(current.dirtyKeys)
        if (isEntryDirty(key, nextDocument, current.originalDocument)) {
          nextDirty.add(key)
        } else {
          nextDirty.delete(key)
        }

        const formatting = detectFormattingOptions(current.currentContent)
        const nextContent = applyJsonChanges(
          current.currentContent,
          [
            {
              path: ['strings', key],
              value: nextDocument.strings[key],
            },
          ],
          formatting,
        )

        updateStoredState((state) => {
          const index = state.catalogs.findIndex((entry) => entry.id === current.id)
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
            currentId: current.id,
            catalogs: nextCatalogs,
          }
        })

        return {
          ...current,
          document: nextDocument,
          entries: updateEntries(current.entries, key, locale, value),
          dirtyKeys: nextDirty,
          documentDirty: true,
          originalDocument: current.originalDocument,
          originalContent: current.originalContent,
          currentContent: nextContent,
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

        const nextDocument = structuredClone(current.document)
        const availableLocales = new Set(nextDocument.availableLocales ?? [])
        availableLocales.add(formatted)
        nextDocument.availableLocales = Array.from(availableLocales).sort((a, b) =>
          a.localeCompare(b, 'en', { sensitivity: 'base' }),
        )

        if (nextDocument.strings) {
          for (const entry of Object.values(nextDocument.strings)) {
            if (!entry) continue
            setValueForLocale(entry, formatted, '')
          }
        }

        const nextEntries = current.entries.map((entry) => ({
          ...entry,
          values: {
            ...entry.values,
            [formatted]: '',
          },
        }))

        const formatting = detectFormattingOptions(current.currentContent)
        const changes = [
          {
            path: ['availableLocales'],
            value: nextDocument.availableLocales,
          },
          ...Object.entries(nextDocument.strings ?? {}).map(([entryKey, entryValue]) => ({
            path: ['strings', entryKey],
            value: entryValue,
          })),
        ]

        const nextContent = applyJsonChanges(current.currentContent, changes, formatting)

        let nextProjectFileState = current.projectFile
        let projectFileWasUpdated = false

        if (current.projectFile) {
          const projectUpdate = addKnownRegion(current.projectFile.currentContent, formatted)
          if (projectUpdate.updated) {
            projectFileWasUpdated = true
            nextProjectFileState = {
              ...current.projectFile,
              currentContent: projectUpdate.content,
              dirty: true,
            }
          }
        }

        const nextDirtyKeys = new Set(current.dirtyKeys)

        updateStoredState((state) => {
          const index = state.catalogs.findIndex((entry) => entry.id === current.id)
          if (index === -1) {
            return state
          }

          const existing = state.catalogs[index]!
          const updatedRecord: StoredCatalogRecord = {
            ...existing,
            content: nextContent,
            documentDirty: true,
          }

          if (nextProjectFileState) {
            updatedRecord.projectFile = {
              path: nextProjectFileState.path,
              content: nextProjectFileState.currentContent,
              originalContent: nextProjectFileState.originalContent,
            }
          } else if (projectFileWasUpdated || existing.projectFile) {
            delete updatedRecord.projectFile
          }

          const nextCatalogs = [...state.catalogs]
          nextCatalogs[index] = updatedRecord

          return {
            ...state,
            catalogs: nextCatalogs,
          }
        })

        const nextState = {
          ...current,
          document: nextDocument,
          currentContent: nextContent,
          languages: nextLanguages,
          entries: nextEntries,
          dirtyKeys: nextDirtyKeys,
          documentDirty: true,
        } as CatalogState

        if (nextProjectFileState) {
          nextState.projectFile = nextProjectFileState
        }

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
