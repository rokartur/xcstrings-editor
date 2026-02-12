import { ChangesPanel } from '@/components/ide/bottom-panel/changes-panel'

export function DiffView() {
  return (
    <div className="h-full min-h-0">
      <ChangesPanel />
    </div>
  )
}
