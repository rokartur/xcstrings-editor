import { formatLocaleCode } from './locale-options'

export function addKnownRegion(content: string, locale: string): { content: string; updated: boolean } {
  const normalizedLocale = formatLocaleCode(locale)

  if (!normalizedLocale.trim()) {
    return { content, updated: false }
  }

  const pattern = /knownRegions\s*=\s*\(([^]*?)\)\s*;/m
  const match = pattern.exec(content)

  if (!match || match.index === undefined) {
    return { content, updated: false }
  }

  const body = match[1] ?? ''
  const tokens = Array.from(body.matchAll(/([A-Za-z0-9_-]+)/g))
    .map((entry) => (entry[1] ?? '').trim())
    .filter((token) => token.length > 0)

  const normalizedSet = new Set(tokens.map((token) => token.toLowerCase()))
  const normalizedTarget = normalizedLocale.toLowerCase()

  if (normalizedSet.has(normalizedTarget)) {
    return { content, updated: false }
  }

  const baseIndex = tokens.findIndex((token) => token.toLowerCase() === 'base')
  const nextTokens = [...tokens]

  if (baseIndex === -1) {
    nextTokens.push(normalizedLocale)
  } else {
    nextTokens.splice(baseIndex, 0, normalizedLocale)
  }

  let itemIndent = '\t\t'
  const blockLines = match[0]?.split('\n') ?? []
  for (let i = 1; i < blockLines.length; i += 1) {
    const line = blockLines[i]
    if (!line) {
      continue
    }
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }
    if (trimmed.startsWith(');')) {
      break
    }
    const indentMatch = /^([ \t]+)/.exec(line)
    if (indentMatch && indentMatch[1]) {
      itemIndent = indentMatch[1]
    }
    break
  }

  const closingIndentMatch = /\n([ \t]*)\);\s*$/.exec(match[0])
  const closingIndent = closingIndentMatch ? closingIndentMatch[1] : itemIndent.slice(0, Math.max(itemIndent.length - 1, 0))

  const formattedItems = nextTokens
    .map((token) => `${itemIndent}${token},`)
    .join('\n')

  const replacement = `knownRegions = (\n${formattedItems}\n${closingIndent});`

  const nextContent = `${content.slice(0, match.index)}${replacement}${content.slice(match.index + match[0].length)}`

  return {
    content: nextContent,
    updated: true,
  }
}
