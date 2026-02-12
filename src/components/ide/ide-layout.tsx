import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useEditorStore } from '@/lib/editor-store'

import { ActivityBar } from './activity-bar'
import { AddLanguageDialog } from './add-language-dialog'
import { EditorArea } from './editor/editor-area'
import { ExportDialog } from './export-dialog'
import { ImportDialog } from './import-dialog'
import { SidebarContainer } from './sidebar/sidebar-container'
import { StatusBar } from './status-bar'
import { Toolbar } from './toolbar'
import { Toaster } from '@/components/ui/sonner'

export function IdeLayout() {
  const { sidebarVisible } = useEditorStore()

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          {sidebarVisible && (
            <>
              <ResizablePanel
                id="sidebar"
                defaultSize="18rem"
                minSize="15rem"
                maxSize="20rem"
                style={{ minWidth: 240, maxWidth: '20rem' }}
                className="bg-sidebar text-sidebar-foreground overflow-hidden"
              >
                <SidebarContainer />
              </ResizablePanel>
              <ResizableHandle withHandle className="h-full w-px cursor-col-resize" />
            </>
          )}
          <ResizablePanel id="main" defaultSize="74%" minSize="30%">
            <EditorArea />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <StatusBar />
      <ImportDialog />
      <ExportDialog />
      <AddLanguageDialog />
      <Toaster />
    </div>
  )
}
