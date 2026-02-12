import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useEditorStore } from '@/lib/editor-store'

import { ActivityBar } from './activity-bar'
import { AddLanguageDialog } from './add-language-dialog'
import { BottomPanel } from './bottom-panel/bottom-panel'
import { EditorArea } from './editor/editor-area'
import { ExportDialog } from './export-dialog'
import { ImportDialog } from './import-dialog'
import { SidebarContainer } from './sidebar/sidebar-container'
import { StatusBar } from './status-bar'
import { Toolbar } from './toolbar'
import { Toaster } from '@/components/ui/sonner'

export function IdeLayout() {
  const { sidebarVisible, bottomPanelVisible } = useEditorStore()

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
                // Use absolute units so the resizable logic itself respects the cap.
                // 240px ~= 15rem (assuming 16px root font size)
                defaultSize="18rem"
                minSize="15rem"
                maxSize="20rem"
                // Still keep a CSS guard in case of unusual root font sizing.
                style={{ minWidth: 240, maxWidth: '20rem' }}
                className="bg-sidebar text-sidebar-foreground overflow-hidden"
              >
                <SidebarContainer />
              </ResizablePanel>
              <ResizableHandle withHandle className="h-full w-px cursor-col-resize" />
            </>
          )}
          <ResizablePanel id="main" defaultSize="74%" minSize="30%">
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel id="editor" defaultSize="70%" minSize="20%">
                <EditorArea />
              </ResizablePanel>
              {bottomPanelVisible && (
                <>
                  <ResizableHandle
                    withHandle
                    className="z-20 h-px w-full cursor-row-resize bg-border [&>div]:h-1.5 [&>div]:w-6"
                  />
                  <ResizablePanel
                    id="bottom"
                    defaultSize="30%"
                    minSize="10%"
                    maxSize="60%"
                    className="overflow-hidden"
                  >
                    <BottomPanel />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
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
