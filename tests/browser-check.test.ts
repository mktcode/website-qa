import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import {
  classifyBrowserRequest,
  createJsonReport,
  parseArguments,
  runBrowserCheck,
} from '../src/check-browser.mjs'

const openServers: Server[] = []

async function listen(server: Server) {
  openServers.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(openServers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })))
})

function emptyPrivacyObservation() {
  return {
    cookies: { recorded: 0, total: 0, truncated: false },
    indexedDatabases: { recorded: 0, total: 0, truncated: false },
    localStorage: { recorded: 0, total: 0, truncated: false },
    sessionStorage: { recorded: 0, total: 0, truncated: false },
  }
}

function completeProfile(profile: string, width: number) {
  return {
    blockedActions: [],
    cookies: [],
    facts: {
      overflow: { clientWidth: width, scrollWidth: width },
      storage: { localStorage: [], localStorageTotal: 0, sessionStorage: [], sessionStorageTotal: 0 },
    },
    indexedDatabases: [],
    privacyObservation: emptyPrivacyObservation(),
    profile,
    url: 'https://example.com/',
  }
}

describe('browser check', () => {
  it('parses reusable URL and browser limits', () => {
    const parsed = parseArguments([
      'https://example.com/',
      '--sitemap',
      '--max-pages=4',
      '--max-requests=80',
      '--profiles=desktop,narrow',
      '--settle=0',
      '--json-file=.website-qa/current/browser.json',
      '--strict',
    ])

    expect(parsed.urls).toEqual(['https://example.com/'])
    expect(parsed.options).toMatchObject({
      json: true,
      jsonFile: '.website-qa/current/browser.json',
      maxPages: 4,
      maxRequests: 80,
      profiles: ['desktop', 'narrow'],
      settleMilliseconds: 0,
      sitemap: true,
      strict: true,
    })
    expect(() => parseArguments(['https://example.com/', '--profiles=unknown'])).toThrow(/unbekanntes Profil/)
    expect(() => parseArguments(['https://example.com/', 'https://example.org/'])).toThrow(/genau eine Website/)
  })

  it('blocks non-GET, external, suspicious and unexpected requests', () => {
    const policy = {
      expectedUrl: 'https://example.com/page',
      maxRequests: 10,
      origin: 'https://example.com',
    }
    const details = {
      mainFrameNavigation: false,
      method: 'GET',
      origin: 'https://example.com',
      protocol: 'https:',
      requestNumber: 1,
      resourceType: 'fetch',
      url: 'https://example.com/api/data',
    }

    expect(classifyBrowserRequest({ ...details, method: 'POST' }, policy)).toMatchObject({ action: 'block', code: 'non-get-blocked' })
    expect(classifyBrowserRequest({ ...details, origin: 'https://tracker.example', url: 'https://tracker.example/pixel' }, policy)).toMatchObject({ action: 'block', code: 'external-request-blocked' })
    expect(classifyBrowserRequest({ ...details, url: 'https://example.com/delete-account' }, policy)).toMatchObject({ action: 'block', code: 'suspicious-get-blocked' })
    expect(classifyBrowserRequest({ ...details, mainFrameNavigation: true, url: 'https://example.com/other' }, policy)).toMatchObject({ action: 'block', code: 'unexpected-navigation-blocked' })
    expect(classifyBrowserRequest({ ...details, requestNumber: 11 }, policy)).toMatchObject({ action: 'block', code: 'request-limit' })
    expect(classifyBrowserRequest(details, policy)).toEqual({ action: 'allow' })
  })

  it('publishes explicit read-only guarantees in JSON', () => {
    const result = {
      blockedRequests: [],
      browser: { product: 'Chromium', version: 'Chromium 140.0' },
      finalUrl: 'https://example.com/',
      issues: [],
      profiles: [
        completeProfile('narrow', 320),
        completeProfile('zoom-200', 640),
      ],
      requestedUrl: 'https://example.com/?session=private-value',
    }
    const report = createJsonReport(result, {
      maxPages: 10,
      maxRequests: 300,
      profiles: ['narrow', 'zoom-200'],
      settleMilliseconds: 750,
      sitemap: false,
      strict: true,
      timeoutMilliseconds: 20_000,
    })

    expect(report.readOnlyGuarantees).toEqual({
      buttonsActivated: false,
      externalRequestsAllowed: false,
      fileUploads: false,
      formActionsInvoked: false,
      formsSubmitted: false,
      methodsAllowed: ['GET'],
      persistentBrowserProfile: false,
    })
    expect(report).toMatchObject({
      checklistCoverage: {
        summary: { checklistItems: { partial: 7, total: 7 } },
      },
      schemaVersion: 1,
      summary: { errors: 0, failed: false, pages: 1, warnings: 0 },
    })
    expect(report.result).toMatchObject({
      requestedUrl: 'https://example.com/',
      requestedUrlParameterNames: ['session'],
    })
    expect(JSON.stringify(report)).not.toContain('private-value')
    expect(report.result.assertions).toHaveLength(7)
    expect(report.result.assertions.every((assertion: { outcome: string }) => assertion.outcome === 'pass')).toBe(true)
  })

  it('marks bounded storage inventories as inconclusive when identifiers are truncated', () => {
    const profile = completeProfile('desktop', 1280)
    profile.privacyObservation.cookies = { recorded: 100, total: 101, truncated: true }
    const report = createJsonReport({
      blockedRequests: [],
      browser: { product: 'Chromium', version: 'Chromium 140.0' },
      finalUrl: 'https://example.com/',
      issues: [],
      profiles: [profile],
      requestedUrl: 'https://example.com/',
    }, {
      maxPages: 10,
      maxRequests: 300,
      profiles: ['desktop'],
      settleMilliseconds: 750,
      sitemap: false,
      strict: true,
      timeoutMilliseconds: 20_000,
    })

    const outcomes = new Map(report.result.assertions.map((assertion: { assertionId: string, outcome: string }) => [assertion.assertionId, assertion.outcome]))
    expect(outcomes.get('browser.privacy.external-request-observation-complete')).toBe('pass')
    expect(outcomes.get('browser.privacy.initial-storage-observation-complete')).toBe('inconclusive')
    expect(report.result.privacyObservations).toMatchObject({
      coverage: { identifierLimitPerKindAndProfile: 100, storageDataRecorded: true },
      valuesRecorded: false,
    })
  })

  it('reports observed browser defects as failed structured assertions', () => {
    const url = 'https://example.com/'
    const report = createJsonReport({
      blockedRequests: [],
      browser: { product: 'Chromium', version: 'Chromium 140.0' },
      finalUrl: url,
      issues: [
        { code: 'main-landmark-count', severity: 'warning' },
        { code: 'horizontal-overflow', severity: 'error' },
        { code: 'axe-landmark-one-main', severity: 'error' },
        { code: 'console-error', severity: 'error' },
      ],
      profiles: [
        { facts: { overflow: { clientWidth: 320, scrollWidth: 500 } }, profile: 'narrow', url },
        { facts: { overflow: { clientWidth: 640, scrollWidth: 800 } }, profile: 'zoom-200', url },
      ],
      requestedUrl: url,
    }, {
      maxPages: 10,
      maxRequests: 300,
      profiles: ['narrow', 'zoom-200'],
      sitemap: false,
      strict: true,
      timeoutMilliseconds: 20_000,
    })

    const outcomes = new Map(report.result.assertions.map((assertion: { assertionId: string, outcome: string }) => [assertion.assertionId, assertion.outcome]))
    expect(outcomes.get('browser.document.main-landmark-single')).toBe('fail')
    expect(outcomes.get('browser.viewport.narrow-zoom-no-horizontal-overflow')).toBe('fail')
    expect(outcomes.get('browser.accessibility.axe-no-detected-violations')).toBe('fail')
    expect(outcomes.get('browser.runtime.no-observed-errors')).toBe('fail')
    expect(outcomes.get('browser.privacy.external-request-observation-complete')).toBe('inconclusive')
    expect(outcomes.get('browser.privacy.initial-storage-observation-complete')).toBe('inconclusive')
    expect(report.checklistCoverage.summary.checklistItems).toMatchObject({ fail: 4, partial: 1, total: 7 })
  })

  const chromiumPath = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync)
  const chromiumIt = chromiumPath ? it : it.skip

  chromiumIt('blocks side effects while inventorying external attempts, cookies and storage without values', async () => {
    const externalRequests: Array<{ method: string, url: string }> = []
    const externalOrigin = await listen(createServer((request, response) => {
      externalRequests.push({ method: request.method || '', url: request.url || '' })
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('darf nicht erreicht werden')
    }))
    const receivedRequests: Array<{ method: string, url: string }> = []
    let origin = ''
    const server = createServer((request, response) => {
      receivedRequests.push({ method: request.method || '', url: request.url || '' })
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': 'qa_session=private-cookie-value; HttpOnly; SameSite=Strict',
      })
      response.end(`<!doctype html>
<html lang="de"><head><title>Sicherer Browsertest</title></head>
<body><main><h1>Testseite</h1><form action="/submit" method="post"><button>Absenden</button></form></main>
<script>
  document.title = localStorage.getItem('contact:user@example.com') ? 'Persistierter Kontext' : 'Frischer Kontext'
  localStorage.setItem('contact:user@example.com', 'private-local-value')
  sessionStorage.setItem('qa-session-key', 'private-session-value')
  indexedDB.open('qa-private-database')
  fetch('/mutate', { method: 'POST', body: 'nicht senden' }).catch(() => {})
  fetch('${externalOrigin}/tracker?token=private-query-value').catch(() => {})
  document.querySelector('form').requestSubmit()
  window.open('/popup')
</script></body></html>`)
    })
    origin = await listen(server)

    const result = await runBrowserCheck(origin, {
      allowHttp: true,
      allowPrivate: true,
      chromiumPath,
      maxPages: 1,
      profiles: ['desktop', 'mobile'],
      settleMilliseconds: 200,
    })
    const typedResult = result as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      issues: Array<{ code: string }>
      privacyObservations: {
        externalRequestAttempts: { total: number }
        initialStorage: Record<string, { observations: number }>
        valuesRecorded: boolean
      }
      profiles: Array<{
        cookies: Array<{ httpOnly: boolean, name: string }>
        facts: { forms: Array<{ action: string, method: string }>, storage: { localStorage: string[], sessionStorage: string[] }, title: string }
        indexedDatabases: string[]
      }>
    }
    const issueCodes = typedResult.issues.map(issue => issue.code)
    const outcomes = new Map(typedResult.assertions.map(assertion => [assertion.assertionId, assertion.outcome]))

    expect(receivedRequests.every(request => request.method === 'GET')).toBe(true)
    expect(receivedRequests.some(request => ['/mutate', '/submit', '/popup'].includes(request.url))).toBe(false)
    expect(externalRequests).toEqual([])
    expect(issueCodes).toContain('non-get-blocked')
    expect(issueCodes).toContain('external-request-blocked')
    expect(issueCodes).toContain('form-submission-blocked')
    expect(issueCodes).toContain('popup-blocked')
    expect(outcomes.get('browser.context.chromium-headless-recorded')).toBe('pass')
    expect(outcomes.get('browser.privacy.external-request-observation-complete')).toBe('pass')
    expect(outcomes.get('browser.privacy.initial-storage-observation-complete')).toBe('pass')
    expect(typedResult.assertions.filter(assertion => !assertion.assertionId.startsWith('browser.privacy.') && assertion.assertionId !== 'browser.context.chromium-headless-recorded').every(assertion => assertion.outcome === 'inconclusive')).toBe(true)
    expect(typedResult.privacyObservations).toMatchObject({
      externalRequestAttempts: { total: 2 },
      initialStorage: {
        cookies: { observations: 2 },
        indexedDatabases: { observations: 2 },
        localStorage: { observations: 2 },
        sessionStorage: { observations: 2 },
      },
      valuesRecorded: false,
    })
    expect(typedResult.profiles.every(profile => profile.cookies.some(cookie => cookie.httpOnly && cookie.name === 'qa_session'))).toBe(true)
    expect(typedResult.profiles.every(profile => profile.facts.title === 'Frischer Kontext')).toBe(true)
    expect(typedResult.profiles[0]?.facts.forms).toEqual([{ action: `${origin}/submit`, method: 'POST' }])
    expect(typedResult.profiles[0]?.facts.storage).toMatchObject({ localStorage: ['contact:[REDACTED_EMAIL]'], sessionStorage: ['qa-session-key'] })
    expect(typedResult.profiles[0]?.indexedDatabases).toEqual(['qa-private-database'])
    const jsonReport = createJsonReport(result, {
      allowPrivate: true,
      maxPages: 1,
      maxRequests: 300,
      profiles: ['desktop', 'mobile'],
      settleMilliseconds: 200,
      sitemap: false,
      strict: false,
      timeoutMilliseconds: 20_000,
    })
    const serialized = JSON.stringify(jsonReport)
    expect(serialized).not.toContain('127.0.0.1')
    expect(serialized).not.toContain('private-cookie-value')
    expect(serialized).not.toContain('private-local-value')
    expect(serialized).not.toContain('private-session-value')
    expect(serialized).not.toContain('private-query-value')
    expect(serialized).not.toContain('user@example.com')
    expect(serialized).toContain('(privates/lokales Ziel)')
  }, 30_000)
})
