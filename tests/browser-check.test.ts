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
    accessibilityIncompleteRuleIds: [],
    blockedActions: [],
    cookies: [],
    facts: {
      overflow: { clientWidth: width, scrollWidth: width },
      storage: { localStorage: [], localStorageTotal: 0, sessionStorage: [], sessionStorageTotal: 0 },
    },
    indexedDatabases: [],
    privacyObservation: emptyPrivacyObservation(),
    profile,
    readOnlyExecution: {
      allowedGetRequests: 1,
      allowedNonGetOrExternalRequests: 0,
      blockedActionCountsByKind: {},
      blockedRequestCountsByCode: {},
      domGuardsInstalledBeforeNavigation: true,
      interceptedRequests: 1,
      profile,
      requestInterceptionInstalledBeforeNavigation: true,
      url: 'https://example.com/',
    },
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
      '--max-sitemaps=6',
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
      maxSitemaps: 6,
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

    expect(report.options.maxSitemaps).toBe(10)
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
      checklist: { id: 'website-qa-checklist', version: '2.0.0' },
      schemaVersion: 2,
      summary: { errors: 0, failed: false, pages: 1, warnings: 0 },
    })
    expect(report.result).toMatchObject({
      requestedUrl: 'https://example.com/',
      requestedUrlParameterNames: ['session'],
    })
    expect(JSON.stringify(report)).not.toContain('private-value')
    expect(report.result.signals).toHaveLength(14)
    expect(report.result.signals.every((signal: { status: string }) => signal.status === 'positive')).toBe(true)

    const prohibitedProfile = completeProfile('desktop', 1280)
    prohibitedProfile.readOnlyExecution.allowedNonGetOrExternalRequests = 1
    const prohibitedReport = createJsonReport({
      blockedRequests: [],
      browser: { product: 'Chromium', version: 'Chromium 140.0' },
      finalUrl: 'https://example.com/',
      issues: [],
      profiles: [prohibitedProfile],
      requestedUrl: 'https://example.com/',
    }, {
      maxPages: 1,
      maxRequests: 10,
      profiles: ['desktop'],
      settleMilliseconds: 0,
      sitemap: false,
      strict: true,
      timeoutMilliseconds: 20_000,
    })
    expect(prohibitedReport.result.signals.find((entry: { id: string }) => entry.id === 'browser.run.read-only-boundaries-enforced')?.status).toBe('defect')
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

    const outcomes = new Map(report.result.signals.map((assertion: { id: string, status: string }) => [assertion.id, assertion.status]))
    expect(outcomes.get('browser.privacy.external-request-observation-complete')).toBe('positive')
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
        { accessibilityIncompleteRuleIds: [], facts: { overflow: { clientWidth: 320, scrollWidth: 500 } }, profile: 'narrow', url },
        { accessibilityIncompleteRuleIds: [], facts: { overflow: { clientWidth: 640, scrollWidth: 800 } }, profile: 'zoom-200', url },
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

    const outcomes = new Map(report.result.signals.map((assertion: { id: string, status: string }) => [assertion.id, assertion.status]))
    expect(outcomes.get('browser.document.main-landmark-single')).toBe('defect')
    expect(outcomes.get('browser.viewport.narrow-zoom-no-horizontal-overflow')).toBe('defect')
    expect(outcomes.get('browser.accessibility.axe-no-detected-violations')).toBe('defect')
    expect(outcomes.get('browser.runtime.no-observed-errors')).toBe('defect')
    expect(outcomes.get('browser.privacy.external-request-observation-complete')).toBe('inconclusive')
    expect(outcomes.get('browser.privacy.initial-storage-observation-complete')).toBe('inconclusive')
    expect(report.result.signals.filter((signal: { status: string }) => signal.status === 'defect')).toHaveLength(4)
  })

  it('maps bounded Axe rule families to atomic accessibility assertions', () => {
    const profile = completeProfile('desktop', 1280)
    const report = createJsonReport({
      blockedRequests: [],
      browser: { product: 'Chromium', version: 'Chromium 140.0' },
      finalUrl: 'https://example.com/',
      issues: [
        { code: 'axe-button-name', severity: 'error' },
        { code: 'axe-link-in-text-block', severity: 'error' },
        { code: 'axe-image-alt', severity: 'error' },
        { code: 'axe-color-contrast', severity: 'error' },
        { code: 'axe-aria-hidden-focus', severity: 'error' },
        { code: 'axe-label', severity: 'error' },
      ],
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
    const outcomes = new Map(report.result.signals.map(
      (assertion: { id: string, status: string }) => [assertion.id, assertion.status],
    ))

    expect(outcomes.get('browser.accessibility.control-names-no-detected-violations')).toBe('defect')
    expect(outcomes.get('browser.accessibility.links-not-color-only-no-detected-violations')).toBe('defect')
    expect(outcomes.get('browser.accessibility.image-alternatives-no-detected-violations')).toBe('defect')
    expect(outcomes.get('browser.accessibility.text-contrast-no-detected-violations')).toBe('defect')
    expect(outcomes.get('browser.accessibility.visually-hidden-focusable-controls-no-detected-violations')).toBe('defect')
    expect(outcomes.get('browser.accessibility.form-control-labels-no-detected-violations')).toBe('defect')

    const incompleteProfile = {
      ...profile,
      accessibilityIncompleteRuleIds: ['color-contrast', 'aria-hidden-focus', 'select-name'],
    }
    const incompleteReport = createJsonReport({
      blockedRequests: [],
      browser: { product: 'Chromium', version: 'Chromium 140.0' },
      finalUrl: 'https://example.com/',
      issues: [],
      profiles: [incompleteProfile],
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
    const incompleteOutcomes = new Map(incompleteReport.result.signals.map(
      (assertion: { id: string, status: string }) => [assertion.id, assertion.status],
    ))
    expect(incompleteOutcomes.get('browser.accessibility.text-contrast-no-detected-violations')).toBe('inconclusive')
    expect(incompleteOutcomes.get('browser.accessibility.control-names-no-detected-violations')).toBe('positive')
    expect(incompleteOutcomes.get('browser.accessibility.visually-hidden-focusable-controls-no-detected-violations')).toBe('inconclusive')
    expect(incompleteOutcomes.get('browser.accessibility.form-control-labels-no-detected-violations')).toBe('inconclusive')

    const precedenceReport = createJsonReport({
      blockedRequests: [],
      browser: { product: 'Chromium', version: 'Chromium 140.0' },
      finalUrl: 'https://example.com/',
      issues: [{ code: 'axe-label', severity: 'error' }],
      profiles: [{ ...profile, accessibilityIncompleteRuleIds: ['label'] }],
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
    expect(precedenceReport.result.signals.find((entry: { id: string }) => entry.id === 'browser.accessibility.form-control-labels-no-detected-violations')?.status).toBe('defect')

    for (const ruleId of ['area-alt', 'input-image-alt']) {
      const overlappingReport = createJsonReport({
        blockedRequests: [],
        browser: { product: 'Chromium', version: 'Chromium 140.0' },
        finalUrl: 'https://example.com/',
        issues: [{ code: `axe-${ruleId}`, severity: 'error' }],
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
      const overlappingOutcomes = new Map(overlappingReport.result.signals.map(
        (assertion: { id: string, status: string }) => [assertion.id, assertion.status],
      ))
      expect(overlappingOutcomes.get('browser.accessibility.control-names-no-detected-violations')).toBe('defect')
      expect(overlappingOutcomes.get('browser.accessibility.image-alternatives-no-detected-violations')).toBe('defect')
    }
  })

  const chromiumPath = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync)
  if (!chromiumPath && process.env.WEBSITE_QA_REQUIRE_CHROMIUM === '1') {
    throw new Error('Chromium-Sicherheitsintegration ist erforderlich, aber kein unterstütztes Browser-Binary wurde gefunden.')
  }
  const chromiumIt = chromiumPath ? it : it.skip

  chromiumIt('traverses Sitemap indexes without requesting suspicious pages or redirects', async () => {
    const requestedPaths: string[] = []
    const server = createServer((request, response) => {
      requestedPaths.push(request.url || '')
      const origin = `http://${request.headers.host}`
      if (request.url === '/sitemap.xml') {
        response.writeHead(200, { 'content-type': 'application/xml' })
        response.end(`<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${origin}/child.xml</loc></sitemap><sitemap><loc>${origin}/delete-account.xml</loc></sitemap><sitemap><loc>${origin}/redirecting.xml</loc></sitemap></sitemapindex>`)
        return
      }
      if (request.url === '/child.xml') {
        response.writeHead(200, { 'content-type': 'application/xml' })
        response.end(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/indexed</loc></url><url><loc>${origin}/delete-account-page</loc></url><url><loc>${origin}/redirecting-page</loc></url></urlset>`)
        return
      }
      if (request.url === '/redirecting.xml' || request.url === '/redirecting-page') {
        response.writeHead(302, { location: '/delete-account' })
        response.end()
        return
      }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html lang="de"><head><title>Sitemapindex</title></head><body><main><h1>${request.url}</h1></main></body></html>`)
    })
    const origin = await listen(server)

    const result = await runBrowserCheck(origin, {
      allowHttp: true,
      allowPrivate: true,
      chromiumPath,
      maxPages: 3,
      profiles: ['desktop'],
      settleMilliseconds: 0,
      sitemap: true,
    }) as unknown as { issues: Array<{ code: string }>, profiles: Array<{ url: string }>, sitemaps: Array<{ kind: string }> }

    expect(requestedPaths).toEqual(expect.arrayContaining(['/child.xml', '/indexed', '/redirecting.xml', '/redirecting-page']))
    expect(requestedPaths.some(path => path.startsWith('/delete-account'))).toBe(false)
    expect(result.sitemaps.map(sitemap => sitemap.kind)).toEqual(['index', 'urlset'])
    expect(result.profiles.map(profile => profile.url)).toContain(`${origin}/indexed`)
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'navigation-skipped-read-only',
      'page-probe-failed',
      'sitemap-fetch',
      'sitemap-skipped-read-only',
    ]))
  }, 30_000)

  chromiumIt('propagates relevant real Axe incomplete results as inconclusive', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html>
<html lang="de"><head><title>Unvollständiger Kontrastbefund</title></head>
<body><main><h1>Testseite</h1>
<p style="color:#777;background-image:linear-gradient(#fff,#000)">Nicht eindeutig automatisch auswertbar</p>
</main></body></html>`)
    })
    const origin = await listen(server)
    const result = await runBrowserCheck(origin, {
      allowHttp: true,
      allowPrivate: true,
      chromiumPath,
      maxPages: 1,
      profiles: ['desktop'],
      settleMilliseconds: 0,
    }) as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      profiles: Array<{ accessibilityIncompleteRuleIds: string[] }>
    }
    const outcomes = new Map(result.assertions.map(assertion => [assertion.assertionId, assertion.outcome]))

    expect(result.profiles[0]?.accessibilityIncompleteRuleIds).toContain('color-contrast')
    expect(outcomes.get('browser.accessibility.axe-no-detected-violations')).toBe('inconclusive')
    expect(outcomes.get('browser.accessibility.text-contrast-no-detected-violations')).toBe('inconclusive')
  }, 30_000)

  chromiumIt('maps overlapping real Axe rules to both atomic accessibility assertions', async () => {
    const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
    const fixtures = [
      {
        body: `<img src="${pixel}" usemap="#map" alt="Navigation"><map name="map"><area shape="rect" coords="0,0,1,1" href="/target"></map>`,
        ruleId: 'area-alt',
      },
      {
        body: `<input type="image" src="${pixel}">`,
        ruleId: 'input-image-alt',
      },
    ]

    const results = await Promise.all(fixtures.map(async (fixture) => {
      const server = createServer((_request, response) => {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(`<!doctype html><html lang="de"><head><title>Überlappende Axe-Regel</title></head><body><main><h1>Testseite</h1>${fixture.body}</main></body></html>`)
      })
      const origin = await listen(server)
      const result = await runBrowserCheck(origin, {
        allowHttp: true,
        allowPrivate: true,
        chromiumPath,
        maxPages: 1,
        profiles: ['desktop'],
        settleMilliseconds: 0,
      }) as unknown as {
        assertions: Array<{ assertionId: string, outcome: string }>
        issues: Array<{ checklistRefs: string[], code: string }>
      }
      return { fixture, result }
    }))

    for (const { fixture, result } of results) {
      const outcomes = new Map(result.assertions.map(assertion => [assertion.assertionId, assertion.outcome]))
      const issue = result.issues.find(entry => entry.code === `axe-${fixture.ruleId}`)

      expect(outcomes.get('browser.accessibility.control-names-no-detected-violations')).toBe('fail')
      expect(outcomes.get('browser.accessibility.image-alternatives-no-detected-violations')).toBe('fail')
      expect(issue?.checklistRefs).toEqual(expect.arrayContaining(['CORE-A11Y-03', 'CORE-A11Y-08']))
    }
  }, 30_000)

  chromiumIt('derives the atomic accessibility assertions from real Axe findings', async () => {
    const receivedMethods: string[] = []
    const server = createServer((request, response) => {
      receivedMethods.push(request.method || '')
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html>
<html lang="de"><head><title>Accessibility-Regelfamilien</title><style>a, a:hover, a:focus { color:#555; text-decoration:none; }</style></head>
<body><main><h1>Testseite</h1>
<button><span aria-hidden="true">×</span></button>
<div aria-hidden="true"><button>Verborgen fokussierbar</button></div>
<input type="text">
<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
<p style="color:#aaa;background:#fff">Zu geringer Kontrast</p>
<p style="color:#000">Dies ist ein <a href="/target">nur farblich markierter Link</a> im längeren umgebenden Fließtext.</p>
</main></body></html>`)
    })
    const origin = await listen(server)
    const result = await runBrowserCheck(origin, {
      allowHttp: true,
      allowPrivate: true,
      chromiumPath,
      maxPages: 1,
      profiles: ['desktop'],
      settleMilliseconds: 0,
    }) as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      issues: Array<{ checklistRefs: string[], code: string }>
    }
    const issueCodes = result.issues.map(issue => issue.code)
    const outcomes = new Map(result.assertions.map(assertion => [assertion.assertionId, assertion.outcome]))

    expect(receivedMethods.every(method => method === 'GET')).toBe(true)
    expect(issueCodes).toContain('axe-button-name')
    expect(issueCodes).toContain('axe-image-alt')
    expect(issueCodes).toContain('axe-color-contrast')
    expect(issueCodes).toContain('axe-link-in-text-block')
    expect(issueCodes).toContain('axe-aria-hidden-focus')
    expect(issueCodes).toContain('axe-label')
    expect(outcomes.get('browser.accessibility.control-names-no-detected-violations')).toBe('fail')
    expect(outcomes.get('browser.accessibility.links-not-color-only-no-detected-violations')).toBe('fail')
    expect(outcomes.get('browser.accessibility.image-alternatives-no-detected-violations')).toBe('fail')
    expect(outcomes.get('browser.accessibility.text-contrast-no-detected-violations')).toBe('fail')
    expect(outcomes.get('browser.accessibility.visually-hidden-focusable-controls-no-detected-violations')).toBe('fail')
    expect(outcomes.get('browser.accessibility.form-control-labels-no-detected-violations')).toBe('fail')
    expect(result.issues.find(issue => issue.code === 'axe-button-name')?.checklistRefs).toContain('CORE-A11Y-03')
    expect(result.issues.find(issue => issue.code === 'axe-image-alt')?.checklistRefs).toContain('CORE-A11Y-08')
    expect(result.issues.find(issue => issue.code === 'axe-color-contrast')?.checklistRefs).toContain('CORE-A11Y-09')
    expect(result.issues.find(issue => issue.code === 'axe-aria-hidden-focus')?.checklistRefs).toContain('CORE-A11Y-04')
    expect(result.issues.find(issue => issue.code === 'axe-label')?.checklistRefs).toContain('CORE-A11Y-06')
  }, 30_000)

  chromiumIt('bounds high-volume DOM collections and preserves totals', async () => {
    const requestedPaths: string[] = []
    const server = createServer((request, response) => {
      requestedPaths.push(request.url || '')
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html lang="de"><head><title>DOM-Limit</title></head><body><main id="main"></main>
<script>
const main = document.querySelector('#main')
for (let index = 0; index < 150; index += 1) {
  main.insertAdjacentHTML('beforeend', '<h1>Überschrift ' + index + '</h1><a href="/target-' + index + '">Link</a><form action="/submit-' + index + '" method="post"></form>')
}
</script></body></html>`)
    })
    const origin = await listen(server)

    const result = await runBrowserCheck(origin, {
      allowHttp: true,
      allowPrivate: true,
      chromiumPath,
      maxPages: 1,
      profiles: ['desktop'],
      settleMilliseconds: 0,
    }) as unknown as {
      issues: Array<{ code: string }>
      profiles: Array<{
        facts: {
          domObservation: Record<string, { recorded: number, total: number, truncated: boolean } | number>
          forms: unknown[]
          h1: unknown[]
          links: unknown[]
        }
      }>
    }
    const facts = result.profiles[0]?.facts

    expect(requestedPaths.every(path => !path.startsWith('/target-') && !path.startsWith('/submit-'))).toBe(true)
    expect(facts?.links).toHaveLength(100)
    expect(facts?.forms).toHaveLength(100)
    expect(facts?.h1).toHaveLength(100)
    expect(facts?.domObservation).toMatchObject({
      forms: { recorded: 100, total: 150, truncated: true },
      h1: { recorded: 100, total: 150, truncated: true },
      limitPerKind: 100,
      links: { recorded: 100, total: 150, truncated: true },
    })
    expect(result.issues.map(issue => issue.code)).toContain('dom-observation-limit')
  }, 30_000)

  chromiumIt('bounds high-volume browser observations and reports truncation totals', async () => {
    const receivedUrls: string[] = []
    const server = createServer((request, response) => {
      receivedUrls.push(request.url || '')
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html lang="de"><head><title>Beobachtungslimit</title></head><body><main><h1>Test</h1></main>
<script>
for (let index = 0; index < 150; index += 1) {
  console.error('bounded-' + index)
  navigator.sendBeacon('/beacon', 'x')
  fetch('https://example.invalid/tracker-' + index).catch(() => {})
}
fetch('/mutate-after-warning-limit', { method: 'POST', body: 'blocked' }).catch(() => {})
</script></body></html>`)
    })
    const origin = await listen(server)

    const result = await runBrowserCheck(origin, {
      allowHttp: true,
      allowPrivate: true,
      chromiumPath,
      maxPages: 1,
      profiles: ['desktop'],
      settleMilliseconds: 100,
    }) as unknown as {
      blockedRequestObservation: { externalTotal: number, limit: number, recorded: number, total: number, truncated: boolean }
      blockedRequests: unknown[]
      issues: Array<{ code: string }>
      profiles: Array<{
        blockedActions: unknown[]
        consoleMessages: unknown[]
        observationLimits: {
          limitPerKind: number
          records: Record<string, { recorded: number, total: number, truncated: boolean }>
        }
        readOnlyExecution: { blockedActionCountsByKind: Record<string, number>, blockedRequestCountsByCode: Record<string, number> }
      }>
    }
    const profile = result.profiles[0]

    expect(receivedUrls).not.toContain('/beacon')
    expect(receivedUrls).not.toContain('/mutate-after-warning-limit')
    expect(result.blockedRequests).toHaveLength(100)
    expect(result.blockedRequestObservation).toEqual({ externalTotal: 150, limit: 100, recorded: 100, total: 151, truncated: true })
    expect(profile?.blockedActions).toHaveLength(100)
    expect(profile?.consoleMessages).toHaveLength(100)
    expect(profile?.observationLimits).toMatchObject({
      limitPerKind: 100,
      records: {
        blockedActions: { recorded: 100, total: 150, truncated: true },
        consoleMessages: { recorded: 100, truncated: true },
      },
    })
    expect(profile?.observationLimits.records.consoleMessages.total).toBeGreaterThanOrEqual(150)
    expect(profile?.readOnlyExecution.blockedActionCountsByKind.beacon).toBe(150)
    expect(profile?.readOnlyExecution.blockedRequestCountsByCode['non-get-blocked']).toBe(1)
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['browser-observation-limit', 'non-get-blocked']))
    const report = createJsonReport(result, {
      allowPrivate: true,
      maxPages: 1,
      maxRequests: 300,
      maxSitemaps: 10,
      profiles: ['desktop'],
      settleMilliseconds: 100,
      sitemap: false,
      strict: false,
      timeoutMilliseconds: 20_000,
    })
    expect(report.summary.errors).toBeGreaterThan(0)
    expect(report.summary.failed).toBe(true)
  }, 30_000)

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
  const popupLink = document.createElement('a')
  popupLink.href = '${externalOrigin}/declarative-popup'
  popupLink.target = '_blank'
  popupLink.textContent = 'Popup-Test'
  document.body.append(popupLink)
  popupLink.click()
  navigator.serviceWorker.register('/service-worker.js').catch(() => {})
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
      readOnlyExecutionEvidence: { destinationSideEffectsVerified: boolean }
      profiles: Array<{
        cookies: Array<{ httpOnly: boolean, name: string }>
        facts: { forms: Array<{ action: string, method: string }>, storage: { localStorage: string[], sessionStorage: string[] }, title: string }
        indexedDatabases: string[]
        readOnlyExecution: { allowedNonGetOrExternalRequests: number, blockedActionCountsByKind: Record<string, number>, domGuardsInstalledBeforeNavigation: boolean, requestInterceptionInstalledBeforeNavigation: boolean }
      }>
    }
    const issueCodes = typedResult.issues.map(issue => issue.code)
    const outcomes = new Map(typedResult.assertions.map(assertion => [assertion.assertionId, assertion.outcome]))

    expect(receivedRequests.every(request => request.method === 'GET')).toBe(true)
    expect(receivedRequests.some(request => ['/mutate', '/submit', '/popup', '/service-worker.js'].includes(request.url))).toBe(false)
    expect(externalRequests).toEqual([])
    expect(issueCodes).toContain('non-get-blocked')
    expect(issueCodes).toContain('external-request-blocked')
    expect(issueCodes).toContain('form-submission-blocked')
    expect(issueCodes).toContain('popup-blocked')
    expect(issueCodes).toContain('browser-action-blocked')
    expect(outcomes.get('browser.context.chromium-headless-recorded')).toBe('pass')
    expect(outcomes.get('browser.privacy.external-request-observation-complete')).toBe('pass')
    expect(outcomes.get('browser.privacy.initial-storage-observation-complete')).toBe('pass')
    expect(outcomes.get('browser.run.read-only-boundaries-enforced')).toBe('pass')
    const dependentAssertions = typedResult.assertions.filter(assertion => !assertion.assertionId.startsWith('browser.privacy.') && !assertion.assertionId.startsWith('browser.accessibility.') && !['browser.context.chromium-headless-recorded', 'browser.run.read-only-boundaries-enforced'].includes(assertion.assertionId))
    expect(dependentAssertions.every(assertion => assertion.outcome === 'inconclusive'), JSON.stringify(dependentAssertions)).toBe(true)
    expect(typedResult.privacyObservations).toMatchObject({
      externalRequestAttempts: { total: 4 },
      initialStorage: {
        cookies: { observations: 2 },
        indexedDatabases: { observations: 2 },
        localStorage: { observations: 2 },
        sessionStorage: { observations: 2 },
      },
      valuesRecorded: false,
    })
    expect(typedResult.readOnlyExecutionEvidence.destinationSideEffectsVerified).toBe(false)
    expect(typedResult.profiles.every(profile => profile.readOnlyExecution.domGuardsInstalledBeforeNavigation && profile.readOnlyExecution.requestInterceptionInstalledBeforeNavigation)).toBe(true)
    expect(typedResult.profiles.every(profile => profile.readOnlyExecution.allowedNonGetOrExternalRequests === 0)).toBe(true)
    expect(typedResult.profiles.every(profile => profile.readOnlyExecution.blockedActionCountsByKind['form-submit'] === 1)).toBe(true)
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
