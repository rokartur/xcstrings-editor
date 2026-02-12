import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'

import { IdeLayout } from './components/ide/ide-layout'
import { TooltipProvider } from './components/ui/tooltip'
import { CatalogProvider } from './lib/catalog-context.tsx'
import { ThemeProvider } from './lib/theme-context.tsx'
import './index.css'

if (typeof window !== 'undefined') {
  registerSW({ immediate: true })
}

const router = createBrowserRouter([
  { path: '/', element: <IdeLayout /> },
  { path: '*', element: <Navigate to="/" replace /> },
], { basename: import.meta.env.BASE_URL })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <CatalogProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </CatalogProvider>
    </ThemeProvider>
  </StrictMode>,
)
