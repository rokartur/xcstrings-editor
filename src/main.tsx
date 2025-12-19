import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'

import App from './App.tsx'
import { CatalogProvider } from './lib/catalog-context.tsx'
import { ThemeProvider } from './lib/theme-context.tsx'
import DiffPage from './routes/diff-page.tsx'
import HomePage from './routes/home-page.tsx'
import LocalePage from './routes/locale-page.tsx'
import './index.css'

if (typeof window !== 'undefined') {
  registerSW({ immediate: true })
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'locale/:locale',
        element: <LocalePage />,
      },
      {
        path: 'diff',
        element: <DiffPage />,
      },
    ],
  },
], { basename: import.meta.env.BASE_URL })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <CatalogProvider>
        <RouterProvider router={router} />
      </CatalogProvider>
    </ThemeProvider>
  </StrictMode>,
)
