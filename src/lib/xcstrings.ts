export interface StringUnit {
  state?: string
  value?: string
}

export interface LocalizationVariant {
  stringUnit?: StringUnit
}

export interface LocalizationRecord {
  comment?: string
  stringUnit?: StringUnit
  variations?: Record<string, LocalizationVariant>
}

export interface XcStringEntry {
  comment?: string
  extractionState?: string
  shouldTranslate?: boolean
  stringUnit?: StringUnit
  localizations?: Record<string, LocalizationRecord>
}

export interface XcStringsDocument {
  sourceLanguage?: string
  availableLocales?: string[]
  strings: Record<string, XcStringEntry>
  version?: string
  identifier?: string
}

/** Per-locale translation state as stored in stringUnit.state */
export type TranslationState = 'translated' | 'needs_review' | 'new' | 'stale' | undefined

/**
 * Extraction state for the entire key (set by Xcode during build/extraction).
 * - manual: user-added
 * - extracted_with_value: extracted from source code with a default value
 * - migrated: migrated from legacy .strings
 * - stale: key no longer exists in source code
 */
export type ExtractionState = 'manual' | 'extracted_with_value' | 'migrated' | 'stale' | undefined

export interface CatalogEntry {
  key: string
  comment?: string | undefined
  values: Record<string, string>
  /** Per-locale stringUnit state */
  states: Record<string, TranslationState>
  /** Extraction state for the entire key */
  extractionState: ExtractionState
  /** Whether this key should be translated (false = skip, e.g. brand names) */
  shouldTranslate: boolean
}

export interface ParsedCatalog {
  document: XcStringsDocument
  languages: string[]
  entries: CatalogEntry[]
}

const EMPTY_STRING = ''

function resolveLocaleState(entry: XcStringEntry, locale: string): TranslationState {
  const record = entry.localizations?.[locale]
  if (!record) return undefined

  // Check direct stringUnit state (simple strings)
  const state = record.stringUnit?.state
  if (state === 'translated' || state === 'needs_review' || state === 'new' || state === 'stale') {
    return state
  }

  // Check variations (plural / device) – the xcstrings JSON may nest
  // as variations.plural.one.stringUnit or variations.one.stringUnit.
  // We walk up to two levels deep to cover both layouts.
  if (record.variations) {
    let hasAny = false
    let allDone = true
    for (const group of Object.values(record.variations)) {
      if (group && typeof group === 'object') {
        // Flat variant: { stringUnit: { state, value } }
        const su = (group as LocalizationVariant).stringUnit
        if (su?.state) {
          hasAny = true
          if (su.state !== 'translated' && su.state !== 'needs_review') allDone = false
        } else {
          // Nested variant group: { one: { stringUnit }, other: { stringUnit } }
          for (const inner of Object.values(group as Record<string, LocalizationVariant>)) {
            if (inner?.stringUnit?.state) {
              hasAny = true
              if (inner.stringUnit.state !== 'translated' && inner.stringUnit.state !== 'needs_review') allDone = false
            } else if (inner?.stringUnit?.value !== undefined) {
              hasAny = true
              allDone = false
            }
          }
        }
      }
    }
    if (hasAny) return allDone ? 'translated' : 'new'
  }

  return undefined
}

function toCatalogEntry(
  key: string,
  entry: XcStringEntry,
  languages: string[],
  sourceLanguage?: string,
): CatalogEntry {
  const values: Record<string, string> = {}
  const states: Record<string, TranslationState> = {}

  for (const language of languages) {
    values[language] = resolveLocaleValue(entry, language, sourceLanguage, key)
    states[language] = resolveLocaleState(entry, language)
  }

  const rawExtraction = entry.extractionState as string | undefined
  let extractionState: ExtractionState
  if (rawExtraction === 'manual' || rawExtraction === 'extracted_with_value' || rawExtraction === 'migrated' || rawExtraction === 'stale') {
    extractionState = rawExtraction
  }

  return {
    key,
    comment: entry.comment,
    values,
    states,
    extractionState,
    shouldTranslate: entry.shouldTranslate !== false, // default true
  }
}

function getValueForLocale(entry: XcStringEntry, locale: string): string | undefined {
  if (!entry.localizations) {
    return undefined
  }

  const localization = entry.localizations[locale]

  if (!localization) {
    return undefined
  }

  if (localization.stringUnit?.value !== undefined) {
    return localization.stringUnit.value
  }

  if (localization.variations) {
    for (const variation of Object.values(localization.variations)) {
      if (variation?.stringUnit?.value !== undefined) {
        return variation.stringUnit.value
      }
    }
  }

  return undefined
}

export function resolveLocaleValue(
  entry: XcStringEntry,
  locale: string,
  sourceLanguage?: string,
  fallbackKey?: string,
) {
  const localized = getValueForLocale(entry, locale)

  if (localized !== undefined) {
    return localized
  }

  if (sourceLanguage && locale === sourceLanguage) {
    if (entry.stringUnit?.value !== undefined) {
      return entry.stringUnit.value
    }

    if (fallbackKey !== undefined) {
      return fallbackKey
    }
  }

  return EMPTY_STRING
}

export function setValueForLocale(entry: XcStringEntry, locale: string, value: string) {
  if (!entry.localizations) {
    entry.localizations = {}
  }

  if (!entry.localizations[locale]) {
    entry.localizations[locale] = {}
  }

  if (!entry.localizations[locale].stringUnit) {
    entry.localizations[locale].stringUnit = {}
  }

  entry.localizations[locale].stringUnit!.value = value
}

export function parseXcStrings(text: string): ParsedCatalog {
  let document: XcStringsDocument

  try {
    document = JSON.parse(text) as XcStringsDocument
  } catch (error) {
    throw new Error('Unable to parse .xcstrings file: invalid JSON.')
  }

  if (!document || typeof document !== 'object' || !document.strings) {
    throw new Error('Invalid .xcstrings file: missing "strings" section.')
  }

  const languages = collectLanguages(document)
  const entries: CatalogEntry[] = Object.entries(document.strings)
    .map(([key, entry]) => toCatalogEntry(key, entry, languages, document.sourceLanguage))
    .sort((a, b) => a.key.localeCompare(b.key))

  return { document, languages, entries }
}

export function collectLanguages(document: XcStringsDocument): string[] {
  const languages = new Set<string>()

  if (Array.isArray(document.availableLocales)) {
    for (const locale of document.availableLocales) {
      if (typeof locale === 'string' && locale.trim()) {
        languages.add(locale)
      }
    }
  }

  if (document.sourceLanguage) {
    languages.add(document.sourceLanguage)
  }

  for (const entry of Object.values(document.strings)) {
    if (!entry || typeof entry !== 'object' || !entry.localizations) {
      continue
    }

    for (const locale of Object.keys(entry.localizations)) {
      if (locale.trim()) {
        languages.add(locale)
      }
    }
  }

  return Array.from(languages).sort()
}

export function serializeDocument(document: XcStringsDocument): string {
  return JSON.stringify(document, null, 2)
}
