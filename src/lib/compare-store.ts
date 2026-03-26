import { create } from 'zustand'

import type { ComparisonResult, CompareFilter } from './compare-types'
import type { ParsedCatalog } from './xcstrings'
import { parseXcStrings } from './xcstrings'
import { computeComparison } from './compare-xcstrings'

interface CompareState {
  /** The parsed second catalog (the one being compared against the active catalog) */
  secondCatalog: ParsedCatalog | null
  /** File name of the second file */
  secondFileName: string | null
  /** Computed comparison result */
  result: ComparisonResult | null
  /** Current filter for the comparison view */
  filter: CompareFilter
}

interface CompareActions {
  /**
   * Parse and set the second file for comparison, then compute diffs against
   * the primary catalog. Throws if parsing fails.
   */
  compare: (
    primaryCatalog: ParsedCatalog,
    primaryFileName: string,
    secondFileContent: string,
    secondFileName: string,
  ) => void
  /** Set the active filter */
  setFilter: (filter: CompareFilter) => void
  /** Clear all comparison state */
  clear: () => void
}

export const useCompareStore = create<CompareState & CompareActions>()((set) => ({
  secondCatalog: null,
  secondFileName: null,
  result: null,
  filter: 'all',

  compare: (primaryCatalog, primaryFileName, secondFileContent, secondFileName) => {
    const secondCatalog = parseXcStrings(secondFileContent)
    const result = computeComparison(primaryCatalog, secondCatalog, primaryFileName, secondFileName)
    set({ secondCatalog, secondFileName, result, filter: 'all' })
  },

  setFilter: (filter) => set({ filter }),

  clear: () =>
    set({ secondCatalog: null, secondFileName: null, result: null, filter: 'all' }),
}))
