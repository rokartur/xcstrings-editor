import type { ComparisonResult, ChangedKey, UniqueKey, LocaleChange } from './compare-types'
import type { ParsedCatalog, TranslationState } from './xcstrings'
import { collectLanguages, resolveLocaleValue } from './xcstrings'

/**
 * Compute a structural comparison between two xcstrings catalogs.
 *
 * catalogA is the "base" (left / current), catalogB is the "incoming" (right / uploaded).
 */
export function computeComparison(
  catalogA: ParsedCatalog,
  catalogB: ParsedCatalog,
  fileNameA: string,
  fileNameB: string,
): ComparisonResult {
  const langsA = new Set(collectLanguages(catalogA.document))
  const langsB = new Set(collectLanguages(catalogB.document))

  const allLanguages = Array.from(new Set([...langsA, ...langsB])).sort()
  const addedLanguages = allLanguages.filter((l) => !langsA.has(l))
  const removedLanguages = allLanguages.filter((l) => !langsB.has(l))

  const keysA = new Set(Object.keys(catalogA.document.strings ?? {}))
  const keysB = new Set(Object.keys(catalogB.document.strings ?? {}))

  const addedKeys: UniqueKey[] = []
  const removedKeys: UniqueKey[] = []
  const changedKeys: ChangedKey[] = []
  let unchangedCount = 0

  // Keys only in B (added)
  for (const key of keysB) {
    if (keysA.has(key)) continue
    const entry = catalogB.document.strings[key]
    if (!entry) continue
    const values: Record<string, string> = {}
    for (const lang of allLanguages) {
      values[lang] = resolveLocaleValue(entry, lang, catalogB.document.sourceLanguage, key)
    }
    addedKeys.push({
      key,
      comment: entry.comment ?? undefined,
      values,
    })
  }

  // Keys only in A (removed)
  for (const key of keysA) {
    if (keysB.has(key)) continue
    const entry = catalogA.document.strings[key]
    if (!entry) continue
    const values: Record<string, string> = {}
    for (const lang of allLanguages) {
      values[lang] = resolveLocaleValue(entry, lang, catalogA.document.sourceLanguage, key)
    }
    removedKeys.push({
      key,
      comment: entry.comment ?? undefined,
      values,
    })
  }

  // Keys in both — check for changes
  for (const key of keysA) {
    if (!keysB.has(key)) continue

    const entryA = catalogA.document.strings[key]
    const entryB = catalogB.document.strings[key]
    if (!entryA || !entryB) continue

    const localeChanges: LocaleChange[] = []
    let commentChange: { old: string; new: string } | undefined

    // Comment diff
    const commentA = entryA.comment ?? ''
    const commentB = entryB.comment ?? ''
    if (commentA !== commentB) {
      commentChange = { old: commentA, new: commentB }
    }

    // Per-locale value + state diff
    for (const lang of allLanguages) {
      const oldValue = resolveLocaleValue(entryA, lang, catalogA.document.sourceLanguage, key)
      const newValue = resolveLocaleValue(entryB, lang, catalogB.document.sourceLanguage, key)

      const oldState = resolveState(entryA, lang)
      const newState = resolveState(entryB, lang)

      if (oldValue !== newValue || oldState !== newState) {
        localeChanges.push({ locale: lang, oldValue, newValue, oldState, newState })
      }
    }

    if (localeChanges.length > 0 || commentChange) {
      changedKeys.push({
        key,
        comment: (entryB.comment ?? entryA.comment) ?? undefined,
        commentChange,
        localeChanges,
      })
    } else {
      unchangedCount++
    }
  }

  // Sort all lists by key
  addedKeys.sort((a, b) => a.key.localeCompare(b.key))
  removedKeys.sort((a, b) => a.key.localeCompare(b.key))
  changedKeys.sort((a, b) => a.key.localeCompare(b.key))

  return {
    addedKeys,
    removedKeys,
    changedKeys,
    unchangedCount,
    addedLanguages,
    removedLanguages,
    allLanguages,
    fileA: fileNameA,
    fileB: fileNameB,
  }
}

/** Resolve the translation state for a locale within an entry */
function resolveState(
  entry: { localizations?: Record<string, { stringUnit?: { state?: string } }> },
  locale: string,
): TranslationState {
  const raw = entry.localizations?.[locale]?.stringUnit?.state
  if (raw === 'translated' || raw === 'needs_review' || raw === 'new' || raw === 'stale') {
    return raw
  }
  return undefined
}
