import { ScrollArea } from '@/components/ui/scroll-area'
import { useEditorStore } from '@/lib/editor-store'

import { ProblemsPanel } from '../bottom-panel/problems-panel'
import { ExplorerPanel } from './explorer-panel'
import { SearchPanel } from './search-panel'

export function SidebarContainer() {
  const sidebarPanel = useEditorStore((s) => s.sidebarPanel)
  const activeSidebarPanel = sidebarPanel === 'filters' ? 'explorer' : sidebarPanel

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {activeSidebarPanel === 'explorer' && 'Explorer'}
          {activeSidebarPanel === 'search' && 'Search'}
          {activeSidebarPanel === 'problems' && 'Problems'}
        </span>
      </div>
      {activeSidebarPanel === 'problems' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ProblemsPanel />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {activeSidebarPanel === 'explorer' && <ExplorerPanel />}
          {activeSidebarPanel === 'search' && <SearchPanel />}
        </ScrollArea>
      )}
    </div>
  )
}
