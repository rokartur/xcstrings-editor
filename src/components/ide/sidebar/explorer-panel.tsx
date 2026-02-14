import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, FileText, Folder, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'
import { findLocaleOption, formatLocaleCode } from '@/lib/locale-options'
import { cn } from '@/lib/utils'

export function ExplorerPanel() {
  const { catalog, storedCatalogs, loadCatalogById, removeLanguage } = useCatalog()
  const { openTabs, activeTab, openLocaleTab, closeLocaleTab, setActiveTab } = useEditorStore()

  type CatalogTreeNode =
    | {
        kind: 'folder'
        name: string
        path: string
        children: CatalogTreeNode[]
      }
    | {
        kind: 'file'
        name: string
        path: string
        catalogId: string
        fileName: string
        formattedLastOpened: string
      }

  const formattedCatalogs = useMemo(
    () =>
      storedCatalogs
        .slice()
        .sort((a, b) => b.lastOpened - a.lastOpened)
        .map((c) => ({
          ...c,
          formattedLastOpened: new Date(c.lastOpened).toLocaleString(),
        })),
    [storedCatalogs],
  )

  const catalogTree = useMemo<CatalogTreeNode[]>(() => {
    // Build a simple folder tree from fileName paths.
    // Example: translations-ios/Localizable.xcstrings => folder translations-ios -> file Localizable.xcstrings
    type FolderBuilder = {
      name: string
      path: string
      folders: Map<string, FolderBuilder>
      files: Array<{
        name: string
        path: string
        catalogId: string
        fileName: string
        formattedLastOpened: string
      }>
    }

    const root: FolderBuilder = {
      name: '',
      path: '',
      folders: new Map(),
      files: [],
    }

    const ensureFolder = (parent: FolderBuilder, segment: string) => {
      const nextPath = parent.path ? `${parent.path}/${segment}` : segment
      const existing = parent.folders.get(segment)
      if (existing) return existing
      const created: FolderBuilder = {
        name: segment,
        path: nextPath,
        folders: new Map(),
        files: [],
      }
      parent.folders.set(segment, created)
      return created
    }

    for (const item of formattedCatalogs) {
      const raw = item.fileName
      const segments = raw.split('/').filter(Boolean)
      if (segments.length === 0) continue

      let current = root
      for (let i = 0; i < segments.length - 1; i += 1) {
        current = ensureFolder(current, segments[i]!)
      }

      const leafName = segments[segments.length - 1]!
      const leafPath = current.path ? `${current.path}/${leafName}` : leafName
      current.files.push({
        name: leafName,
        path: leafPath,
        catalogId: item.id,
        fileName: item.fileName,
        formattedLastOpened: item.formattedLastOpened,
      })
    }

    const buildNodes = (folder: FolderBuilder): CatalogTreeNode[] => {
      const folders = Array.from(folder.folders.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
        .map<CatalogTreeNode>((child) => ({
          kind: 'folder',
          name: child.name,
          path: child.path,
          children: buildNodes(child),
        }))

      const files = folder.files
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
        .map<CatalogTreeNode>((file) => ({
          kind: 'file',
          name: file.name,
          path: file.path,
          catalogId: file.catalogId,
          fileName: file.fileName,
          formattedLastOpened: file.formattedLastOpened,
        }))

      return [...folders, ...files]
    }

    return buildNodes(root)
  }, [formattedCatalogs])

  const allFolderPaths = useMemo(() => {
    const result: string[] = []
    const visit = (node: CatalogTreeNode) => {
      if (node.kind !== 'folder') return
      result.push(node.path)
      for (const child of node.children) visit(child)
    }
    for (const node of catalogTree) visit(node)
    return result
  }, [catalogTree])

  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set())

  // Open all folders by default (only once), so the tree is visible immediately.
  useEffect(() => {
    setOpenFolders((prev) => {
      if (prev.size > 0) return prev
      return new Set(allFolderPaths)
    })
  }, [allFolderPaths])

  const hasAnyCatalogs = formattedCatalogs.length > 0

  const languageStats = useMemo(() => {
    if (!catalog) return new Map<string, { translated: number; total: number }>()

    const result = new Map<string, { translated: number; total: number }>()
    const sourceLanguage = catalog.document.sourceLanguage
      ? formatLocaleCode(catalog.document.sourceLanguage).toLowerCase()
      : null
    for (const lang of catalog.languages) {
      if (sourceLanguage && formatLocaleCode(lang).toLowerCase() === sourceLanguage) {
        continue
      }
      let translated = 0
      let total = 0
      for (const entry of catalog.entries) {
        if (!entry.shouldTranslate) continue

        total += 1
        const val = entry.values[lang] ?? ''
        if (val.trim().length > 0) translated += 1
      }
      result.set(lang, { translated, total })
    }
    return result
  }, [catalog])

  return (
    <div className="py-1">
      <div className="px-2 pb-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Catalogs
          </span>
          {hasAnyCatalogs && (
            <span className="w-max shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formattedCatalogs.length}
            </span>
          )}
        </div>

        {!hasAnyCatalogs && (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/10 p-2 text-xs text-muted-foreground">
            No imported files yet. Use <span className="font-medium">Import</span> to add a catalog.
          </div>
        )}

        {hasAnyCatalogs && (
          <div className="overflow-hidden rounded-md border border-border/60">
            {catalogTree.map((node) => {
              const renderNode = (n: CatalogTreeNode, depth: number) => {
                const paddingLeft = 8 + depth * 14

                if (n.kind === 'folder') {
                  const isOpen = openFolders.has(n.path)
                  return (
                    <div key={n.path}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 py-1.5 pr-2 text-left text-xs transition-colors',
                          'hover:bg-accent',
                        )}
                        style={{ paddingLeft }}
                        onClick={() =>
                          setOpenFolders((prev) => {
                            const next = new Set(prev)
                            if (next.has(n.path)) next.delete(n.path)
                            else next.add(n.path)
                            return next
                          })
                        }
                        title={n.name}
                      >
                        <ChevronRight
                          className={cn(
                            'size-3.5 shrink-0 text-muted-foreground transition-transform',
                            isOpen && 'rotate-90',
                          )}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        <Folder
                          className="size-3.5 shrink-0 text-muted-foreground"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{n.name}</span>
                      </button>
                      {isOpen && n.children.map((child) => renderNode(child, depth + 1))}
                    </div>
                  )
                }

                const isActive = catalog?.id === n.catalogId
                return (
                  <button
                    key={n.path}
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-2 py-1.5 pr-2 text-left text-xs transition-colors',
                      'hover:bg-accent',
                      isActive && 'bg-accent',
                    )}
                    style={{ paddingLeft }}
                    onClick={() => loadCatalogById(n.catalogId)}
                    title={n.fileName}
                  >
                    <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="min-w-0 flex-1 truncate font-medium">{n.name}</span>
                        {isActive && (
                          <Badge variant="secondary" className="h-4 shrink-0 whitespace-nowrap px-1 text-[10px]">
                            active
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        Last opened: {n.formattedLastOpened}
                      </div>
                    </div>
                  </button>
                )
              }

              return renderNode(node, 0)
            })}
          </div>
        )}
      </div>

      <div className="px-2 pb-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Languages
          </span>
          {catalog && (
            <span className="w-max shrink-0 text-[11px] tabular-nums text-muted-foreground">{catalog.languages.length}</span>
          )}
        </div>

        {!catalog && (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/10 p-2 text-xs text-muted-foreground">
            Select a catalog to see its languages.
          </div>
        )}

        {catalog && catalog.languages.length === 0 && (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/10 p-2 text-xs text-muted-foreground">
            No languages in this catalog.
          </div>
        )}

        {catalog && catalog.languages.length > 0 && (
          <div className="overflow-hidden rounded-md border border-border/60">
            {catalog.languages.map((lang) => {
              const formattedLocale = formatLocaleCode(lang)
              const languageName =
                formattedLocale.toLowerCase() === 'base'
                  ? 'Base'
                  : findLocaleOption(formattedLocale)?.language

              const displayLabel =
                languageName && languageName.toLowerCase() !== formattedLocale.toLowerCase()
                  ? `${languageName} (${formattedLocale})`
                  : formattedLocale

              const stat = languageStats.get(lang)
              const pct = stat && stat.total > 0 ? Math.floor((stat.translated / stat.total) * 100) : 0
              const isOpen = openTabs.includes(lang)
              const isActive = activeTab === lang

              const isSourceLanguage = Boolean(
                catalog.document.sourceLanguage &&
                  formatLocaleCode(catalog.document.sourceLanguage).toLowerCase() === formattedLocale.toLowerCase(),
              )

              const canRemove = !isSourceLanguage && formattedLocale.toLowerCase() !== 'base'

              return (
                <div
                  key={lang}
                  className={cn(
                    'group flex w-full items-stretch text-left text-xs transition-colors',
                    'hover:bg-accent',
                    isActive && 'bg-accent',
                  )}
                >
                  <button
                    type="button"
                    className="flex flex-1 items-center px-2 py-1.5 text-left"
                    onClick={() => {
                      openLocaleTab(lang)
                      setActiveTab(lang)
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate font-medium">{displayLabel}</span>
                        <div className="ml-auto flex shrink-0 items-center gap-1">
                          {isSourceLanguage && (
                            <Badge variant="secondary" className="h-4 shrink-0 whitespace-nowrap px-1 text-[10px]">
                              source
                            </Badge>
                          )}
                          {isOpen && (
                            <Badge variant="secondary" className="h-4 shrink-0 whitespace-nowrap px-1 text-[10px]">
                              open
                            </Badge>
                          )}
                          {!isSourceLanguage && (
                            <span className="w-max shrink-0 text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={cn(
                      'flex w-7 shrink-0 items-center justify-center text-muted-foreground transition-opacity',
                      'opacity-0 group-hover:opacity-100',
                      canRemove ? 'hover:text-foreground' : 'cursor-not-allowed opacity-0',
                    )}
                    disabled={!canRemove}
                    title={
                      canRemove
                        ? 'Remove language'
                        : isSourceLanguage
                          ? 'Source language cannot be removed'
                          : 'Base cannot be removed'
                    }
                    onClick={() => {
                      if (!canRemove) return
                      const ok = window.confirm(`Remove ${displayLabel} from this catalog?`)
                      if (!ok) return
                      removeLanguage(lang)
                      closeLocaleTab(lang)
                      if (activeTab === lang) {
                        setActiveTab(null)
                      }
                    }}
                  >
                    <X className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
