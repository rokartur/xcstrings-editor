import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { FileUploader } from '../components/file-uploader.tsx'
import { LanguagePicker } from '../components/language-picker.tsx'
import { Button } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { useCatalog } from '../lib/catalog-context.tsx'

function HomePage() {
  const { catalog, setCatalogFromFile } = useCatalog()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleFileLoaded = async (fileName: string, content: string) => {
    setError(null)
    setIsLoading(true)
    try {
      await Promise.resolve(setCatalogFromFile(fileName, content))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error while loading the file.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLanguageSelect = (locale: string) => {
    if (!locale) return
    navigate(`/locale/${locale}`)
  }

  return (
    <div className="grid gap-6">
      <FileUploader onFileLoaded={handleFileLoaded} disabled={isLoading} />
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {catalog && (
        <Card>
          <CardHeader>
            <CardTitle>Your translations</CardTitle>
            <CardDescription>
              This file contains {catalog.entries.length} keys and {catalog.languages.length} languages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LanguagePicker
              languages={catalog.languages}
              onSelect={handleLanguageSelect}
              placeholder="Select a language to edit"
            />
            <div className="flex flex-wrap gap-2">
              {catalog.languages.map((language) => (
                <Button key={language} variant="secondary" onClick={() => handleLanguageSelect(language)}>
                  {language}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default HomePage
