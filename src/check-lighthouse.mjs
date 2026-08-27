#!/usr/bin/env node

/* eslint-disable no-console, style/max-statements-per-line */

import { startFlow } from 'lighthouse/core/index.js'
import puppeteer from 'puppeteer-core'
import { chromiumExecutable, classifyBrowserRequest, installReadOnlyDomGuards } from './lib/browser-safety.mjs'
import { assertPublicResolution, chromiumHostResolverRule, fetchResource, redactReportData, redactText, reportUrl, validateUrl } from './lib/http-client.mjs'
import { writeJsonOutput } from './lib/json-output.mjs'
import { isMainModule, packageName, packageVersion } from './lib/package-info.mjs'
import { checklistReference } from './lib/signal-report.mjs'
import { jsonOutputIntent, technicalErrorReport } from './lib/technical-report.mjs'

const categories = ['performance', 'accessibility', 'best-practices', 'seo']
const maxBlockedRecords = 100
const categoryChecklistRefs = {
  'accessibility': ['CORE-A11Y-13'],
  'best-practices': ['CORE-QA-02', 'CORE-SEC-07'],
  'performance': ['CORE-PERF-01'],
  'seo': ['CORE-SEO-01'],
}
const defaultOptions = {
  allowHttp: false,
  allowPrivate: false,
  chromiumPath: undefined,
  maxRedirects: 5,
  maxRequests: 500,
  strict: false,
  timeoutMilliseconds: 45_000,
}

function usage() {
  return `${packageName} ${packageVersion}

Eine feste mobile Lighthouse-Temperaturmessung ausschließlich lesend ausführen.

Aufruf:
  website-qa-lighthouse <URL> [Optionen]

Optionen:
  --max-requests=<Anzahl>   Höchstens so viele Browserrequests (Standard: 500)
  --timeout=<Millisek.>     Gesamtes Laufzeitlimit (Standard: 45000)
  --chromium-path=<Pfad>    Chromium-/Chrome-Binärdatei
  --json                    Maschinenlesbare JSON-Ausgabe auf stdout
  --json-file=<Pfad>        JSON atomar in eine lokale Datei schreiben
  --strict                  Warnungen führen ebenfalls zu Exitcode 1
  --allow-http              HTTP-Eingabe für lokale Prüfungen erlauben
  --allow-private           localhost und private IP-Adressen erlauben
  --help                    Diese Hilfe anzeigen

Der Lauf verwendet die Lighthouse-Kategorien Performance, Accessibility, Best
Practices und SEO. Externe Requests und alle Nicht-GET-Methoden werden blockiert.
Dadurch beeinflusste Messwerte werden als nicht repräsentativ gekennzeichnet.`
}

export function parseArguments(argv) {
  const options = { ...defaultOptions, json: false, jsonFile: undefined }
  const urls = []
  for (const argument of argv) {
    if (argument === '--help') {
      options.help = true
    }
    else if (argument === '--json') {
      options.json = true
    }
    else if (argument === '--strict') {
      options.strict = true
    }
    else if (argument === '--allow-http') {
      options.allowHttp = true
    }
    else if (argument === '--allow-private') {
      options.allowPrivate = true
    }
    else if (argument.startsWith('--json-file=')) {
      options.jsonFile = argument.slice('--json-file='.length)
      options.json = true
      if (!options.jsonFile) {
        throw new TypeError('--json-file benötigt einen Pfad.')
      }
    }
    else if (argument.startsWith('--chromium-path=')) {
      options.chromiumPath = argument.slice('--chromium-path='.length)
    }
    else if (argument.startsWith('--max-requests=')) {
      options.maxRequests = positiveInteger(argument, '--max-requests=')
    }
    else if (argument.startsWith('--timeout=')) {
      options.timeoutMilliseconds = positiveInteger(argument, '--timeout=')
    }
    else if (argument.startsWith('-')) {
      throw new TypeError(`Unbekannte Option: ${argument}`)
    }
    else {
      urls.push(argument)
    }
  }
  if (urls.length > 1) { throw new TypeError('Der Lighthouse-Check prüft genau eine URL pro Lauf.') }
  return { options, urls }
}

function positiveInteger(argument, prefix) {
  const value = Number(argument.slice(prefix.length))
  if (!Number.isSafeInteger(value) || value < 1) { throw new TypeError(`${prefix.slice(0, -1)} benötigt eine positive Ganzzahl.`) }
  return value
}

async function withTimeout(promise, milliseconds) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new TypeError(`Lighthouse-Lauf überschritt ${milliseconds} ms.`)), milliseconds)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

export async function withResourceTimeout(promise, milliseconds, closeResource) {
  try {
    return await withTimeout(promise, milliseconds)
  }
  catch (error) {
    void promise.then(resource => closeResource(resource)).catch(() => {})
    throw error
  }
}

function remainingMilliseconds(deadline, configuredMilliseconds) {
  const remaining = deadline - Date.now()
  if (remaining <= 0) { throw new TypeError(`Lighthouse-Lauf überschritt ${configuredMilliseconds} ms.`) }
  return remaining
}

function safeActionUrl(value, baseUrl) {
  try {
    return reportUrl(new URL(value || baseUrl, baseUrl).href).url
  }
  catch {
    return reportUrl(baseUrl).url
  }
}

function compactLcpDetails(audit) {
  const details = Array.isArray(audit?.details?.items) ? audit.details.items : []
  const breakdownTable = details.find(item => item?.type === 'table'
    && Array.isArray(item.items)
    && item.items.some(row => typeof row?.duration === 'number'))
  const candidate = details.find(item => item?.type === 'node')
  return {
    breakdown: (breakdownTable?.items || []).slice(0, 4).map(row => ({
      durationMilliseconds: Number.isFinite(row.duration) ? row.duration : null,
      label: redactText(row.label || row.subpart || 'LCP-Teilphase', 100),
      subpart: typeof row.subpart === 'string' ? row.subpart : undefined,
    })),
    candidate: candidate
      ? {
          label: candidate.nodeLabel ? redactText(candidate.nodeLabel, 200) : undefined,
          selector: candidate.selector ? redactText(candidate.selector, 500) : undefined,
        }
      : null,
  }
}

export function compactLighthouseResult(lhr) {
  const categoryResults = Object.fromEntries(categories.map((id) => {
    const category = lhr.categories?.[id]
    return [id, {
      score: typeof category?.score === 'number' ? Math.round(category.score * 100) : null,
      title: redactText(category?.title || id, 200),
    }]
  }))
  const auditIds = [...new Set(categories.flatMap(id => lhr.categories?.[id]?.auditRefs?.map(reference => reference.id) || []))]
    .slice(0, 250)
  const audits = auditIds.map((id) => {
    const audit = lhr.audits?.[id] || {}
    return {
      checklistRefs: [...new Set(categories.filter(category => lhr.categories?.[category]?.auditRefs?.some(reference => reference.id === id))
        .flatMap(category => categoryChecklistRefs[category]))],
      displayValue: audit.displayValue ? redactText(audit.displayValue, 200) : undefined,
      errorMessage: audit.errorMessage ? redactText(audit.errorMessage, 300) : undefined,
      id,
      numericUnit: audit.numericUnit,
      numericValue: Number.isFinite(audit.numericValue) ? audit.numericValue : undefined,
      score: typeof audit.score === 'number' ? audit.score : null,
      scoreDisplayMode: audit.scoreDisplayMode,
      status: audit.errorMessage || audit.scoreDisplayMode === 'error'
        ? 'inconclusive'
        : audit.score === 1 || audit.scoreDisplayMode === 'notApplicable'
          ? 'positive'
          : audit.score === 0 && audit.scoreDisplayMode === 'binary'
            ? 'defect'
            : 'observation',
      title: redactText(audit.title || id, 200),
      warnings: Array.isArray(audit.warnings) ? audit.warnings.slice(0, 10).map(warning => redactText(warning, 300)) : [],
    }
  })
  const metricIds = ['first-contentful-paint', 'largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'speed-index', 'interactive', 'total-byte-weight']
  const metrics = Object.fromEntries(metricIds.map((id) => {
    const audit = lhr.audits?.[id]
    return [id, audit && Number.isFinite(audit.numericValue)
      ? { displayValue: audit.displayValue ? redactText(audit.displayValue, 100) : undefined, unit: audit.numericUnit, value: audit.numericValue }
      : null]
  }))
  return {
    audits,
    categories: categoryResults,
    lcp: compactLcpDetails(lhr.audits?.['lcp-breakdown-insight']),
    metrics,
  }
}

export async function runLighthouseCheck(input, suppliedOptions = {}) {
  const configuredOptions = { ...defaultOptions, ...suppliedOptions }
  const deadline = Date.now() + configuredOptions.timeoutMilliseconds
  const options = { ...configuredOptions, deadline }
  const requestedUrl = validateUrl(input, options, 'Eingabe-URL')
  await assertPublicResolution(requestedUrl, options)
  const preflight = await fetchResource(requestedUrl.href, options, {
    accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
    allowedOrigins: [requestedUrl.origin],
    maximumBytes: 5 * 1024 * 1024,
  })
  const finalUrl = validateUrl(preflight.finalUrl, options, 'Finale URL')
  if (finalUrl.origin !== requestedUrl.origin) { throw new TypeError('Lighthouse folgt keinem Originwechsel der Startnavigation.') }
  const executablePath = chromiumExecutable(options.chromiumPath)
  const hostResolverRule = await chromiumHostResolverRule(finalUrl, options)
  let browser
  let context
  let page
  const blockedActions = []
  const blockedRequests = []
  const safeResolutions = new Map()
  let blockedActionCount = 0
  let blockedRequestCount = 0
  let requestNumber = 0
  let interceptionInstalledBeforeNavigation = false
  let guardsInstalledBeforeNavigation = false
  try {
    browser = await withResourceTimeout(puppeteer.launch({
      args: ['--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-quic', '--disable-sync', `--host-resolver-rules=${hostResolverRule}`, '--metrics-recording-only', '--no-first-run'],
      executablePath,
      headless: true,
    }), remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds), lateBrowser => lateBrowser.close())
    context = await withResourceTimeout(browser.createBrowserContext(), remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds), lateContext => lateContext.close())
    page = await withResourceTimeout(context.newPage(), remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds), latePage => latePage.close())
    const browserVersion = await withTimeout(browser.version(), remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds))
    await page.setBypassServiceWorker(true)
    await page.setViewport({ deviceScaleFactor: 2.625, hasTouch: true, height: 823, isMobile: true, width: 412 })
    page.setDefaultNavigationTimeout(remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds))
    page.setDefaultTimeout(remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds))
    await withTimeout(installReadOnlyDomGuards(page, (kind, value) => {
      blockedActionCount += 1
      if (blockedActions.length < maxBlockedRecords) {
        blockedActions.push({ kind, url: safeActionUrl(value, finalUrl.href) })
      }
    }, 'websiteQaLighthouseBlockedAction'), remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds))
    guardsInstalledBeforeNavigation = true
    await withTimeout(page.setRequestInterception(true), remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds))
    interceptionInstalledBeforeNavigation = true
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
        }, { expectedUrl: finalUrl.href, maxRequests: options.maxRequests, origin: finalUrl.origin })
        if (decision.action === 'block') {
          blockedRequestCount += 1
          if (blockedRequests.length < maxBlockedRecords) {
            blockedRequests.push({ code: decision.code, method: request.method(), reason: decision.reason, url: reportUrl(request.url()).url })
          }
          await request.abort('blockedbyclient')
          return
        }
        if (['http:', 'https:'].includes(requestUrl.protocol)) {
          validateUrl(requestUrl.href, options, 'Lighthouse-Browserrequest')
          if (!safeResolutions.has(requestUrl.hostname)) { safeResolutions.set(requestUrl.hostname, assertPublicResolution(requestUrl, options)) }
          await safeResolutions.get(requestUrl.hostname)
        }
        await request.continue()
      }
      catch (error) {
        blockedRequestCount += 1
        if (blockedRequests.length < maxBlockedRecords) {
          blockedRequests.push({ code: 'unsafe-request-blocked', method: request.method(), reason: redactText(error.message), url: reportUrl(request.url()).url })
        }
        await request.abort('blockedbyclient').catch(() => {})
      }
    })
    page.on('popup', async (popup) => {
      blockedActionCount += 1
      if (blockedActions.length < maxBlockedRecords) {
        blockedActions.push({ kind: 'popup', url: reportUrl(popup.url()).url })
      }
      await popup.close().catch(() => {})
    })
    const lighthousePhaseMilliseconds = remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds)
    const flow = await withTimeout(startFlow(page, {
      flags: {
        formFactor: 'mobile',
        maxWaitForFcp: lighthousePhaseMilliseconds,
        maxWaitForLoad: lighthousePhaseMilliseconds,
        onlyCategories: categories,
        output: 'json',
        screenEmulation: { deviceScaleFactor: 2.625, disabled: false, height: 823, mobile: true, width: 412 },
        throttlingMethod: 'simulate',
      },
      name: 'Website-QA Lighthouse mobile navigation',
    }), remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds))
    await withTimeout(flow.navigate(finalUrl.href), remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds))
    const flowResult = await withTimeout(flow.createFlowResult(), remainingMilliseconds(deadline, configuredOptions.timeoutMilliseconds))
    const lhr = flowResult.steps?.[0]?.lhr
    if (!lhr) { throw new TypeError('Lighthouse lieferte kein Navigationsergebnis.') }
    const lighthouse = compactLighthouseResult(lhr)
    const constrained = blockedRequestCount > 0 || blockedActionCount > 0
    const signals = [
      {
        checklistRefs: categories.flatMap(category => categoryChecklistRefs[category]),
        id: 'lighthouse.run.completed',
        message: constrained ? 'Der Lauf wurde ausgeführt, seine Repräsentativität ist durch Sicherheitsblockierungen eingeschränkt.' : 'Der feste mobile Lighthouse-Lauf wurde ohne Sicherheitsblockierung ausgeführt.',
        signalVersion: 1,
        status: constrained ? 'inconclusive' : 'positive',
        subject: { categories, formFactor: 'mobile' },
      },
      ...categories.map(category => ({
        checklistRefs: categoryChecklistRefs[category],
        id: `lighthouse.category.${category}-recorded`,
        message: lighthouse.categories[category].score === null ? `Der ${category}-Score blieb unklar.` : `Der ${category}-Score beträgt ${lighthouse.categories[category].score}.`,
        signalVersion: 1,
        status: lighthouse.categories[category].score === null || constrained ? 'inconclusive' : 'positive',
        subject: { category, score: lighthouse.categories[category].score },
      })),
    ]
    const issues = [
      ...blockedRequests.map(request => ({ checklistRefs: ['CORE-SEC-07'], code: request.code, message: request.reason, severity: request.code === 'non-get-blocked' ? 'error' : 'warning', url: request.url })),
      ...blockedActions.map(action => ({ checklistRefs: ['CORE-SEC-07'], code: `${action.kind}-blocked`, message: `Automatischer ${action.kind}-Versuch wurde vor einer Nebenwirkung blockiert.`, severity: ['beacon', 'form-submit'].includes(action.kind) ? 'error' : 'warning', url: action.url })),
      ...lighthouse.audits.filter(audit => audit.status === 'defect').map(audit => ({ checklistRefs: audit.checklistRefs, code: `lighthouse-${audit.id}`, message: `${audit.title}: Lighthouse meldet einen eindeutigen technischen Defekt.`, severity: 'error' })),
      ...lighthouse.audits.filter(audit => audit.status === 'inconclusive').map(audit => ({ checklistRefs: audit.checklistRefs, code: `lighthouse-${audit.id}-inconclusive`, message: `${audit.title}: ${audit.errorMessage || 'Lighthouse-Audit blieb unklar.'}`, severity: 'warning' })),
      ...lighthouse.audits.filter(audit => audit.warnings.length > 0).map(audit => ({ checklistRefs: audit.checklistRefs, code: `lighthouse-${audit.id}-warning`, message: redactText(`${audit.title}: ${audit.warnings.join(' ')}`, 1000), severity: 'warning' })),
    ]
    return {
      blockedActions,
      blockedRequests,
      browser: { product: 'Chromium', version: browserVersion },
      checklist: checklistReference(),
      coverage: {
        blockedActions: { recorded: blockedActions.length, total: blockedActionCount, truncated: blockedActionCount > blockedActions.length },
        blockedRequests: { recorded: blockedRequests.length, total: blockedRequestCount, truncated: blockedRequestCount > blockedRequests.length },
        categories,
        constrainedBySafetyControls: constrained,
        guardsInstalledBeforeNavigation,
        hostnameResolutionPinned: true,
        interceptionInstalledBeforeNavigation,
        representative: !constrained,
        requestLimit: options.maxRequests,
        requestsObserved: requestNumber,
      },
      finalUrl: reportUrl(finalUrl.href).url,
      generatedAt: new Date().toISOString(),
      issues,
      lighthouse: { ...lighthouse, version: lhr.lighthouseVersion },
      options: {
        formFactor: 'mobile',
        maxRequests: options.maxRequests,
        privateTargetsRedacted: Boolean(options.allowPrivate),
        strict: options.strict,
        timeoutMilliseconds: options.timeoutMilliseconds,
      },
      readOnlyGuarantees: {
        externalRequestsAllowed: false,
        formsSubmitted: false,
        methodsAllowed: ['GET'],
        mutatingActionsInvoked: false,
        persistentBrowserProfile: false,
      },
      requestedUrl: reportUrl(requestedUrl.href).url,
      schemaVersion: 2,
      signals,
      summary: {
        auditDefects: lighthouse.audits.filter(audit => audit.status === 'defect').length,
        auditInconclusive: lighthouse.audits.filter(audit => audit.status === 'inconclusive').length,
        errors: issues.filter(issue => issue.severity === 'error').length,
        failed: issues.some(issue => issue.severity === 'error') || constrained || (options.strict && issues.some(issue => issue.severity === 'warning')),
        warnings: issues.filter(issue => issue.severity === 'warning').length,
      },
      tool: 'lighthouse-check',
      toolPackage: { name: packageName, version: packageVersion },
    }
  }
  finally {
    await page?.close().catch(() => {})
    await context?.close().catch(() => {})
    await browser?.close().catch(() => {})
  }
}

function printReport(report) {
  console.log(`${packageName} ${packageVersion}`)
  console.log(`\n=== ${report.requestedUrl} ===`)
  console.log(`Lighthouse ${report.lighthouse.version}; ${report.browser.version}`)
  console.log(categories.map(id => `${id}=${report.lighthouse.categories[id].score ?? 'unklar'}`).join(', '))
  for (const [id, metric] of Object.entries(report.lighthouse.metrics)) {
    if (metric) { console.log(`${id}: ${metric.displayValue || `${metric.value} ${metric.unit || ''}`}`) }
  }
  console.log(`Technische Audits: ${report.lighthouse.audits.filter(audit => audit.status === 'positive').length} positiv, ${report.summary.auditDefects} Defekt(e), ${report.summary.auditInconclusive} unklar.`)
  if (!report.coverage.representative) { console.log('WARNUNG: Blockierte Requests oder Aktionen beeinflussen die Repräsentativität der Lighthouse-Messung.') }
  for (const issue of report.issues) { console.log(`${issue.severity === 'error' ? 'FEHLER' : 'WARNUNG'} [${issue.code}]: ${issue.message}`) }
  console.log('Checklistenreferenzen dienen nur der manuellen QA-Arbeit und ändern keinen Checklistenstatus.')
  console.log(report.summary.failed ? 'TECHNISCHE DEFEKTE ODER EINSCHRÄNKUNGEN GEFUNDEN.' : 'KEINE TECHNISCHEN DEFEKTE IM BEGRENZTEN LAUF GEFUNDEN.')
}

async function main() {
  const outputIntent = jsonOutputIntent(process.argv.slice(2))
  let parsed
  try {
    parsed = parseArguments(process.argv.slice(2))
    if (parsed.options.help) {
      console.log(usage())
      return
    }
    if (parsed.urls.length === 0) { throw new TypeError(`Eine URL fehlt.\n\n${usage()}`) }
    const report = redactReportData(await runLighthouseCheck(parsed.urls[0], parsed.options), '', { hideHosts: parsed.options.allowPrivate })
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
    const errorReport = technicalErrorReport('lighthouse-check', redactText(error.message))
    if (outputIntent.json || parsed?.options.json) {
      const jsonFile = parsed?.options.jsonFile || outputIntent.jsonFile
      if (jsonFile) {
        try {
          writeJsonOutput(jsonFile, errorReport)
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
      console.error(errorReport.error)
    }
    process.exitCode = 2
  }
}

if (isMainModule(import.meta.url)) { await main() }
