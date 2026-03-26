import type { TranslationState } from './xcstrings'

/** Per-locale change between two catalogs */
export interface LocaleChange {
  locale: string
  oldValue: string
  newValue: string
  oldState?: TranslationState
  newState?: TranslationState
}

/** A key that exists in both catalogs but has differences */
export interface ChangedKey {
  key: string
  comment?: string | undefined
  commentChange?: { old: string; new: string } | undefined
  localeChanges: LocaleChange[]
}

/** Entry representing a key only in one catalog (added or removed) */
export interface UniqueKey {
  key: string
  comment?: string | undefined
  values: Record<string, string>
}

/** Full comparison result between two xcstrings catalogs */
export interface ComparisonResult {
  /** Keys in file B but not in file A */
  addedKeys: UniqueKey[]
  /** Keys in file A but not in file B */
  removedKeys: UniqueKey[]
  /** Keys in both files that have differences */
  changedKeys: ChangedKey[]
  /** Number of keys identical in both files */
  unchangedCount: number
  /** Languages present only in file B */
  addedLanguages: string[]
  /** Languages present only in file A */
  removedLanguages: string[]
  /** All languages across both files (union) */
  allLanguages: string[]
  /** File names for display */
  fileA: string
  fileB: string
}

export type CompareFilter = 'all' | 'added' | 'removed' | 'changed'
