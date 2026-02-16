import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AiSettingsState {
  ollamaUrl: string
  model: string
  isConnected: boolean
  availableModels: string[]
}

interface AiSettingsActions {
  setOllamaUrl: (url: string) => void
  setModel: (model: string) => void
  setConnected: (connected: boolean) => void
  setAvailableModels: (models: string[]) => void
}

export const useAiSettingsStore = create<AiSettingsState & AiSettingsActions>()(
  persist(
    (set) => ({
      ollamaUrl: 'http://127.0.0.1:11434',
      model: 'hf.co/DevQuasar/ModelSpace.GemmaX2-28-9B-v0.1-GGUF:Q8_0',
      isConnected: false,
      availableModels: [],

      setOllamaUrl: (url) => set({ ollamaUrl: url }),
      setModel: (model) => set({ model }),
      setConnected: (connected) => set({ isConnected: connected }),
      setAvailableModels: (models) => set({ availableModels: models }),
    }),
    {
      name: 'xcstrings-editor-ai',
      partialize: (state) => ({
        ollamaUrl: state.ollamaUrl,
        model: state.model,
      }),
    },
  ),
)
