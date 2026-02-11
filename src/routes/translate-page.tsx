import { Navigate, useNavigate } from 'react-router-dom'
import { Globe } from 'lucide-react'

import { LanguagePicker } from '../components/language-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useCatalog } from '../lib/catalog-context'
import { cn } from '@/lib/utils'

function TranslatePage() {
  const { catalog } = useCatalog()
  const navigate = useNavigate()

  if (!catalog) {
    return <Navigate to="/" replace />
  }

  if (catalog.languages.length === 0) {
    return <Navigate to="/configure" replace />
  }

  const handleLanguageSelect = (locale: string) => {
    if (!locale) return
    navigate(`/locale/${locale}`)
  }

  return (
    <div className="grid gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <Card>
        <CardHeader>
          <CardTitle>Choose a language to edit</CardTitle>
          <CardDescription>
            Search or click a locale below to open the translation editor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LanguagePicker
            languages={catalog.languages}
            onSelect={handleLanguageSelect}
            placeholder="Search locales…"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {catalog.languages.map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => handleLanguageSelect(language)}
                className={cn(
                  'group relative flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-4 text-sm transition-all',
                  'hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm',
                  'active:scale-[0.98]',
                )}
              >
                <Globe className="size-5 text-muted-foreground transition-colors group-hover:text-primary" strokeWidth={1.5} />
                <span className="font-medium">{language}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TranslatePage
