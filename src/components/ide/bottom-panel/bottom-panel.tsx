import { Badge } from '@/components/ui/badge'
import { useCatalog } from '@/lib/catalog-context'
import { useEditorStore } from '@/lib/editor-store'

import { ChangesPanel } from './changes-panel'

export function BottomPanel() {
  const { openDiffTab } = useEditorStore()
  const { catalog } = useCatalog()

  const changesCount = catalog ? catalog.dirtyKeys.size : 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center border-b border-border px-2">
        <button
          type="button"
          className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-foreground"
          onClick={() => openDiffTab()}
        >
          Diff
          {changesCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
              {changesCount}
            </Badge>
          )}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChangesPanel />
      </div>
    </div>
  )
}
