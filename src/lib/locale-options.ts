import * as localeCodes from 'locale-codes'

export interface LocaleOption {
  /**
   * Canonical BCP-47 style locale code, e.g. "en", "en-GB", "pt-BR".
   */
  code: string
  /**
   * Human readable English label describing the locale.
   */
  label: string
  /**
   * Primary language name in English, when available.
   */
  language: string
  /**
   * Optional region or location name associated with the locale.
   */
  location?: string
}

interface InternalLocaleOption extends LocaleOption {
  normalizedCode: string
}

const DISPLAY_NAMES = (() => {
  if (typeof Intl === 'undefined') {
    return null
  }

  if (typeof (Intl as { DisplayNames?: unknown }).DisplayNames !== 'function') {
    return null
  }

  try {
    return new Intl.DisplayNames(['en'], { type: 'language' })
  } catch (error) {
    console.warn('Failed to initialize Intl.DisplayNames for language labels', error)
    return null
  }
})()

function normalizeLocaleTag(tag: string): string {
  if (!tag) {
    return tag
  }

  return tag
    .replace(/_/g, '-')
    .split('-')
    .map((segment, index) => {
      if (index === 0) {
        return segment.toLowerCase()
      }

      if (segment.length === 2) {
        return segment.toUpperCase()
      }

      if (segment.length === 4) {
        return `${segment[0]?.toUpperCase() ?? ''}${segment.slice(1).toLowerCase()}`
      }

      return segment
    })
    .join('-')
}

function formatLanguageName(code: string, fallback?: string) {
  if (DISPLAY_NAMES) {
    try {
      const label = DISPLAY_NAMES.of(code)
      if (label && typeof label === 'string' && label.trim().length > 0) {
        return label
      }
    } catch {
      // ignore failures and rely on fallback / dataset name
    }
  }

  if (fallback && fallback.trim().length > 0) {
    return fallback
  }

  return code
}

let cachedAllLocales: InternalLocaleOption[] | null = null

function buildLocaleOptions(): InternalLocaleOption[] {
  if (!localeCodes || typeof localeCodes !== 'object') {
    return []
  }

  const entries = Array.isArray((localeCodes as { all?: unknown }).all)
    ? ((localeCodes as { all: unknown[] }).all as Array<Record<string, unknown>>)
    : []

  const seen = new Map<string, InternalLocaleOption>()

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const tag = typeof entry.tag === 'string' ? entry.tag.trim() : ''
    if (!tag) {
      continue
    }

    const normalizedCode = normalizeLocaleTag(tag)
    if (!normalizedCode) {
      continue
    }

    if (seen.has(normalizedCode)) {
      continue
    }

    const languageName = formatLanguageName(normalizedCode, typeof entry.name === 'string' ? entry.name : undefined)
    const location = typeof entry.location === 'string' ? entry.location : undefined

    const labelParts: string[] = []

    if (languageName && languageName.trim().length > 0) {
      labelParts.push(languageName.trim())
    }

    if (location && location.trim().length > 0 && (!languageName || languageName.trim().toLowerCase() !== location.trim().toLowerCase())) {
      labelParts.push(`(${location.trim()})`)
    }

    const label = labelParts.length > 0 ? `${labelParts.join(' ')} — ${normalizedCode}` : normalizedCode

    const internalOption: InternalLocaleOption = {
      code: normalizedCode,
      normalizedCode,
      label,
      language: languageName,
    }

    if (location && location.trim().length > 0) {
      internalOption.location = location.trim()
    }

    seen.set(normalizedCode, internalOption)
  }

  const baseOption: InternalLocaleOption = {
    code: 'Base',
    normalizedCode: 'base',
    label: 'Base (Base Internationalization)',
    language: 'Base Internationalization',
  }

  const result = Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
  result.unshift(baseOption)

  return result
}

function ensureLocaleOptions() {
  if (!cachedAllLocales) {
    cachedAllLocales = buildLocaleOptions()
  }
  return cachedAllLocales
}

function normalizeForLookup(value: string) {
  return normalizeLocaleTag(value).toLowerCase()
}

export function getLocaleOptions(excludedCodes: Iterable<string> = []): LocaleOption[] {
  const excluded = new Set<string>()
  for (const code of excludedCodes) {
    excluded.add(normalizeForLookup(code))
  }

  const allOptions = ensureLocaleOptions()

  return allOptions
    .filter((option) => !excluded.has(normalizeForLookup(option.normalizedCode)))
    .map(({ normalizedCode: _normalized, ...publicOption }) => publicOption)
}

export function findLocaleOption(code: string): LocaleOption | undefined {
  const normalized = normalizeForLookup(code)
  const allOptions = ensureLocaleOptions()
  const match = allOptions.find((option) => normalizeForLookup(option.normalizedCode) === normalized)
  if (!match) {
    return undefined
  }
  const { normalizedCode: _normalized, ...publicOption } = match
  return publicOption
}

export function hasLocaleOption(code: string): boolean {
  return Boolean(findLocaleOption(code))
}

export function formatLocaleCode(code: string): string {
  return normalizeLocaleTag(code)
}
