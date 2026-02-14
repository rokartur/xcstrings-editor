import { EyeOff, Eye, Clock, ShieldCheck, Plus, List, CheckCheck } from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import type { FilterState } from '@/lib/editor-store'
import { cn } from '@/lib/utils'

export function FiltersPanel() {
  const { filter, setFilter } = useEditorStore()

  const options: { id: FilterState; label: string; icon: any; color: string }[] = [
    { id: 'all', label: 'All', icon: List, color: 'text-muted-foreground' },
    { id: 'stale', label: 'Stale', icon: Clock, color: 'text-orange-500' },
    { id: 'ignored', label: "Don't Translate", icon: EyeOff, color: 'text-rose-500' },
    { id: 'needs_review', label: 'Needs Review', icon: ShieldCheck, color: 'text-amber-500' },
    { id: 'new', label: 'New', icon: Plus, color: 'text-blue-500' },
    { id: 'translated', label: 'Translated', icon: CheckCheck, color: 'text-emerald-500' },
    { id: 'untranslated', label: '≠ Translated', icon: Eye, color: 'text-zinc-500' },
  ]

  return (
    <div className="flex flex-col gap-1 p-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setFilter(opt.id)}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
            filter === opt.id
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-bold text-muted-foreground/80">
              STATE
            </span>
            <opt.icon className={cn('size-3.5', opt.color)} strokeWidth={2} />
            <span>{opt.label}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
