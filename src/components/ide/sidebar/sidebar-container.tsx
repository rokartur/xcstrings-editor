import { ScrollArea } from '@/components/ui/scroll-area'
import { useEditorStore } from '@/lib/editor-store'

import { ProblemsPanel } from '../bottom-panel/problems-panel'
import { ExplorerPanel } from './explorer-panel'
import { SearchPanel } from './search-panel'

export function SidebarContainer() {
  const sidebarPanel = useEditorStore((s) => s.sidebarPanel)

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {sidebarPanel === 'explorer' && 'Explorer'}
          {sidebarPanel === 'search' && 'Search'}
          {sidebarPanel === 'problems' && 'Problems'}
        </span>
      </div>
      {sidebarPanel === 'problems' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ProblemsPanel />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {sidebarPanel === 'explorer' && <ExplorerPanel />}
          {sidebarPanel === 'search' && <SearchPanel />}
        </ScrollArea>
      )}
    </div>
  )
}
