import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SidebarPanel = 'explorer' | 'search' | 'problems'

export const DIFF_TAB_ID = '__diff__'

interface EditorState {
  sidebarVisible: boolean
  sidebarPanel: SidebarPanel
  openTabs: string[]
  activeTab: string | null
  jumpToEntry: { locale: string; key: string } | null
  importDialogOpen: boolean
  exportDialogOpen: boolean
  addLanguageDialogOpen: boolean
}

interface EditorActions {
  toggleSidebar: () => void
  setSidebarPanel: (panel: SidebarPanel) => void
  openLocaleTab: (locale: string) => void
  openDiffTab: () => void
  closeLocaleTab: (locale: string) => void
  setActiveTab: (locale: string | null) => void
  setImportDialogOpen: (open: boolean) => void
  setExportDialogOpen: (open: boolean) => void
  setAddLanguageDialogOpen: (open: boolean) => void
  closeAllTabs: () => void
  requestJumpToEntry: (locale: string, key: string) => void
  clearJumpToEntry: () => void
}

export const useEditorStore = create<EditorState & EditorActions>()(
  persist(
    (set) => ({
      sidebarVisible: true,
      sidebarPanel: 'explorer',
      openTabs: [],
      activeTab: null,
      jumpToEntry: null,
      importDialogOpen: false,
      exportDialogOpen: false,
      addLanguageDialogOpen: false,

      toggleSidebar: () =>
        set((state) => ({ sidebarVisible: !state.sidebarVisible })),

      setSidebarPanel: (panel) =>
        set((state) => {
          if (state.sidebarPanel === panel && state.sidebarVisible) {
            return { sidebarVisible: false }
          }
          return { sidebarPanel: panel, sidebarVisible: true }
        }),

      openLocaleTab: (locale) =>
        set((state) => {
          if (state.openTabs.includes(locale)) {
            return { activeTab: locale }
          }
          return {
            openTabs: [...state.openTabs, locale],
            activeTab: locale,
          }
        }),

      openDiffTab: () =>
        set((state) => {
          if (state.openTabs.includes(DIFF_TAB_ID)) {
            return { activeTab: DIFF_TAB_ID }
          }
          return {
            openTabs: [...state.openTabs, DIFF_TAB_ID],
            activeTab: DIFF_TAB_ID,
          }
        }),

      closeLocaleTab: (locale) =>
        set((state) => {
          const nextTabs = state.openTabs.filter((t) => t !== locale)
          let nextActive = state.activeTab
          if (state.activeTab === locale) {
            const closedIndex = state.openTabs.indexOf(locale)
            nextActive = nextTabs[Math.min(closedIndex, nextTabs.length - 1)] ?? null
          }
          return { openTabs: nextTabs, activeTab: nextActive }
        }),

      setActiveTab: (locale) => set({ activeTab: locale }),

      setImportDialogOpen: (open) => set({ importDialogOpen: open }),
      setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
      setAddLanguageDialogOpen: (open) => set({ addLanguageDialogOpen: open }),

      closeAllTabs: () => set({ openTabs: [], activeTab: null }),

      requestJumpToEntry: (locale, key) => set({ jumpToEntry: { locale, key } }),
      clearJumpToEntry: () => set({ jumpToEntry: null }),
    }),
    {
      name: 'xcstrings-editor-ide',
      partialize: (state) => ({
        sidebarVisible: state.sidebarVisible,
        sidebarPanel: state.sidebarPanel,
        openTabs: state.openTabs,
        activeTab: state.activeTab,
      }),
    },
  ),
)
