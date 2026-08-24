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

describe('browser check', () => {
  it('parses reusable URL and browser limits', () => {
    const parsed = parseArguments([
      'https://example.com/',
      '--sitemap',
      '--max-pages=4',
      '--max-requests=80',
      '--profiles=desktop,narrow',
      '--settle=0',
      '--strict',
    ])

    expect(parsed.urls).toEqual(['https://example.com/'])
    expect(parsed.options).toMatchObject({
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
        { facts: { overflow: { clientWidth: 320, scrollWidth: 320 } }, profile: 'narrow', url: 'https://example.com/' },
        { facts: { overflow: { clientWidth: 640, scrollWidth: 640 } }, profile: 'zoom-200', url: 'https://example.com/' },
      ],
      requestedUrl: 'https://example.com/',
    }
    const report = createJsonReport(result, {
      maxPages: 10,
      maxRequests: 300,
      profiles: ['desktop'],
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
        summary: { checklistItems: { partial: 5, total: 5 } },
      },
      schemaVersion: 1,
      summary: { errors: 0, failed: false, pages: 1, warnings: 0 },
    })
    expect(report.result.assertions).toHaveLength(5)
    expect(report.result.assertions.every((assertion: { outcome: string }) => assertion.outcome === 'pass')).toBe(true)
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
    expect(report.checklistCoverage.summary.checklistItems).toMatchObject({ fail: 4, partial: 1, total: 5 })
  })

  const chromiumPath = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync)
  const chromiumIt = chromiumPath ? it : it.skip

  chromiumIt('blocks automatic form submissions, POST, external requests and popups before side effects', async () => {
    const receivedRequests: Array<{ method: string, url: string }> = []
    let origin = ''
    const server = createServer((request, response) => {
      receivedRequests.push({ method: request.method || '', url: request.url || '' })
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html>
<html lang="de"><head><title>Sicherer Browsertest</title></head>
<body><main><h1>Testseite</h1><form action="/submit" method="post"><button>Absenden</button></form></main>
<script>
  fetch('/mutate', { method: 'POST', body: 'nicht senden' }).catch(() => {})
  fetch('https://example.com/tracker').catch(() => {})
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
      profiles: ['desktop'],
      settleMilliseconds: 100,
    })
    const typedResult = result as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      issues: Array<{ code: string }>
      profiles: Array<{ facts: { forms: Array<{ action: string, method: string }> } }>
    }
    const issueCodes = typedResult.issues.map(issue => issue.code)

    expect(receivedRequests.every(request => request.method === 'GET')).toBe(true)
    expect(receivedRequests.some(request => ['/mutate', '/submit', '/popup'].includes(request.url))).toBe(false)
    expect(issueCodes).toContain('non-get-blocked')
    expect(issueCodes).toContain('external-request-blocked')
    expect(issueCodes).toContain('form-submission-blocked')
    expect(issueCodes).toContain('popup-blocked')
    expect(typedResult.assertions.find(assertion => assertion.assertionId === 'browser.context.chromium-headless-recorded')?.outcome).toBe('pass')
    expect(typedResult.assertions.filter(assertion => assertion.assertionId !== 'browser.context.chromium-headless-recorded').every(assertion => assertion.outcome === 'inconclusive')).toBe(true)
    expect(typedResult.profiles[0]?.facts.forms).toEqual([{ action: `${origin}/submit`, method: 'POST' }])
  }, 30_000)
})
