const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com'

export interface GithubRepoReference {
  owner: string
  repo: string
  branch?: string | undefined
  path?: string | undefined
}

export interface GithubResolvedReference {
  owner: string
  repo: string
  branch: string
  path?: string | undefined
}

export interface GithubTreeFile {
  path: string
  relativePath: string
  sha: string
  size?: number | undefined
}

interface GithubTreeEntry {
  path: string
  type: string
  sha: string
  size?: number
}

interface GithubTreeResponse {
  tree: GithubTreeEntry[]
  truncated?: boolean
}

interface GithubRepoInfo {
  default_branch?: string
}

function stripSuffix(value: string, suffix: string) {
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value
}

function cleanPath(path?: string) {
  if (!path) {
    return undefined
  }
  const cleaned = path.replace(/^\/+/, '').replace(/\/+$/, '')
  return cleaned.length > 0 ? cleaned : undefined
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function encodePath(path: string) {
  return path
    .split('/')
    .filter((part) => part.length > 0)
    .map((part) => encodeURIComponent(part))
    .join('/')
}

function normalizeRepo(value: string) {
  return stripSuffix(value, '.git')
}

export function parseGithubRepo(input: string): GithubRepoReference | null {
  const trimmed = input.trim()

  if (!trimmed) {
    return null
  }

  const buildReference = (
    owner: string,
    repo: string,
    branch?: string,
    path?: string,
  ): GithubRepoReference => ({
    owner,
    repo: normalizeRepo(repo),
    branch: branch ? cleanPath(branch) : undefined,
    path: cleanPath(path),
  })

  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL
    try {
      url = new URL(trimmed)
    } catch {
      return null
    }

    if (!/github\.com$/i.test(url.hostname)) {
      return null
    }

    const segments = url.pathname
      .split('/')
      .filter(Boolean)
      .map(decodeSegment)

    if (segments.length < 2) {
      return null
    }

    const owner = segments[0]!
    const repo = segments[1]!
    const rest = segments.slice(2)

    if (rest[0] === 'tree' && rest.length >= 2) {
      const branch = rest[1]!
      const path = rest.length > 2 ? rest.slice(2).join('/') : undefined
      return buildReference(owner, repo, branch, path)
    }

    if (rest[0] === 'blob' && rest.length >= 2) {
      const branch = rest[1]!
      const path = rest.length > 2 ? rest.slice(2).join('/') : undefined
      return buildReference(owner, repo, branch, path)
    }

    if (rest.length > 0) {
      return buildReference(owner, repo, undefined, rest.join('/'))
    }

    return buildReference(owner, repo)
  }

  const segments = trimmed.split('/').filter(Boolean).map(decodeSegment)

  if (segments.length < 2) {
    return null
  }

  const owner = segments[0]!
  let repoSegment = segments[1]!
  let branch: string | undefined

  for (const delimiter of ['@', '#']) {
    const delimiterIndex = repoSegment.indexOf(delimiter)
    if (delimiterIndex !== -1) {
      branch = decodeSegment(repoSegment.slice(delimiterIndex + 1))
      repoSegment = repoSegment.slice(0, delimiterIndex)
      break
    }
  }

  const repo = repoSegment
  let pathSegments = segments.slice(2)

  if (pathSegments[0] === 'tree' && pathSegments.length >= 2) {
    branch = branch ?? decodeSegment(pathSegments[1]!)
    pathSegments = pathSegments.slice(2)
  } else if (pathSegments[0] === 'blob' && pathSegments.length >= 2) {
    branch = branch ?? decodeSegment(pathSegments[1]!)
    pathSegments = pathSegments.slice(2)
  }

  const path = pathSegments.length > 0 ? pathSegments.join('/') : undefined

  return buildReference(owner, repo, branch, path)
}

async function githubRequest<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    let detail = ''
    try {
      const body = (await response.json()) as { message?: string }
      if (body?.message) {
        detail = `: ${body.message}`
      }
    } catch {
      // ignore parsing issues for error responses
    }

    throw new Error(`GitHub request failed (${response.status})${detail}`)
  }

  return (await response.json()) as T
}

export async function resolveGithubReference(
  reference: GithubRepoReference,
): Promise<GithubResolvedReference> {
  if (reference.branch && reference.branch.trim().length > 0) {
    return {
      owner: reference.owner,
      repo: reference.repo,
      branch: reference.branch,
      path: reference.path,
    }
  }

  const repoInfo = await githubRequest<GithubRepoInfo>(
    `${GITHUB_API_BASE}/repos/${reference.owner}/${reference.repo}`,
  )

  const branch = repoInfo.default_branch?.trim() ?? 'main'

  return {
    owner: reference.owner,
    repo: reference.repo,
    branch,
    path: reference.path,
  }
}

export async function listGithubXcstrings(
  reference: GithubRepoReference,
): Promise<{
  reference: GithubResolvedReference
  files: GithubTreeFile[]
  truncated: boolean
}> {
  const resolved = await resolveGithubReference(reference)
  const encodedBranch = encodePath(resolved.branch)
  const tree = await githubRequest<GithubTreeResponse>(
    `${GITHUB_API_BASE}/repos/${resolved.owner}/${resolved.repo}/git/trees/${encodedBranch}?recursive=1`,
  )

  const normalizedPath = cleanPath(resolved.path)
  const isSpecificFile = normalizedPath?.toLowerCase().endsWith('.xcstrings') ?? false
  const prefix = normalizedPath && !isSpecificFile ? `${normalizedPath}/` : undefined

  const files = tree.tree
    .filter((entry) => {
      if (entry.type !== 'blob') {
        return false
      }

      const pathLower = entry.path.toLowerCase()
      if (!pathLower.endsWith('.xcstrings')) {
        return false
      }

      if (!normalizedPath) {
        return true
      }

      if (isSpecificFile) {
        return entry.path === normalizedPath
      }

      return entry.path.startsWith(prefix!)
    })
    .map((entry) => {
      const relativePath = (() => {
        if (!normalizedPath) {
          return entry.path
        }
        if (isSpecificFile) {
          const parts = entry.path.split('/')
          return parts[parts.length - 1] ?? entry.path
        }
        return entry.path.slice(prefix!.length)
      })()

      return {
        path: entry.path,
        relativePath,
        sha: entry.sha,
        size: entry.size,
      }
    })

  return {
    reference: resolved,
    files,
    truncated: Boolean(tree.truncated),
  }
}

export async function fetchGithubFileContent(
  reference: GithubResolvedReference,
  path: string,
): Promise<string> {
  const safePath = cleanPath(path) ?? path
  const encodedBranch = encodePath(reference.branch)
  const encodedPath = safePath
    .split('/')
    .filter((part) => part.length > 0)
    .map((part) => encodeURIComponent(part))
    .join('/')
  const url = `${GITHUB_RAW_BASE}/${reference.owner}/${reference.repo}/${encodedBranch}/${encodedPath}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Unable to download ${path} from GitHub (status ${response.status}).`)
  }

  return await response.text()
}
