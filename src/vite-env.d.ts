/// <reference types="vite/client" />

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration?: ServiceWorkerRegistration) => void
    onRegisterError?: (error: unknown) => void
  }

  export function registerSW(options?: RegisterSWOptions): () => void
}

declare module 'virtual:pwa-register/react' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration?: ServiceWorkerRegistration) => void
    onRegisterError?: (error: unknown) => void
  }

  export function useRegisterSW(options?: RegisterSWOptions): void
}

declare module 'locale-codes' {
  interface LocaleCodesEntry {
    tag: string
    name?: string
    local?: string
    location?: string
  }

  export const all: LocaleCodesEntry[]
  export function getByTag(tag: string): LocaleCodesEntry | undefined
  export function where(key: string, value: string): LocaleCodesEntry | undefined
}
