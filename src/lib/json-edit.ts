import { applyEdits, modify } from 'jsonc-parser'
import type { FormattingOptions } from 'jsonc-parser'

export interface JsonChange {
  path: (string | number)[]
  value: unknown
}

type ColonSpacing = 'space' | 'none'

function detectIndent(text: string) {
  const match = /\n([ \t]+)\S/.exec(text)
  if (!match || !match[1]) {
    return { insertSpaces: true, tabSize: 2 }
  }
  const indent = match[1]
  if (indent.includes('\t')) {
    return { insertSpaces: false, tabSize: 1 }
  }
  return { insertSpaces: true, tabSize: indent.length > 0 ? indent.length : 2 }
}

function detectEol(text: string) {
  const index = text.indexOf('\r\n')
  if (index !== -1) {
    return '\r\n'
  }
  return '\n'
}

export function detectFormattingOptions(text: string): FormattingOptions {
  const indent = detectIndent(text)
  const eol = detectEol(text)
  return {
    ...indent,
    eol,
  }
}

function detectColonSpacing(text: string): ColonSpacing | null {
  const withSpace = (text.match(/"(?:\\.|[^"\\])*"\s+:/g) ?? []).length
  const withoutSpace = (text.match(/"(?:\\.|[^"\\])*":/g) ?? []).length
  const total = withSpace + withoutSpace

  if (total === 0) {
    return null
  }

  return withSpace >= withoutSpace ? 'space' : 'none'
}

function formatKeyColonSpacing(text: string, style: ColonSpacing): string {
  return text.replace(/("(?:\\.|[^"\\])*")(\s*):/g, (_match, key, whitespace: string) => {
    if (whitespace.includes('\n') || whitespace.includes('\r')) {
      return `${key}${whitespace}:`
    }

    if (style === 'space') {
      const normalized = whitespace.length > 0 ? whitespace : ' '
      return `${key}${normalized}:`
    }

    return `${key}:`
  })
}

export function applyJsonChanges(
  text: string,
  changes: JsonChange[],
  formatting: FormattingOptions = detectFormattingOptions(text),
): string {
  let current = text
  const colonStyle = detectColonSpacing(text)
  for (const change of changes) {
    const edits = modify(current, change.path, change.value, {
      formattingOptions: formatting,
    })

    if (!edits.length) {
      continue
    }

    current = applyEdits(current, edits)
  }
  if (colonStyle) {
    return formatKeyColonSpacing(current, colonStyle)
  }
  return current
}

export function serializeJsonWithFormatting(
  value: unknown,
  referenceText: string,
  formatting: FormattingOptions = detectFormattingOptions(referenceText),
): string {
  const indent = formatting.insertSpaces
    ? ' '.repeat(formatting.tabSize ?? 2)
    : '\t'
  let serialized = JSON.stringify(value, null, indent)

  const colonStyle = detectColonSpacing(referenceText)
  if (colonStyle) {
    serialized = formatKeyColonSpacing(serialized, colonStyle)
  }

  if (referenceText.endsWith('\n') && !serialized.endsWith('\n')) {
    serialized += '\n'
  }

  if (formatting.eol === '\r\n' && !serialized.includes('\r\n')) {
    serialized = serialized.replace(/\n/g, '\r\n')
  }

  return serialized
}
