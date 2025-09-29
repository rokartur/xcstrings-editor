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
  localizations?: Record<string, LocalizationRecord>
}

export interface XcStringsDocument {
  sourceLanguage?: string
  availableLocales?: string[]
  strings: Record<string, XcStringEntry>
  version?: string
  identifier?: string
}

export interface CatalogEntry {
  key: string
  comment?: string
  values: Record<string, string>
}

export interface ParsedCatalog {
  document: XcStringsDocument
  languages: string[]
  entries: CatalogEntry[]
}

const EMPTY_STRING = ''

function toCatalogEntry(
  key: string,
  entry: XcStringEntry,
  languages: string[],
  sourceLanguage?: string,
): CatalogEntry {
  const values: Record<string, string> = {}

  for (const language of languages) {
    values[language] = resolveLocaleValue(entry, language, sourceLanguage, key)
  }

  return {
    key,
    comment: entry.comment,
    values,
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
