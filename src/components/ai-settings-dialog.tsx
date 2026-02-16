import { useCallback, useEffect, useState } from 'react'
import { Bot, CheckCircle, Loader2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAiSettingsStore } from '@/lib/ai-settings-store'
import { useEditorStore } from '@/lib/editor-store'
import { checkConnection, listModels } from '@/lib/ollama'
import { cn } from '@/lib/utils'

export function AiSettingsDialog() {
  const { aiSettingsDialogOpen, setAiSettingsDialogOpen } = useEditorStore()
  const { ollamaUrl, model, isConnected, availableModels, setOllamaUrl, setModel, setConnected, setAvailableModels } = useAiSettingsStore()

  const [urlDraft, setUrlDraft] = useState(ollamaUrl)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    if (aiSettingsDialogOpen) {
      setUrlDraft(ollamaUrl)
      setTestResult(isConnected ? 'success' : null)
    }
  }, [aiSettingsDialogOpen, ollamaUrl, isConnected])

  const handleTestConnection = useCallback(async () => {
    const url = urlDraft.replace(/\/+$/, '')
    setTesting(true)
    setTestResult(null)

    const ok = await checkConnection(url)
    if (ok) {
      setOllamaUrl(url)
      setConnected(true)
      setTestResult('success')
      const models = await listModels(url)
      setAvailableModels(models.map((m) => m.name))
    } else {
      setConnected(false)
      setTestResult('error')
      setAvailableModels([])
    }
    setTesting(false)
  }, [urlDraft, setOllamaUrl, setConnected, setAvailableModels])

  return (
    <Dialog open={aiSettingsDialogOpen} onOpenChange={setAiSettingsDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="size-4" strokeWidth={1.5} />
            AI Translation Settings
          </DialogTitle>
          <DialogDescription>
            Configure your local Ollama instance for AI-powered translations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ollama URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Ollama URL</label>
            <div className="flex gap-2">
              <Input
                value={urlDraft}
                onChange={(e) => {
                  setUrlDraft(e.target.value)
                  setTestResult(null)
                }}
                placeholder="http://127.0.0.1:11434"
                className="flex-1 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testing || !urlDraft.trim()}
                onClick={handleTestConnection}
              >
                {testing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : null}
                Test
              </Button>
            </div>
            {testResult && (
              <p
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-2 text-xs',
                  testResult === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    : 'bg-destructive/10 text-destructive',
                )}
              >
                {testResult === 'success' ? (
                  <><CheckCircle className="size-3.5" strokeWidth={1.5} /> Connected to Ollama</>
                ) : (
                  <><XCircle className="size-3.5" strokeWidth={1.5} /> Cannot connect. Is Ollama running?</>
                )}
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Model</label>
            {availableModels.length > 0 ? (
              <Select value={model} onValueChange={(v) => { if (v) setModel(v) }}>
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-1.5">
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="hf.co/DevQuasar/ModelSpace.GemmaX2-28-9B-v0.1-GGUF:Q8_0"
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Connect to Ollama to see available models, or type a model name directly.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
