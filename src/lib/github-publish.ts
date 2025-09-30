import type { GithubCatalogSource } from './catalog-context'

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'

type GithubAuthedRequestOptions = RequestInit & { allow404?: boolean }

type GithubUser = {
  login: string
}

type GithubRepo = {
  html_url: string
}

type GithubRefResponse = {
  object?: {
    sha?: string
  }
}

type GithubPullRequest = {
  html_url: string
}

export type GithubPublishStatus =
  | 'validating-token'
  | 'creating-fork'
  | 'waiting-for-fork'
  | 'creating-branch'
  | 'committing-changes'
  | 'creating-pull-request'

export interface PublishCatalogOptions {
  token: string
  source: GithubCatalogSource
  content: string
  commitMessage: string
  pullRequestTitle: string
  pullRequestBody?: string
  onStatus?: (status: GithubPublishStatus) => void
}

export interface PublishCatalogResult {
  forkUrl: string
  pullRequestUrl: string
  branchName: string
  forkOwner: string
}

const DEFAULT_PR_BODY =
  'This pull request was created automatically via the xcstrings-editor web application.'

function buildHeaders(token: string, existing?: HeadersInit) {
  const headers = new Headers(existing)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('Authorization', `token ${token}`)
  headers.set('X-GitHub-Api-Version', GITHUB_API_VERSION)
  return headers
}

async function githubAuthedRequest<T>(
  token: string,
  url: string,
  init: GithubAuthedRequestOptions = {},
): Promise<T> {
  const { allow404, ...requestInit } = init
  const headers = buildHeaders(token, requestInit.headers)
  const response = await fetch(url, { ...requestInit, headers })

  if (!response.ok) {
    if (allow404 && response.status === 404) {
      return undefined as T
    }

    let detail = ''
    try {
      const body = await response.json()
      if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
        detail = `: ${body.message}`
      }
    } catch {
      // ignore parsing issues for error responses
    }

    throw new Error(`GitHub request failed (${response.status})${detail}`)
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return undefined as T
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function encodeGitRef(ref: string) {
  return ref
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function encodeRepoPath(path: string) {
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function toBase64(value: string) {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(value)
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return window.btoa(binary)
  }

  throw new Error('Base64 encoding not supported in this environment.')
}

async function requestFork(token: string, source: GithubCatalogSource): Promise<void> {
  await githubAuthedRequest(token, `${GITHUB_API_BASE}/repos/${source.owner}/${source.repo}/forks`, {
    method: 'POST',
  })
}

async function waitForForkReady(
  token: string,
  source: GithubCatalogSource,
  login: string,
): Promise<GithubRepo> {
  const forkUrl = `${GITHUB_API_BASE}/repos/${login}/${source.repo}`
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const repo = await githubAuthedRequest<GithubRepo | undefined>(token, forkUrl, {
      allow404: true,
    })
    if (repo) {
      return repo
    }
    await delay(1200)
  }
  throw new Error('Timed out while waiting for GitHub fork creation to complete.')
}

async function createBranch(
  token: string,
  source: GithubCatalogSource,
  forkOwner: string,
  branchName: string,
): Promise<void> {
  const upstreamRef = await githubAuthedRequest<GithubRefResponse>(
    token,
    `${GITHUB_API_BASE}/repos/${source.owner}/${source.repo}/git/ref/heads/${encodeGitRef(source.branch)}`,
  )

  const baseSha = upstreamRef.object?.sha
  if (!baseSha) {
    throw new Error('Unable to read base branch reference from upstream repository.')
  }

  await githubAuthedRequest(token, `${GITHUB_API_BASE}/repos/${forkOwner}/${source.repo}/git/refs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    }),
  })
}

async function commitFile(
  token: string,
  source: GithubCatalogSource,
  forkOwner: string,
  branchName: string,
  content: string,
  commitMessage: string,
): Promise<void> {
  await githubAuthedRequest(token, `${GITHUB_API_BASE}/repos/${forkOwner}/${source.repo}/contents/${encodeRepoPath(source.path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content: toBase64(content),
      branch: branchName,
      sha: source.sha,
    }),
  })
}

async function createPullRequest(
  token: string,
  source: GithubCatalogSource,
  forkOwner: string,
  branchName: string,
  title: string,
  body?: string,
): Promise<GithubPullRequest> {
  return githubAuthedRequest<GithubPullRequest>(
    token,
    `${GITHUB_API_BASE}/repos/${source.owner}/${source.repo}/pulls`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        head: `${forkOwner}:${branchName}`,
        base: source.branch,
        body,
      }),
    },
  )
}

function createBranchName() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `xcstrings-editor-${timestamp}-${random}`
}

export async function publishCatalogToGithub(options: PublishCatalogOptions): Promise<PublishCatalogResult> {
  const {
    token,
    source,
    content,
    commitMessage,
    pullRequestTitle,
    pullRequestBody = DEFAULT_PR_BODY,
    onStatus,
  } = options

  const resolvedCommitMessage = commitMessage.trim().length > 0 ? commitMessage.trim() : 'Update translations'
  const resolvedPullRequestTitle =
    pullRequestTitle.trim().length > 0 ? pullRequestTitle.trim() : resolvedCommitMessage

  onStatus?.('validating-token')
  const user = await githubAuthedRequest<GithubUser>(token, `${GITHUB_API_BASE}/user`)
  if (!user?.login) {
    throw new Error('Failed to resolve the GitHub account associated with the provided token.')
  }

  onStatus?.('creating-fork')
  await requestFork(token, source)

  onStatus?.('waiting-for-fork')
  const forkInfo = await waitForForkReady(token, source, user.login)

  const branchName = createBranchName()

  onStatus?.('creating-branch')
  await createBranch(token, source, user.login, branchName)

  onStatus?.('committing-changes')
  await commitFile(token, source, user.login, branchName, content, resolvedCommitMessage)

  onStatus?.('creating-pull-request')
  const pullRequest = await createPullRequest(
    token,
    source,
    user.login,
    branchName,
    resolvedPullRequestTitle,
    pullRequestBody,
  )

  return {
    forkUrl: forkInfo.html_url,
    pullRequestUrl: pullRequest.html_url,
    branchName,
    forkOwner: user.login,
  }
}
