#!/usr/bin/env node

/* eslint-disable no-console */
/* oxlint-disable no-await-in-loop */

import { existsSync } from 'node:fs'
import axe from 'axe-core'
import puppeteer from 'puppeteer-core'
import { parseSitemapXml, readOnlyNavigationConcern } from './check-crawl.mjs'
import { checklistItemIdsForTool, evaluatePilotChecklist } from './lib/checklist-report.mjs'
import { assertPublicResolution, fetchResource, normalizeMimeType, redactReportData, redactText, reportUrl, validateUrl } from './lib/http-client.mjs'
import { writeJsonOutput } from './lib/json-output.mjs'
import { isMainModule, packageName, packageVersion } from './lib/package-info.mjs'

const defaultProfiles = ['desktop', 'mobile', 'narrow', 'reduced-motion', 'zoom-200']
const profileDefinitions = {
  'desktop': { height: 900, label: 'Desktop 1280 px', reducedMotion: false, width: 1280 },
  'mobile': { height: 844, label: 'Mobil 390 px', mobile: true, reducedMotion: false, width: 390 },
  'narrow': { height: 800, label: 'Schmal 320 px', mobile: true, reducedMotion: false, width: 320 },
  'reduced-motion': { height: 900, label: 'Reduced Motion 1280 px', reducedMotion: true, width: 1280 },
  'zoom-200': { height: 900, label: '200-%-Zoom-Näherung', reducedMotion: false, width: 640, zoomApproximation: 2 },
}

const defaultOptions = {
  allowHttp: false,
  allowPrivate: false,
  chromiumPath: undefined,
  json: false,
  jsonFile: undefined,
  maxPages: 10,
  maxRedirects: 5,
  maxRequests: 300,
  maxSitemaps: 10,
  profiles: defaultProfiles,
  settleMilliseconds: 750,
  sitemap: false,
  sitemapUrl: undefined,
  strict: false,
  timeoutMilliseconds: 20_000,
}

function usage() {
  return `Öffentliche Websites in einem isolierten Browser ausschließlich beobachtend prüfen.

Aufruf:
  website-qa-browser <URL> [Optionen]

Optionen:
  --sitemap                 /sitemap.xml und enthaltene Seiten einbeziehen
  --sitemap-url=<URL>       Abweichende Sitemap-URL verwenden
  --max-pages=<Anzahl>      Höchstens so viele Seiten prüfen (Standard: 10)
  --max-requests=<Anzahl>   Höchstens so viele Requests je Seite/Profil (Standard: 300)
  --profiles=<Liste>        desktop,mobile,narrow,reduced-motion,zoom-200
  --timeout=<Millisek.>     Navigations- und Browser-Timeout (Standard: 20000)
  --settle=<Millisek.>      Beobachtungszeit nach DOMContentLoaded (Standard: 750)
  --chromium-path=<Pfad>    Chromium-/Chrome-Binärdatei
  --json                    Maschinenlesbare JSON-Ausgabe auf stdout
  --json-file=<Pfad>        JSON atomar in eine lokale Datei schreiben
  --strict                  Warnungen führen ebenfalls zu Exitcode 1
  --allow-http              HTTP-Eingabe für lokale Prüfungen erlauben
  --allow-private           localhost und private IP-Adressen erlauben
  --help                    Diese Hilfe anzeigen

Sicherheitsgrenze: Das Werkzeug klickt nie, sendet keine Formulare und lädt keine
Dateien hoch. Nicht-GET-Anfragen, externe Requests, Popups und unerwartete
Navigationen werden blockiert und protokolliert.`
}

function positiveInteger(value, optionName) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} benötigt eine positive ganze Zahl.`)
  }
  return parsed
}

function nonNegativeInteger(value, optionName) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${optionName} benötigt eine nicht negative ganze Zahl.`)
  }
  return parsed
}

export function parseArguments(argv) {
  const options = { ...defaultOptions, profiles: [...defaultProfiles] }
  const urls = []

  for (const argument of argv) {
    if (argument === '--help' || argument === '-h') {
      options.help = true
    }
    else if (argument === '--sitemap') {
      options.sitemap = true
    }
    else if (argument === '--json') {
      options.json = true
    }
    else if (argument === '--strict') {
      options.strict = true
    }
    else if (argument.startsWith('--json-file=')) {
      options.json = true
      options.jsonFile = argument.slice('--json-file='.length)
      if (!options.jsonFile) {
        throw new Error('--json-file benötigt einen Pfad.')
      }
    }
    else if (argument === '--allow-http') {
      options.allowHttp = true
    }
    else if (argument === '--allow-private') {
      options.allowPrivate = true
    }
    else if (argument.startsWith('--sitemap-url=')) {
      options.sitemap = true
      options.sitemapUrl = argument.slice('--sitemap-url='.length)
    }
    else if (argument.startsWith('--max-pages=')) {
      options.maxPages = positiveInteger(argument.slice('--max-pages='.length), '--max-pages')
    }
    else if (argument.startsWith('--max-requests=')) {
      options.maxRequests = positiveInteger(argument.slice('--max-requests='.length), '--max-requests')
    }
    else if (argument.startsWith('--timeout=')) {
      options.timeoutMilliseconds = positiveInteger(argument.slice('--timeout='.length), '--timeout')
    }
    else if (argument.startsWith('--settle=')) {
      options.settleMilliseconds = nonNegativeInteger(argument.slice('--settle='.length), '--settle')
    }
    else if (argument.startsWith('--chromium-path=')) {
      options.chromiumPath = argument.slice('--chromium-path='.length)
    }
    else if (argument.startsWith('--profiles=')) {
      const profiles = argument.slice('--profiles='.length).split(',').filter(Boolean)
      const unknown = profiles.find(profile => !profileDefinitions[profile])
      if (profiles.length === 0 || unknown) {
        throw new Error(`--profiles enthält ein unbekanntes Profil: ${unknown || '(leer)'}`)
      }
      options.profiles = [...new Set(profiles)]
    }
    else if (argument.startsWith('-')) {
      throw new Error(`Unbekannte Option: ${argument}`)
    }
    else {
      urls.push(argument)
    }
  }

  if (urls.length > 1) {
    throw new Error('Der Browser-Check prüft genau eine Website pro Lauf.')
  }
  return { options, urls }
}

function chromiumExecutable(configuredPath) {
  const candidates = [
    configuredPath,
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean)
  const executable = candidates.find(candidate => existsSync(candidate))
  if (!executable) {
    throw new Error('Keine Chromium-/Chrome-Binärdatei gefunden. --chromium-path oder CHROMIUM_PATH setzen.')
  }
  return executable
}

function comparableUrl(value) {
  const url = new URL(value)
  url.hash = ''
  return url.href
}

function issueKey(issue) {
  return `${issue.severity}\n${issue.code}\n${issue.url}\n${issue.message}`
}

function addIssue(result, severity, code, message, checklistIds, url, profile) {
  const issue = {
    checklistIds,
    code,
    message,
    profiles: profile ? [profile] : [],
    severity,
    url,
  }
  const key = issueKey(issue)
  const existing = result.issueMap.get(key)
  if (existing) {
    if (profile && !existing.profiles.includes(profile)) {
      existing.profiles.push(profile)
    }
    return
  }
  result.issueMap.set(key, issue)
  result.issues.push(issue)
}

const incompleteBrowserIssueCodes = new Set([
  'beacon-blocked',
  'browser-action-blocked',
  'browser-page-failed',
  'eventsource-blocked',
  'external-request-blocked',
  'external-sitemap-page-skipped',
  'external-sitemap-skipped',
  'form-submission-blocked',
  'invalid-sitemap-page',
  'navigation-skipped-read-only',
  'non-get-blocked',
  'page-limit',
  'page-probe-failed',
  'page-probe-status',
  'popup-blocked',
  'request-limit',
  'sitemap-fetch',
  'sitemap-limit',
  'start-mime',
  'start-status',
  'suspicious-get-blocked',
  'unexpected-navigation-blocked',
  'unsafe-request-blocked',
  'webrtc-blocked',
  'websocket-blocked',
  'webtransport-blocked',
  'worker-blocked',
])

function browserAssertionOutcome(result, failure) {
  if (result.issues.some(failure)) {
    return 'fail'
  }
  if (result.profiles.length === 0 || result.issues.some(issue => incompleteBrowserIssueCodes.has(issue.code))) {
    return 'inconclusive'
  }
  return 'pass'
}

function profilesCoverEveryPage(result, requiredProfiles) {
  const profilesByUrl = new Map()
  for (const profile of result.profiles) {
    const profiles = profilesByUrl.get(profile.url) || new Set()
    profiles.add(profile.profile)
    profilesByUrl.set(profile.url, profiles)
  }
  return profilesByUrl.size > 0
    && [...profilesByUrl.values()].every(profiles => requiredProfiles.every(profile => profiles.has(profile)))
}

function createBrowserAssertions(result) {
  const subject = {
    browserProduct: result.browser?.product,
    browserVersion: result.browser?.version,
    checkedPages: new Set(result.profiles.map(profile => profile.url)).size,
    profileRuns: result.profiles.length,
    profiles: [...new Set(result.profiles.map(profile => profile.profile))],
    url: reportUrl(result.finalUrl || result.requestedUrl).url,
  }
  const assertions = []
  const add = (assertionId, outcome, message) => assertions.push({
    assertionId,
    assertionVersion: 1,
    message,
    outcome,
    subject,
  })

  let outcome = browserAssertionOutcome(result, issue => issue.code === 'main-landmark-count')
  add('browser.document.main-landmark-single', outcome, {
    fail: 'Mindestens ein geprüfter Seiten-/Profil-Lauf besitzt nicht genau ein Main-Landmark.',
    inconclusive: 'Die Landmark-Prüfung ist wegen eines unvollständigen oder sicherheitsbedingt begrenzten Browserlaufs nicht abschließend.',
    pass: 'Alle geprüften Seiten-/Profil-Läufe besitzen genau ein Main-Landmark.',
  }[outcome])

  outcome = browserAssertionOutcome(result, issue => issue.code === 'horizontal-overflow')
  if (outcome === 'pass' && !profilesCoverEveryPage(result, ['narrow', 'zoom-200'])) {
    outcome = 'inconclusive'
  }
  add('browser.viewport.narrow-zoom-no-horizontal-overflow', outcome, {
    fail: 'Mindestens ein geprüfter Viewport weist horizontalen Dokumentüberlauf auf.',
    inconclusive: 'Die Überlaufprüfung ist ohne vollständige schmale und 200-%-Näherungsprofile oder wegen eines begrenzten Browserlaufs nicht abschließend.',
    pass: 'Die schmalen und 200-%-Näherungsprofile weisen auf allen geprüften Seiten keinen horizontalen Dokumentüberlauf auf.',
  }[outcome])

  outcome = browserAssertionOutcome(result, issue => issue.code.startsWith('axe-') && issue.code !== 'axe-runtime')
  if (outcome === 'pass' && result.issues.some(issue => issue.code === 'axe-runtime')) {
    outcome = 'inconclusive'
  }
  add('browser.accessibility.axe-no-detected-violations', outcome, {
    fail: 'Der automatisierte Axe-Audit hat mindestens einen Verstoß auf einer geprüften Seite erkannt.',
    inconclusive: 'Der Axe-Audit konnte nicht für alle vorgesehenen Seiten-/Profil-Läufe belastbar ausgewertet werden.',
    pass: 'Der automatisierte Axe-Audit hat auf den geprüften Seiten-/Profil-Läufen keine Verstöße erkannt.',
  }[outcome])

  const browserContextRecorded = result.profiles.length > 0
    && result.browser?.product === 'Chromium'
    && Boolean(result.browser?.version)
    && result.profiles.every(profile => Boolean(profile.profile) && Boolean(profile.facts?.overflow))
  outcome = browserContextRecorded ? 'pass' : 'inconclusive'
  add('browser.context.chromium-headless-recorded', outcome, {
    inconclusive: 'Browserengine, Version oder ausgeführte Emulationsprofile sind nicht vollständig dokumentiert.',
    pass: 'Chromium-Version und ausgeführte Headless-Emulationsprofile sind dokumentiert.',
  }[outcome])

  outcome = browserAssertionOutcome(result, issue => ['browser-http-error', 'console-error', 'page-error', 'request-failed'].includes(issue.code))
  add('browser.runtime.no-observed-errors', outcome, {
    fail: 'Mindestens ein geprüfter Seiten-/Profil-Lauf erzeugte einen Konsolen-, JavaScript-, Netzwerk- oder HTTP-Fehler.',
    inconclusive: 'Die Laufzeitfehlerprüfung ist wegen eines unvollständigen oder sicherheitsbedingt begrenzten Browserlaufs nicht abschließend.',
    pass: 'In den geprüften Seiten-/Profil-Läufen wurden keine Konsolen-, JavaScript-, Netzwerk- oder HTTP-Fehler beobachtet.',
  }[outcome])

  return assertions
}

function checklistCoverage(result) {
  return evaluatePilotChecklist({
    assertions: result.assertions,
    itemIds: checklistItemIdsForTool('browser-check'),
  })
}

function addBlockedRequest(result, profile, request, reason, code, severity = 'warning') {
  const reported = reportUrl(request.url())
  const entry = {
    method: request.method(),
    parameterNames: reported.parameterNames,
    profile,
    reason,
    resourceType: request.resourceType(),
    url: reported.url,
  }
  const key = JSON.stringify(entry)
  if (!result.blockedRequestKeys.has(key)) {
    result.blockedRequestKeys.add(key)
    result.blockedRequests.push(entry)
  }
  addIssue(result, severity, code, reason, ['CORE-PRIV-02', 'CORE-SEC-07', 'FORM-TEST-04'], reported.url, profile)
}

export function classifyBrowserRequest(details, policy) {
  if (!['http:', 'https:'].includes(details.protocol)) {
    return { action: 'allow' }
  }
  if (details.method !== 'GET') {
    return { action: 'block', code: 'non-get-blocked', reason: `Browser versuchte eine blockierte ${details.method}-Anfrage.`, severity: 'error' }
  }
  if (details.origin !== policy.origin) {
    return { action: 'block', code: 'external-request-blocked', reason: `Externer Browser-Request zu ${details.origin} wurde blockiert.`, severity: 'warning' }
  }

  const concern = readOnlyNavigationConcern(new URL(details.url))
  if (concern) {
    return { action: 'block', code: 'suspicious-get-blocked', reason: `GET-Anfrage wurde wegen ${concern} vorsorglich blockiert.`, severity: 'warning' }
  }
  if (details.mainFrameNavigation && comparableUrl(details.url) !== comparableUrl(policy.expectedUrl)) {
    return { action: 'block', code: 'unexpected-navigation-blocked', reason: 'Unerwartete Hauptfenster-Navigation wurde blockiert.', severity: 'warning' }
  }
  if (details.requestNumber > policy.maxRequests) {
    return { action: 'block', code: 'request-limit', reason: `Request-Limit von ${policy.maxRequests} je Seite und Profil erreicht.`, severity: 'warning' }
  }
  return { action: 'allow' }
}

async function sitemapPages(result, options, origin, defaultSitemapUrl) {
  const sitemapQueue = [options.sitemapUrl || defaultSitemapUrl]
  const seenSitemaps = new Set()
  const pages = []
  const pageKeys = new Set()

  while (sitemapQueue.length > 0 && seenSitemaps.size < options.maxSitemaps) {
    const candidate = sitemapQueue.shift()
    let sitemapUrl
    try {
      sitemapUrl = validateUrl(new URL(candidate, origin).href, options, 'Sitemap-URL')
      if (sitemapUrl.origin !== origin) {
        addIssue(result, 'warning', 'external-sitemap-skipped', `Externe Sitemap ${sitemapUrl.origin} wurde nicht abgerufen.`, ['CORE-SEO-04'], sitemapUrl.href)
        continue
      }
      if (seenSitemaps.has(sitemapUrl.href)) {
        continue
      }
      seenSitemaps.add(sitemapUrl.href)
      const response = await fetchResource(sitemapUrl.href, options, {
        accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
        allowedOrigins: [origin],
        maximumBytes: 5 * 1024 * 1024,
      })
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`)
      }
      const parsed = parseSitemapXml(response.body.toString('utf8'))
      result.sitemaps.push({ finalUrl: response.finalUrl, kind: parsed.kind, locations: parsed.locations.length, url: sitemapUrl.href })
      if (parsed.kind === 'sitemapindex') {
        sitemapQueue.push(...parsed.locations)
      }
      else {
        for (const location of parsed.locations) {
          try {
            const pageUrl = validateUrl(location, options, 'Sitemap-Eintrag')
            if (pageUrl.origin !== origin) {
              addIssue(result, 'warning', 'external-sitemap-page-skipped', `Externer Sitemap-Eintrag ${pageUrl.origin} wurde nicht abgerufen.`, ['CORE-SEO-04'], pageUrl.href)
            }
            else if (!pageKeys.has(pageUrl.href)) {
              pageKeys.add(pageUrl.href)
              pages.push(pageUrl.href)
            }
          }
          catch (error) {
            addIssue(result, 'error', 'invalid-sitemap-page', `Ungültiger Sitemap-Eintrag: ${redactText(error.message)}`, ['CORE-SEO-04'], sitemapUrl.href)
          }
        }
      }
    }
    catch (error) {
      addIssue(result, 'error', 'sitemap-fetch', `Sitemap konnte nicht verarbeitet werden: ${redactText(error.message)}`, ['CORE-SEO-04'], sitemapUrl?.href || String(candidate))
    }
  }

  if (sitemapQueue.length > 0) {
    addIssue(result, 'warning', 'sitemap-limit', `Sitemap-Limit von ${options.maxSitemaps} erreicht.`, ['CORE-SEO-04'], origin)
  }
  return pages
}

async function pageFacts(page) {
  return page.evaluate(() => {
    // Die Funktion muss im serialisierten Browser-Kontext definiert sein.
    // oxlint-disable-next-line unicorn/consistent-function-scoping
    const selectorFor = (element) => {
      if (element.id) {
        return `#${CSS.escape(element.id)}`
      }
      const parts = []
      let current = element
      while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
        const parent = current.parentElement
        const siblings = parent ? [...parent.children].filter(item => item.tagName === current.tagName) : []
        const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : ''
        parts.unshift(`${current.tagName.toLowerCase()}${suffix}`)
        current = parent
      }
      return parts.join(' > ')
    }
    const root = document.documentElement
    const overflowing = [...document.querySelectorAll('body *')]
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.right > root.clientWidth + 1 || rect.left < -1
      })
      .slice(0, 10)
      .map(selectorFor)
    const links = [...document.querySelectorAll('a[href]')].map(link => ({
      download: link.hasAttribute('download'),
      href: link.href,
    }))
    const storage = {
      localStorage: Object.keys(localStorage),
      sessionStorage: Object.keys(sessionStorage),
    }
    return {
      buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"]').length,
      forms: [...document.forms].map(form => ({ action: form.action, method: form.method.toUpperCase() })),
      h1: [...document.querySelectorAll('h1')].map(element => (element.textContent || '').trim()).filter(Boolean),
      lang: root.lang,
      landmarks: {
        main: document.querySelectorAll('main, [role="main"]').length,
        navigation: document.querySelectorAll('nav, [role="navigation"]').length,
      },
      links,
      overflow: {
        clientWidth: root.clientWidth,
        offenders: overflowing,
        scrollWidth: root.scrollWidth,
      },
      storage,
      title: document.title,
    }
  })
}

async function accessibilityAudit(page) {
  await page.evaluate(axe.source)
  return page.evaluate(async () => {
    const report = await globalThis.axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return report.violations.map(violation => ({
      help: violation.help,
      helpUrl: violation.helpUrl,
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 20).map(node => ({ target: node.target })),
      tags: violation.tags,
    }))
  })
}

function recordFactsIssues(result, url, profile, facts, violations, cookies, indexedDatabases) {
  if (!facts.title.trim()) {
    addIssue(result, 'error', 'missing-title', 'Dokument besitzt keinen Titel.', ['CORE-A11Y-02', 'CORE-SEO-01'], url, profile)
  }
  if (!facts.lang.trim()) {
    addIssue(result, 'error', 'missing-language', 'Dokumentsprache fehlt.', ['CORE-A11Y-02'], url, profile)
  }
  if (facts.h1.length !== 1) {
    addIssue(result, 'warning', 'h1-count', `Erwartet wird genau eine H1, gefunden wurden ${facts.h1.length}.`, ['CORE-A11Y-02', 'CORE-SEO-01'], url, profile)
  }
  if (facts.landmarks.main !== 1) {
    addIssue(result, 'warning', 'main-landmark-count', `Erwartet wird genau ein Main-Landmark, gefunden wurden ${facts.landmarks.main}.`, ['CORE-A11Y-01'], url, profile)
  }
  if (facts.overflow.scrollWidth > facts.overflow.clientWidth + 1) {
    addIssue(result, 'error', 'horizontal-overflow', `Horizontaler Overflow: ${facts.overflow.scrollWidth}px Inhalt bei ${facts.overflow.clientWidth}px Viewport.`, ['CORE-A11Y-07', 'CORE-QA-01'], url, profile)
  }
  if (cookies.length > 0) {
    addIssue(result, 'warning', 'cookies-before-interaction', `${cookies.length} Cookie(s) wurden ohne Interaktion gesetzt.`, ['CORE-PRIV-02', 'CORE-PRIV-03'], url, profile)
  }
  const storageCount = facts.storage.localStorage.length + facts.storage.sessionStorage.length + indexedDatabases.length
  if (storageCount > 0) {
    addIssue(result, 'warning', 'storage-before-interaction', `${storageCount} Browser-Speichereintrag/-träge wurden ohne Interaktion angelegt.`, ['CORE-PRIV-02', 'CORE-PRIV-03'], url, profile)
  }
  for (const violation of violations) {
    const severity = ['critical', 'serious'].includes(violation.impact) ? 'error' : 'warning'
    addIssue(result, severity, `axe-${violation.id}`, `${violation.help} (${violation.nodes.length} Fundstelle(n)).`, ['CORE-A11Y-01', 'CORE-A11Y-13'], url, profile)
  }
}

async function inspectProfile(browser, result, options, url, profileName, discoverLinks) {
  const profile = profileDefinitions[profileName]
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const consoleMessages = []
  const pageErrors = []
  const failedRequests = []
  const responses = []
  const blockedActions = []
  const popupUrls = []
  const safeResolutions = new Map()
  let requestNumber = 0

  try {
    await page.setBypassServiceWorker(true)
    await page.setViewport({
      deviceScaleFactor: 1,
      hasTouch: Boolean(profile.mobile),
      height: profile.height,
      isMobile: Boolean(profile.mobile),
      width: profile.width,
    })
    await page.emulateMediaFeatures([
      { name: 'prefers-reduced-motion', value: profile.reducedMotion ? 'reduce' : 'no-preference' },
    ])
    page.setDefaultNavigationTimeout(options.timeoutMilliseconds)
    page.setDefaultTimeout(options.timeoutMilliseconds)
    await page.exposeFunction('websiteQaRecordBlockedAction', (kind, value) => {
      blockedActions.push({ kind: String(kind), url: reportUrl(String(value || url)).url })
    })
    await page.evaluateOnNewDocument(() => {
      // Die Hilfsfunktion muss im serialisierten Browser-Kontext definiert sein.
      // oxlint-disable-next-line unicorn/consistent-function-scoping
      const record = (kind, value) => {
        void globalThis.websiteQaRecordBlockedAction(kind, String(value || location.href))
      }
      globalThis.open = (target) => {
        record('popup', target)
        return null
      }
      navigator.sendBeacon = (target) => {
        record('beacon', target)
        return false
      }
      globalThis.WebSocket = function BlockedWebSocket(target) {
        record('websocket', target)
        throw new DOMException('WebSocket durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
      }
      globalThis.EventSource = function BlockedEventSource(target) {
        record('eventsource', target)
        throw new DOMException('EventSource durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
      }
      globalThis.Worker = function BlockedWorker(target) {
        record('worker', target)
        throw new DOMException('Worker durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
      }
      globalThis.SharedWorker = function BlockedSharedWorker(target) {
        record('shared-worker', target)
        throw new DOMException('SharedWorker durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
      }
      globalThis.RTCPeerConnection = function BlockedRtcPeerConnection() {
        record('webrtc', location.href)
        throw new DOMException('WebRTC durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
      }
      globalThis.webkitRTCPeerConnection = globalThis.RTCPeerConnection
      globalThis.WebTransport = function BlockedWebTransport(target) {
        record('webtransport', target)
        throw new DOMException('WebTransport durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
      }
      const blockForm = (form) => {
        record('form-submit', form.action || location.href)
      }
      HTMLFormElement.prototype.submit = function submit() {
        blockForm(this)
      }
      HTMLFormElement.prototype.requestSubmit = function requestSubmit() {
        blockForm(this)
      }
      document.addEventListener('submit', (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        blockForm(event.target)
      }, true)
    })
    await page.setRequestInterception(true)

    page.on('request', async (request) => {
      requestNumber += 1
      try {
        const requestUrl = new URL(request.url())
        const decision = classifyBrowserRequest({
          mainFrameNavigation: request.isNavigationRequest() && request.frame() === page.mainFrame(),
          method: request.method(),
          origin: requestUrl.origin,
          protocol: requestUrl.protocol,
          requestNumber,
          resourceType: request.resourceType(),
          url: request.url(),
        }, {
          expectedUrl: url,
          maxRequests: options.maxRequests,
          origin: result.origin,
        })
        if (decision.action === 'block') {
          addBlockedRequest(result, profileName, request, decision.reason, decision.code, decision.severity)
          await request.abort('blockedbyclient')
          return
        }
        if (['http:', 'https:'].includes(requestUrl.protocol)) {
          validateUrl(requestUrl.href, options, 'Browser-Request')
          if (!safeResolutions.has(requestUrl.hostname)) {
            safeResolutions.set(requestUrl.hostname, assertPublicResolution(requestUrl, options))
          }
          await safeResolutions.get(requestUrl.hostname)
        }
        await request.continue()
      }
      catch (error) {
        addBlockedRequest(result, profileName, request, `Browser-Request wurde durch die URL-Sicherheitsprüfung blockiert: ${redactText(error.message)}`, 'unsafe-request-blocked', 'error')
        await request.abort('blockedbyclient').catch(() => {})
      }
    })

    page.on('console', (message) => {
      consoleMessages.push({ text: redactText(message.text()), type: message.type() })
    })
    page.on('pageerror', (error) => {
      pageErrors.push(redactText(error.message))
    })
    page.on('requestfailed', (request) => {
      if (!request.failure()?.errorText.includes('ERR_BLOCKED_BY_CLIENT')) {
        failedRequests.push({ error: request.failure()?.errorText || 'Unbekannter Netzwerkfehler', url: reportUrl(request.url()).url })
      }
    })
    page.on('response', (response) => {
      const responseUrl = new URL(response.url())
      if (responseUrl.origin === result.origin && response.status() >= 400) {
        responses.push({ status: response.status(), url: reportUrl(response.url()).url })
      }
    })
    page.on('popup', async (popup) => {
      popupUrls.push(reportUrl(popup.url()).url)
      await popup.close().catch(() => {})
    })

    const navigation = await page.goto(url, { waitUntil: 'domcontentloaded' })
    if (!navigation) {
      throw new Error('Navigation lieferte keine Hauptdokumentantwort.')
    }
    if (options.settleMilliseconds > 0) {
      await new Promise(resolve => setTimeout(resolve, options.settleMilliseconds))
    }

    const facts = await pageFacts(page)
    let violations = []
    try {
      violations = await accessibilityAudit(page)
    }
    catch (error) {
      addIssue(result, 'error', 'axe-runtime', `Accessibility-Audit fehlgeschlagen: ${redactText(error.message)}`, ['CORE-A11Y-13'], url, profileName)
    }
    const cookies = (await context.cookies()).map(cookie => ({
      domain: cookie.domain,
      httpOnly: cookie.httpOnly,
      name: cookie.name,
      sameSite: cookie.sameSite,
      secure: cookie.secure,
    }))
    const indexedDatabases = await page.evaluate(async () => typeof indexedDB.databases === 'function'
      ? (await indexedDB.databases()).map(database => database.name || '(ohne Namen)')
      : [])

    for (const consoleMessage of consoleMessages.filter(item => item.type === 'error')) {
      if (!consoleMessage.text.includes('ERR_BLOCKED_BY_CLIENT')) {
        addIssue(result, 'error', 'console-error', `Browserkonsole: ${consoleMessage.text}`, ['CORE-QA-02', 'CORE-QA-06'], url, profileName)
      }
    }
    for (const error of pageErrors) {
      addIssue(result, 'error', 'page-error', `JavaScript-Fehler: ${error}`, ['CORE-QA-02', 'CORE-QA-06'], url, profileName)
    }
    for (const failure of failedRequests) {
      addIssue(result, 'error', 'request-failed', `Netzwerkfehler ${failure.error}`, ['CORE-QA-02', 'CORE-QA-08'], failure.url, profileName)
    }
    for (const response of responses) {
      addIssue(result, 'error', 'browser-http-error', `Browser-Request antwortete mit HTTP ${response.status}.`, ['CORE-QA-02', 'CORE-QA-08'], response.url, profileName)
    }
    if (popupUrls.length > 0) {
      addIssue(result, 'warning', 'popup-blocked', `${popupUrls.length} automatisch geöffnetes Popup(s) wurde(n) geschlossen.`, ['CORE-PRIV-02', 'CORE-SEC-07'], url, profileName)
    }
    for (const action of blockedActions) {
      const actionDetails = {
        'eventsource': ['warning', 'eventsource-blocked', 'Automatischer EventSource-Verbindungsversuch wurde blockiert.'],
        'form-submit': ['error', 'form-submission-blocked', 'Automatischer Formularversand wurde vor der Netzwerkanfrage blockiert.'],
        'beacon': ['error', 'beacon-blocked', 'Automatischer Beacon-Versand wurde vor der Netzwerkanfrage blockiert.'],
        'popup': ['warning', 'popup-blocked', 'Automatischer Popup-Versuch wurde vor der Navigation blockiert.'],
        'shared-worker': ['warning', 'worker-blocked', 'Automatischer SharedWorker-Start wurde blockiert.'],
        'webrtc': ['warning', 'webrtc-blocked', 'Automatischer WebRTC-Verbindungsversuch wurde blockiert.'],
        'websocket': ['warning', 'websocket-blocked', 'Automatischer WebSocket-Verbindungsversuch wurde blockiert.'],
        'webtransport': ['warning', 'webtransport-blocked', 'Automatischer WebTransport-Verbindungsversuch wurde blockiert.'],
        'worker': ['warning', 'worker-blocked', 'Automatischer Worker-Start wurde blockiert.'],
      }[action.kind] || ['warning', 'browser-action-blocked', `Automatische Browseraktion ${action.kind} wurde blockiert.`]
      addIssue(result, actionDetails[0], actionDetails[1], actionDetails[2], ['CORE-PRIV-02', 'CORE-SEC-07', 'FORM-TEST-04'], action.url, profileName)
    }

    recordFactsIssues(result, url, profileName, facts, violations, cookies, indexedDatabases)
    result.profiles.push({
      accessibilityViolations: violations,
      blockedActions,
      consoleMessages,
      cookies,
      facts,
      indexedDatabases,
      pageErrors,
      popupUrls,
      profile: profileName,
      requests: requestNumber,
      url,
    })
    return discoverLinks ? facts.links : []
  }
  catch (error) {
    addIssue(result, 'error', 'browser-page-failed', `Browserprüfung fehlgeschlagen: ${redactText(error.message)}`, ['CORE-QA-01', 'CORE-QA-02'], url, profileName)
    return []
  }
  finally {
    await context.close().catch(() => {})
  }
}

function likelyNonHtmlLink(url) {
  return /\.(?:avif|bmp|csv|docx?|gif|jpe?g|mp3|mp4|odt|ods|odp|pdf|png|svg|tar|webm|webp|xlsx?|xml|zip)$/i.test(url.pathname)
}

function enqueuePage(queue, queued, result, value, sourceUrl, options) {
  const link = typeof value === 'string' ? { href: value } : value
  let url
  try {
    url = validateUrl(link.href, options, 'Entdecktes Linkziel')
  }
  catch {
    return
  }
  if (link.download || likelyNonHtmlLink(url)) {
    result.nonHtmlLinks.push({ sourceUrl, url: reportUrl(url.href).url })
    return
  }
  if (url.origin !== result.origin || queued.has(url.href)) {
    return
  }
  const concern = readOnlyNavigationConcern(url)
  if (concern) {
    addIssue(result, 'warning', 'navigation-skipped-read-only', `Internes Linkziel wurde wegen ${concern} nicht in den Browser geladen.`, ['CORE-QA-03', 'FORM-TEST-04'], sourceUrl)
    return
  }
  if (queued.size >= options.maxPages * 20) {
    if (!result.omittedPageKeys.has(url.href)) {
      result.omittedPageKeys.add(url.href)
      result.omittedPages += 1
    }
    return
  }
  queued.add(url.href)
  queue.push(url.href)
}

async function probeHtmlCandidate(result, options, candidateUrl, knownResponse) {
  try {
    const response = knownResponse || await fetchResource(candidateUrl, options, {
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      allowedOrigins: [result.origin],
      maximumBytes: 5 * 1024 * 1024,
    })
    const mimeType = normalizeMimeType(response.headers['content-type'])
    if (response.status !== 200) {
      addIssue(result, 'error', 'page-probe-status', `Entdecktes Seitenziel antwortete mit HTTP ${response.status}.`, ['CORE-QA-03', 'CORE-QA-08'], candidateUrl)
      return undefined
    }
    if (!['text/html', 'application/xhtml+xml'].includes(mimeType)) {
      result.nonHtmlLinks.push({ mimeType: mimeType || '(fehlt)', sourceUrl: '(GET-Typprüfung)', url: reportUrl(response.finalUrl).url })
      return undefined
    }
    return validateUrl(response.finalUrl, options, 'Finales Browser-Seitenziel').href
  }
  catch (error) {
    addIssue(result, 'warning', 'page-probe-failed', `Entdecktes Linkziel konnte nicht als HTML geprüft werden: ${redactText(error.message)}`, ['CORE-QA-03', 'CORE-QA-08'], reportUrl(candidateUrl).url)
    return undefined
  }
}

export async function runBrowserCheck(input, suppliedOptions = {}) {
  const options = { ...defaultOptions, ...suppliedOptions, profiles: suppliedOptions.profiles || [...defaultProfiles] }
  const requestedUrl = validateUrl(input, options, 'Eingabe-URL')
  await assertPublicResolution(requestedUrl, options)
  const preflight = await fetchResource(requestedUrl.href, options, {
    accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
    maximumBytes: 5 * 1024 * 1024,
  })
  const finalUrl = validateUrl(preflight.finalUrl, options, 'Finale URL')
  const result = {
    assertions: [],
    blockedRequestKeys: new Set(),
    blockedRequests: [],
    browser: {},
    finalUrl: finalUrl.href,
    issueMap: new Map(),
    issues: [],
    nonHtmlLinks: [],
    omittedPageKeys: new Set(),
    omittedPages: 0,
    origin: finalUrl.origin,
    profiles: [],
    requestedUrl: requestedUrl.href,
    sitemaps: [],
  }
  if (preflight.status !== 200) {
    addIssue(result, 'error', 'start-status', `Startseite antwortete mit HTTP ${preflight.status}.`, ['CORE-QA-01'], finalUrl.href)
  }
  const mimeType = normalizeMimeType(preflight.headers['content-type'])
  if (!['text/html', 'application/xhtml+xml'].includes(mimeType)) {
    addIssue(result, 'error', 'start-mime', `Startseite verwendet MIME-Typ ${mimeType || '(fehlt)'}.`, ['CORE-QA-01'], finalUrl.href)
  }

  const queue = [finalUrl.href]
  const queued = new Set(queue)
  if (options.sitemap) {
    const sitemapUrl = options.sitemapUrl || new URL('/sitemap.xml', finalUrl).href
    for (const pageUrl of await sitemapPages(result, options, result.origin, sitemapUrl)) {
      enqueuePage(queue, queued, result, pageUrl, sitemapUrl, options)
    }
  }

  const executablePath = chromiumExecutable(options.chromiumPath)
  const browser = await puppeteer.launch({
    args: ['--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-sync', '--metrics-recording-only', '--no-first-run'],
    executablePath,
    headless: true,
  })
  try {
    result.browser = {
      executablePath,
      product: 'Chromium',
      version: await browser.version(),
    }
    let candidateIndex = 0
    let htmlPages = 0
    const inspectedPages = new Set()
    while (candidateIndex < queue.length && htmlPages < options.maxPages) {
      const candidateUrl = queue[candidateIndex]
      candidateIndex += 1
      const pageUrl = await probeHtmlCandidate(result, options, candidateUrl, candidateUrl === finalUrl.href ? preflight : undefined)
      if (!pageUrl || inspectedPages.has(pageUrl)) {
        continue
      }
      inspectedPages.add(pageUrl)
      htmlPages += 1
      for (let profileIndex = 0; profileIndex < options.profiles.length; profileIndex += 1) {
        const links = await inspectProfile(browser, result, options, pageUrl, options.profiles[profileIndex], profileIndex === 0)
        if (profileIndex === 0) {
          for (const link of links) {
            enqueuePage(queue, queued, result, link, pageUrl, options)
          }
        }
      }
    }
    const omittedCandidates = result.omittedPages + Math.max(0, queue.length - candidateIndex)
    if (omittedCandidates > 0) {
      addIssue(result, 'warning', 'page-limit', `Seitenlimit von ${options.maxPages} erreicht; mindestens ${omittedCandidates} weitere Linkziele wurden nicht als Browserseite geprüft.`, ['CORE-QA-03'], finalUrl.href)
    }
  }
  finally {
    await browser.close()
  }

  result.assertions = createBrowserAssertions(result)
  delete result.blockedRequestKeys
  delete result.issueMap
  delete result.omittedPageKeys
  return result
}

export function createJsonReport(inputResult, options) {
  const assertionResult = Array.isArray(inputResult.assertions)
    ? inputResult
    : { ...inputResult, assertions: createBrowserAssertions(inputResult) }
  const result = redactReportData(assertionResult, '', { hideHosts: options.allowPrivate })
  const parameterNames = reportUrl(assertionResult.requestedUrl).parameterNames
  if (parameterNames.length > 0) {
    result.requestedUrlParameterNames = parameterNames
  }
  const errors = result.issues.filter(issue => issue.severity === 'error').length
  const warnings = result.issues.filter(issue => issue.severity === 'warning').length
  const pages = new Set(result.profiles.map(profile => profile.url)).size
  return {
    checklistCoverage: checklistCoverage(result),
    generatedAt: new Date().toISOString(),
    options: {
      maxPages: options.maxPages,
      maxRequests: options.maxRequests,
      privateTargetsRedacted: Boolean(options.allowPrivate),
      profiles: options.profiles,
      sitemap: options.sitemap,
      strict: options.strict,
      timeoutMilliseconds: options.timeoutMilliseconds,
    },
    readOnlyGuarantees: {
      buttonsActivated: false,
      externalRequestsAllowed: false,
      fileUploads: false,
      formActionsInvoked: false,
      formsSubmitted: false,
      methodsAllowed: ['GET'],
      persistentBrowserProfile: false,
    },
    result,
    schemaVersion: 1,
    summary: {
      blockedRequests: result.blockedRequests.length,
      errors,
      failed: errors > 0 || (options.strict && warnings > 0),
      pages,
      profileRuns: result.profiles.length,
      warnings,
    },
    tool: 'browser-check',
    toolPackage: { name: packageName, version: packageVersion },
  }
}

function printReport(report) {
  const { result, summary } = report
  console.log(`${packageName} ${packageVersion}`)
  console.log(`\n=== ${result.requestedUrl} ===`)
  console.log(`Browser: ${result.browser.version}`)
  console.log(`Geprüft: ${summary.pages} Seite(n), ${summary.profileRuns} Seiten-/Profil-Läufe.`)
  console.log(`Blockiert: ${summary.blockedRequests} Request(s); kein Button betätigt und kein Formular abgesendet.`)
  for (const issue of result.issues) {
    const marker = issue.severity === 'error' ? 'FEHLER' : 'WARNUNG'
    const profiles = issue.profiles.length > 0 ? ` [${issue.profiles.join(', ')}]` : ''
    console.log(`${marker} [${issue.code}]${profiles} ${issue.url}: ${issue.message}`)
  }
  if (result.issues.length === 0) {
    console.log('OK: Keine Fehler oder Warnungen.')
  }

  const checklistSummary = report.checklistCoverage.summary.checklistItems
  const nonAutomaticSummary = report.checklistCoverage.summary.nonAutomaticCriteria
  console.log(`\nPilot-Checklistennachweis ${report.checklistCoverage.catalog.version}: ${checklistSummary.pass} Punkt(e) vollständig, ${checklistSummary.partial} teilweise, ${checklistSummary.fail} fehlgeschlagen, ${checklistSummary.open + checklistSummary.inconclusive} offen/unklar.`)
  console.log(`Nicht automatisch belegbare Kriterien: ${nonAutomaticSummary.pass} belegt, ${nonAutomaticSummary.total - nonAutomaticSummary.pass - nonAutomaticSummary.notApplicable} offen; sie werden durch diesen Lauf nicht stillschweigend abgeschlossen.`)
  console.log('\nNur lesender Lauf: ausschließlich GET; externe Requests und alle anderen Methoden wurden blockiert; keine Klicks, Uploads oder Formularübermittlungen.')
  console.log(`Ergebnis: ${summary.errors} Fehler, ${summary.warnings} Warnung(en).`)
  console.log(summary.failed ? 'NICHT BESTANDEN.' : 'BESTANDEN.')
}

async function main() {
  let parsed
  try {
    parsed = parseArguments(process.argv.slice(2))
    if (parsed.options.help) {
      console.log(usage())
      return
    }
    if (parsed.urls.length === 0) {
      throw new Error(`Eine URL fehlt.\n\n${usage()}`)
    }
    const result = await runBrowserCheck(parsed.urls[0], parsed.options)
    const report = createJsonReport(result, parsed.options)
    if (parsed.options.json) {
      if (parsed.options.jsonFile) {
        writeJsonOutput(parsed.options.jsonFile, report)
      }
      else {
        console.log(JSON.stringify(report, null, 2))
      }
    }
    else {
      printReport(report)
    }
    process.exitCode = report.summary.failed ? 1 : 0
  }
  catch (error) {
    const errorReport = { error: redactText(error.message), schemaVersion: 1, tool: 'browser-check', toolPackage: { name: packageName, version: packageVersion } }
    if (parsed?.options?.json) {
      if (parsed.options.jsonFile) {
        try {
          writeJsonOutput(parsed.options.jsonFile, errorReport)
        }
        catch (outputError) {
          console.error(`Fehler beim Schreiben des JSON-Berichts: ${redactText(outputError.message)}`)
        }
      }
      else {
        console.log(JSON.stringify(errorReport, null, 2))
      }
    }
    else {
      console.error(`FEHLER: ${redactText(error.message)}`)
    }
    process.exitCode = 2
  }
}

if (isMainModule(import.meta.url)) {
  await main()
}
