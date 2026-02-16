export interface TranslateOptions {
  text: string
  sourceLocale: string
  targetLocale: string
  key?: string | undefined
  comment?: string | undefined
  baseUrl: string
  model: string
  signal?: AbortSignal | undefined
  onToken?: ((token: string) => void) | undefined
}

export interface OllamaModel {
  name: string
  modified_at: string
  size: number
}

export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly code: 'CONNECTION_FAILED' | 'MODEL_NOT_FOUND' | 'GENERATION_FAILED',
  ) {
    super(message)
    this.name = 'OllamaError'
  }
}

function buildPrompt(opts: Pick<TranslateOptions, 'text' | 'sourceLocale' | 'targetLocale' | 'key' | 'comment'>): string {
  const sourceLanguage = localeToLanguageName(opts.sourceLocale)
  const targetLanguage = localeToLanguageName(opts.targetLocale)

  return `Translate this from ${sourceLanguage} to ${targetLanguage}:
${sourceLanguage}: ${opts.text}
${targetLanguage}:`
}

function localeToLanguageName(locale: string): string {
  const normalized = locale.replace('_', '-').split('-')[0]?.toLowerCase() ?? locale
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'language' })
    return display.of(normalized) ?? locale
  } catch {
    return locale
  }
}

function getCandidateBaseUrls(baseUrl: string): string[] {
  const normalized = baseUrl.replace(/\/+$/, '')
  const candidates = new Set<string>([normalized])

  try {
    const parsed = new URL(normalized)
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1'
      candidates.add(parsed.toString().replace(/\/+$/, ''))
    }
  } catch {
    // Ignore invalid URLs here; fetch will fail with a proper error later.
  }

  return [...candidates]
}

function extractJsonTranslation(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const parseCandidate = (candidate: string): string | null => {
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (parsed && typeof parsed === 'object') {
        const value = (parsed as { translation?: unknown }).translation
        if (typeof value === 'string') return value.trim()
      }
      return null
    } catch {
      return null
    }
  }

  const direct = parseCandidate(trimmed)
  if (direct !== null) return direct

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return parseCandidate(trimmed.slice(firstBrace, lastBrace + 1))
  }

  return null
}

function extractTranslation(raw: string, targetLocale: string): string {
  const targetLanguage = localeToLanguageName(targetLocale)
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const targetLabel = `${targetLanguage}:`
  const labelIndex = trimmed.toLowerCase().lastIndexOf(targetLabel.toLowerCase())
  if (labelIndex !== -1) {
    const afterLabel = trimmed.slice(labelIndex + targetLabel.length).trim()
    if (afterLabel.length > 0) return afterLabel
  }

  const cleanedLines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase()
      return !(
        lower.startsWith('translate this from ') ||
        lower.startsWith('translate source_text from ') ||
        lower.startsWith('keep placeholder tokens unchanged') ||
        lower.startsWith('return only the translated text') ||
        lower.startsWith('return strict json object') ||
        lower.startsWith('you are a translation engine') ||
        lower.startsWith('use metadata only for disambiguation') ||
        lower.startsWith('preserve placeholders exactly') ||
        lower.startsWith('context:') ||
        lower.startsWith('- localization key:') ||
        lower.startsWith('- developer comment:') ||
        lower.startsWith('metadata_key:') ||
        lower.startsWith('metadata_comment:') ||
        lower.startsWith('source_text:') ||
        lower.startsWith('rules:') ||
        lower.startsWith('text to translate:')
      )
    })
    .filter((line) => !/^[\p{L}\s]{1,24}:$/u.test(line))

  if (cleanedLines.length > 0) {
    return cleanedLines[cleanedLines.length - 1]!
  }

  return trimmed
}

export async function checkConnection(baseUrl: string): Promise<boolean> {
  const candidates = getCandidateBaseUrls(baseUrl)
  for (const candidate of candidates) {
    try {
      const res = await fetch(`${candidate}/api/tags`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) return true
    } catch {
      // Try next candidate.
    }
  }
  return false
}

export async function listModels(baseUrl: string): Promise<OllamaModel[]> {
  const candidates = getCandidateBaseUrls(baseUrl)
  for (const candidate of candidates) {
    try {
      const res = await fetch(`${candidate}/api/tags`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const data = await res.json()
      return (data.models ?? []) as OllamaModel[]
    } catch {
      // Try next candidate.
    }
  }
  return []
}

export async function translateText(opts: TranslateOptions): Promise<string> {
  const prompt = buildPrompt(opts)

  const candidates = getCandidateBaseUrls(opts.baseUrl)
  let res: Response | null = null

  for (const candidate of candidates) {
    try {
      res = await fetch(`${candidate}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opts.model,
          prompt,
          stream: true,
          options: { temperature: 0.1 },
        }),
        ...(opts.signal ? { signal: opts.signal } : {}),
      })
      break
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      // Try next candidate.
    }
  }

  if (!res) {
    throw new OllamaError(
      'Cannot connect to Ollama. Make sure it is running (try 127.0.0.1:11434).',
      'CONNECTION_FAILED',
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 404 || body.includes('not found')) {
      throw new OllamaError(
        `Model "${opts.model}" not found. Pull it with: ollama pull ${opts.model}`,
        'MODEL_NOT_FOUND',
      )
    }
    throw new OllamaError(`Ollama error: ${res.status} ${body}`, 'GENERATION_FAILED')
  }

  const reader = res.body?.getReader()
  if (!reader) throw new OllamaError('No response body', 'GENERATION_FAILED')

  const decoder = new TextDecoder()
  let result = ''
  let pending = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    pending += decoder.decode(value, { stream: true })
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const json = JSON.parse(line)
        if (json.response) {
          result += json.response
          opts.onToken?.(json.response)
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  pending += decoder.decode()
  if (pending.trim()) {
    try {
      const json = JSON.parse(pending)
      if (json.response) {
        result += json.response
        opts.onToken?.(json.response)
      }
    } catch {
      // ignore trailing incomplete payload
    }
  }

  const jsonTranslation = extractJsonTranslation(result)
  if (jsonTranslation !== null) return jsonTranslation

  return extractTranslation(result, opts.targetLocale)
}

export interface BatchTranslateOptions {
  entries: { key: string; sourceText: string; comment?: string | undefined }[]
  sourceLocale: string
  targetLocale: string
  baseUrl: string
  model: string
  signal?: AbortSignal | undefined
  onProgress?: ((completed: number, total: number, key: string, translation: string) => void) | undefined
  onEntryToken?: ((key: string, token: string) => void) | undefined
}

export interface BatchTranslateResult {
  key: string
  translation: string
  error?: string
}

export async function translateBatch(opts: BatchTranslateOptions): Promise<BatchTranslateResult[]> {
  const results: BatchTranslateResult[] = []
  const total = opts.entries.length

  for (let i = 0; i < total; i++) {
    const entry = opts.entries[i]!
    opts.signal?.throwIfAborted()

    try {
      const translation = await translateText({
        text: entry.sourceText,
        sourceLocale: opts.sourceLocale,
        targetLocale: opts.targetLocale,
        key: entry.key,
        comment: entry.comment,
        baseUrl: opts.baseUrl,
        model: opts.model,
        signal: opts.signal,
        onToken: (token) => opts.onEntryToken?.(entry.key, token),
      })

      results.push({ key: entry.key, translation })
      opts.onProgress?.(i + 1, total, entry.key, translation)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      results.push({
        key: entry.key,
        translation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      opts.onProgress?.(i + 1, total, entry.key, '')
    }
  }

  return results
}
