import { CircleAlert, FolderTree, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEditorStore } from '@/lib/editor-store'
import { cn } from '@/lib/utils'

export function ActivityBar() {
  const { sidebarPanel, sidebarVisible, setSidebarPanel } =
    useEditorStore()

  const items = [
    { id: 'explorer' as const, icon: FolderTree, label: 'Explorer' },
    { id: 'search' as const, icon: Search, label: 'Search' },
    { id: 'problems' as const, icon: CircleAlert, label: 'Problems' },
  ] as const

  return (
    <div className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-background py-1">
      {items.map((item) => {
        const isActive = sidebarVisible && sidebarPanel === item.id
        return (
          <Tooltip key={item.id}>
            <TooltipTrigger render={<Button
                variant="ghost"
                size="icon"
                className={cn(
                  'my-0.5 size-9',
                  isActive && 'bg-accent text-accent-foreground',
                )}
                onClick={() => setSidebarPanel(item.id)}
              />}>
              <item.icon className="size-5" strokeWidth={1.5} />
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
