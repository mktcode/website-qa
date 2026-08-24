#!/usr/bin/env node

/* eslint-disable no-console */
/* oxlint-disable no-await-in-loop */

import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { parse } from 'parse5'
import { fetchResource, normalizeMimeType, validateUrl } from './lib/http-client.mjs'
import { isMainModule, packageName, packageVersion } from './lib/package-info.mjs'

const defaultOptions = {
  allowHttp: false,
  allowPrivate: false,
  checkHttpRedirect: true,
  json: false,
  maxHtmlBytes: 5 * 1024 * 1024,
  maxRedirects: 5,
  notFoundPath: '/.well-known/ops-http-check-not-found',
  strict: false,
  timeoutMilliseconds: 15_000,
}

const textMimeTypes = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/json',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/css',
  'text/ecmascript',
  'text/html',
  'text/javascript',
  'text/plain',
  'text/xml',
])

function usage() {
  return `HTTP-Auslieferung öffentlicher Websites prüfen.

Aufruf:
  website-qa-http <URL> [weitere URL ...] [Optionen]

Optionen:
  --json                    Maschinenlesbare JSON-Ausgabe
  --strict                  Warnungen führen ebenfalls zu Exitcode 1
  --timeout=<Millisek.>     Timeout je Abruf (Standard: 15000)
  --max-redirects=<N>       Maximale Anzahl Weiterleitungen (Standard: 5)
  --not-found-path=<Pfad>   Nebenwirkungsfreier unbekannter Pfad
  --skip-http-redirect      Automatische HTTP-zu-HTTPS-Probe auslassen
  --allow-http              HTTP-Eingabe für lokale Prüfungen erlauben
  --allow-private           localhost und private IP-Adressen erlauben
  --help                    Diese Hilfe anzeigen

Geprüft werden Redirects, zentrale Sicherheitsheader, 404-Antworten,
Cacheheader sowie Identity-, Gzip- und Brotli-Auslieferung von HTML und
entdeckten CSS-/JavaScript-Ressourcen. Das Werkzeug verwendet nur GET.`
}

function parsePositiveInteger(value, optionName) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} benötigt eine positive ganze Zahl.`)
  }
  return parsed
}

function parseNotFoundPath(value) {
  if (!value.startsWith('/') || value.startsWith('//')) {
    throw new Error('--not-found-path muss ein absoluter Pfad auf demselben Host sein.')
  }
  const url = new URL(value, 'https://example.invalid')
  if (url.origin !== 'https://example.invalid') {
    throw new Error('--not-found-path darf keinen abweichenden Host enthalten.')
  }
  return `${url.pathname}${url.search}`
}

export function parseArguments(argv) {
  const options = { ...defaultOptions }
  const urls = []

  for (const argument of argv) {
    if (argument === '--help' || argument === '-h') {
      options.help = true
    }
    else if (argument === '--json') {
      options.json = true
    }
    else if (argument === '--strict') {
      options.strict = true
    }
    else if (argument === '--skip-http-redirect') {
      options.checkHttpRedirect = false
    }
    else if (argument === '--allow-http') {
      options.allowHttp = true
    }
    else if (argument === '--allow-private') {
      options.allowPrivate = true
    }
    else if (argument.startsWith('--timeout=')) {
      options.timeoutMilliseconds = parsePositiveInteger(argument.slice('--timeout='.length), '--timeout')
    }
    else if (argument.startsWith('--max-redirects=')) {
      options.maxRedirects = parsePositiveInteger(argument.slice('--max-redirects='.length), '--max-redirects')
    }
    else if (argument.startsWith('--not-found-path=')) {
      options.notFoundPath = parseNotFoundPath(argument.slice('--not-found-path='.length))
    }
    else if (argument.startsWith('-')) {
      throw new Error(`Unbekannte Option: ${argument}`)
    }
    else {
      urls.push(argument)
    }
  }

  return { options, urls }
}

function addIssue(result, severity, code, message, checklistIds = [], url = result.finalUrl || result.requestedUrl) {
  result.issues.push({ checklistIds, code, message, severity, url })
}

function headerSnapshot(headers) {
  const names = [
    'cache-control',
    'content-encoding',
    'content-security-policy',
    'content-type',
    'permissions-policy',
    'referrer-policy',
    'strict-transport-security',
    'vary',
    'x-content-type-options',
    'x-frame-options',
    'x-robots-tag',
  ]
  return Object.fromEntries(names
    .filter(name => headers[name])
    .map(name => [name, headers[name]]))
}

function hasDirective(value, directive) {
  return value?.toLowerCase().split(';').some(part => part.trim().startsWith(directive)) || false
}

function checkSecurityHeaders(result, response, label) {
  const headers = response.headers
  const finalUrl = new URL(response.finalUrl)
  const checklistIds = ['CORE-DOM-08', 'CORE-SEC-04', 'CORE-SEC-05']

  if (finalUrl.protocol === 'https:') {
    const hsts = headers['strict-transport-security']
    if (!hsts) {
      addIssue(result, 'error', 'hsts-missing', `${label}: Strict-Transport-Security fehlt.`, checklistIds, response.finalUrl)
    }
    else {
      const maxAge = Number(hsts.match(/(?:^|;)\s*max-age\s*=\s*(\d+)/i)?.[1])
      if (!Number.isFinite(maxAge)) {
        addIssue(result, 'error', 'hsts-invalid', `${label}: HSTS enthält kein gültiges max-age.`, checklistIds, response.finalUrl)
      }
      else if (maxAge < 15_552_000) {
        addIssue(result, 'warning', 'hsts-short', `${label}: HSTS max-age ist mit ${maxAge} Sekunden kürzer als 180 Tage.`, checklistIds, response.finalUrl)
      }
    }
  }

  if (headers['x-content-type-options']?.toLowerCase() !== 'nosniff') {
    addIssue(result, 'warning', 'nosniff-missing', `${label}: X-Content-Type-Options: nosniff fehlt.`, checklistIds, response.finalUrl)
  }
  if (!headers['referrer-policy']) {
    addIssue(result, 'warning', 'referrer-policy-missing', `${label}: Referrer-Policy fehlt.`, checklistIds, response.finalUrl)
  }
  if (!headers['permissions-policy']) {
    addIssue(result, 'warning', 'permissions-policy-missing', `${label}: Permissions-Policy fehlt.`, checklistIds, response.finalUrl)
  }

  const contentSecurityPolicy = headers['content-security-policy']
  if (!contentSecurityPolicy) {
    addIssue(result, 'warning', 'csp-missing', `${label}: Content-Security-Policy fehlt.`, checklistIds, response.finalUrl)
  }

  const frameAncestors = hasDirective(contentSecurityPolicy, 'frame-ancestors')
  const frameOptions = headers['x-frame-options']?.toLowerCase()
  if (!frameAncestors && !['deny', 'sameorigin'].includes(frameOptions)) {
    addIssue(result, 'warning', 'framing-protection-missing', `${label}: Weder CSP frame-ancestors noch ein wirksames X-Frame-Options schützt vor Framing.`, checklistIds, response.finalUrl)
  }
}

function attribute(node, name) {
  return node.attrs?.find(item => item.name.toLowerCase() === name)?.value
}

function extractHtmlFacts(html, baseUrl) {
  const document = parse(html)
  const resources = []
  const canonicals = []
  const openGraphUrls = []
  const robots = []

  function addResource(type, value) {
    if (!value) {
      return
    }
    try {
      const url = new URL(value, baseUrl)
      url.hash = ''
      if (url.origin === new URL(baseUrl).origin) {
        resources.push({ type, url: url.href })
      }
    }
    catch {
      // Malformed resources belong to the general crawler, not this focused check.
    }
  }

  function visit(node) {
    if (node.tagName === 'link') {
      const relations = (attribute(node, 'rel') || '').toLowerCase().split(/\s+/)
      const href = attribute(node, 'href')
      if (relations.includes('stylesheet')) {
        addResource('css', href)
      }
      if (relations.includes('canonical') && href) {
        canonicals.push(href)
      }
    }
    else if (node.tagName === 'script' && attribute(node, 'src')) {
      addResource('javascript', attribute(node, 'src'))
    }
    else if (node.tagName === 'meta') {
      const key = (attribute(node, 'name') || attribute(node, 'property') || '').toLowerCase()
      const content = attribute(node, 'content') || ''
      if (key === 'robots') {
        robots.push(content)
      }
      else if (key === 'og:url' && content) {
        openGraphUrls.push(content)
      }
    }

    for (const child of node.childNodes || []) {
      visit(child)
    }
  }

  visit(document)
  return {
    canonicals,
    openGraphUrls,
    resources: [...new Map(resources.map(resource => [`${resource.type}:${resource.url}`, resource])).values()],
    robots,
  }
}

function directives(...values) {
  return new Set(values
    .filter(Boolean)
    .flatMap(value => value.toLowerCase().split(/[;,]/))
    .map(value => value.trim())
    .filter(Boolean))
}

function expectedMimeTypes(resourceType) {
  if (resourceType === 'css') {
    return new Set(['text/css'])
  }
  if (resourceType === 'javascript') {
    return new Set(['application/ecmascript', 'application/javascript', 'text/ecmascript', 'text/javascript'])
  }
  return new Set(['application/xhtml+xml', 'text/html'])
}

function checkMimeType(result, response, resourceType, label) {
  const contentType = normalizeMimeType(response.headers['content-type'])
  if (!expectedMimeTypes(resourceType).has(contentType)) {
    addIssue(
      result,
      'error',
      'content-type-unexpected',
      `${label}: ${contentType || 'kein Content-Type'} statt eines erwarteten ${resourceType}-Medientyps.`,
      ['CORE-ERR-03', 'CORE-QA-08'],
      response.finalUrl,
    )
  }
}

function checkCacheHeaders(result, response, resourceType, label) {
  const cacheControl = response.headers['cache-control'] || ''
  if (resourceType === 'not-found') {
    if (/\bpublic\b/i.test(cacheControl) && /\bmax-age\s*=\s*[1-9]\d*/i.test(cacheControl)) {
      addIssue(result, 'warning', 'not-found-public-cache', `${label}: Die 404-Antwort ist ausdrücklich öffentlich cachebar.`, ['CORE-PERF-05'], response.finalUrl)
    }
    return
  }

  if (['css', 'javascript'].includes(resourceType) && !cacheControl) {
    addIssue(result, 'warning', 'asset-cache-control-missing', `${label}: Cache-Control fehlt.`, ['CORE-PERF-05'], response.finalUrl)
  }

  const looksVersioned = /\/(?:_nuxt|assets)\/|[._-][a-f\d]{8,}[._-]/i.test(new URL(response.finalUrl).pathname)
  if (looksVersioned && (!/\bimmutable\b/i.test(cacheControl) || !/\bmax-age\s*=\s*(?:[3-9]\d{7}|\d{9,})/i.test(cacheControl))) {
    addIssue(result, 'warning', 'versioned-asset-cache-short', `${label}: Die versioniert wirkende Ressource besitzt keinen langfristigen unveränderlichen Cache.`, ['CORE-PERF-05'], response.finalUrl)
  }
}

function decodeCompressedBody(response, encoding) {
  if (encoding === 'gzip') {
    return gunzipSync(response.body)
  }
  if (encoding === 'br') {
    return brotliDecompressSync(response.body)
  }
  return response.body
}

async function checkCompression(result, resource, options) {
  const variants = {}
  const request = {
    accept: resource.type === 'html' ? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1' : '*/*',
    maximumBytes: options.maxHtmlBytes,
  }

  for (const encoding of ['identity', 'gzip', 'br']) {
    try {
      const response = await fetchResource(resource.url, options, {
        ...request,
        headers: { 'accept-encoding': encoding },
      })
      variants[encoding] = {
        bytes: response.body.byteLength,
        contentEncoding: response.headers['content-encoding'] || 'identity',
        contentType: normalizeMimeType(response.headers['content-type']),
        finalUrl: response.finalUrl,
        status: response.status,
        vary: response.headers.vary,
      }

      if (response.status < 200 || response.status >= 300) {
        addIssue(result, 'error', 'compression-http-status', `${resource.label}: ${encoding} antwortet mit HTTP ${response.status}.`, ['CORE-PERF-01'], response.finalUrl)
        continue
      }
      if (encoding === 'identity' && response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        addIssue(result, 'error', 'identity-content-encoding', `${resource.label}: Die Identity-Anfrage antwortet mit ${response.headers['content-encoding']}.`, ['CORE-PERF-01'], response.finalUrl)
      }
      if (encoding !== 'identity' && response.headers['content-encoding'] === encoding) {
        try {
          decodeCompressedBody(response, encoding)
        }
        catch (error) {
          addIssue(result, 'error', 'compression-invalid', `${resource.label}: ${encoding} lässt sich nicht dekodieren: ${error.message}`, ['CORE-PERF-01'], response.finalUrl)
        }
      }
    }
    catch (error) {
      addIssue(result, 'error', 'compression-fetch-failed', `${resource.label}: ${encoding} konnte nicht geprüft werden: ${error.message}`, ['CORE-PERF-01'], resource.url)
    }
  }

  const identity = variants.identity
  if (identity && !textMimeTypes.has(identity.contentType)) {
    addIssue(result, 'error', 'compression-non-text-resource', `${resource.label}: ${identity.contentType || 'unbekannter Typ'} ist keine erwartete textbasierte Antwort.`, ['CORE-PERF-01'], resource.url)
  }

  for (const encoding of ['gzip', 'br']) {
    const variant = variants[encoding]
    if (!identity || !variant || identity.bytes < 1024) {
      continue
    }
    if (variant.contentEncoding !== encoding) {
      addIssue(result, 'warning', 'compression-missing', `${resource.label}: ${encoding} wurde für ${identity.bytes} Bytes Identity-Inhalt nicht ausgehandelt.`, ['CORE-PERF-01'], resource.url)
      continue
    }
    if (!(variant.vary || '').toLowerCase().split(',').map(value => value.trim()).includes('accept-encoding')) {
      addIssue(result, 'warning', 'compression-vary-missing', `${resource.label}: ${encoding} antwortet ohne Vary: Accept-Encoding.`, ['CORE-PERF-01'], resource.url)
    }
    if (variant.bytes >= identity.bytes) {
      addIssue(result, 'warning', 'compression-no-reduction', `${resource.label}: ${encoding} reduziert die Übertragungsgröße nicht (${variant.bytes} statt ${identity.bytes} Bytes).`, ['CORE-PERF-01'], resource.url)
    }
  }

  return variants
}

async function checkHttpRedirect(result, finalUrl, options) {
  const expectedUrl = new URL(finalUrl)
  expectedUrl.searchParams.set('__ops_http_check', '1')
  const probeUrl = new URL(expectedUrl)
  probeUrl.protocol = 'http:'

  try {
    const response = await fetchResource(probeUrl.href, { ...options, allowHttp: true }, {
      accept: 'text/html,*/*;q=0.1',
      maximumBytes: options.maxHtmlBytes,
    })
    result.httpRedirect = {
      finalUrl: response.finalUrl,
      redirects: response.redirects,
      requestedUrl: probeUrl.href,
      status: response.status,
    }

    if (response.redirects.length === 0) {
      addIssue(result, 'error', 'http-redirect-missing', 'HTTP leitet nicht auf HTTPS um.', ['CORE-DOM-02', 'CORE-DOM-07'], probeUrl.href)
      return
    }
    if (![301, 308].includes(response.redirects[0].status)) {
      addIssue(result, 'warning', 'http-redirect-temporary', `HTTP verwendet zunächst Status ${response.redirects[0].status} statt einer permanenten Weiterleitung.`, ['CORE-DOM-02'], probeUrl.href)
    }
    if (response.finalUrl !== expectedUrl.href) {
      addIssue(result, 'error', 'http-redirect-target-mismatch', `HTTP endet bei ${response.finalUrl} statt pfad- und queryerhaltend bei ${expectedUrl.href}.`, ['CORE-DOM-02', 'CORE-DOM-07'], probeUrl.href)
    }
    if (response.redirects.length > 1) {
      addIssue(result, 'warning', 'http-redirect-chain', `HTTP benötigt ${response.redirects.length} Weiterleitungen bis zum Ziel.`, ['CORE-DOM-07'], probeUrl.href)
    }
  }
  catch (error) {
    addIssue(result, 'error', 'http-redirect-fetch-failed', `HTTP-Weiterleitung konnte nicht geprüft werden: ${error.message}`, ['CORE-DOM-02'], probeUrl.href)
  }
}

async function checkNotFound(result, finalUrl, options) {
  const notFoundUrl = new URL(options.notFoundPath, finalUrl)
  try {
    const response = await fetchResource(notFoundUrl.href, options, {
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      maximumBytes: options.maxHtmlBytes,
    })
    result.notFound = {
      bytes: response.body.byteLength,
      finalUrl: response.finalUrl,
      headers: headerSnapshot(response.headers),
      redirects: response.redirects,
      status: response.status,
    }

    if (response.status !== 404) {
      addIssue(result, 'error', 'not-found-status', `Der unbekannte Pfad antwortet mit HTTP ${response.status} statt 404.`, ['CORE-ERR-01'], response.finalUrl)
    }
    checkMimeType(result, response, 'html', '404-Antwort')
    checkSecurityHeaders(result, response, '404-Antwort')
    checkCacheHeaders(result, response, 'not-found', '404-Antwort')

    const facts = extractHtmlFacts(response.body.toString('utf8'), response.finalUrl)
    const robotDirectives = directives(response.headers['x-robots-tag'], ...facts.robots)
    if (!robotDirectives.has('noindex')) {
      addIssue(result, 'error', 'not-found-noindex-missing', 'Die 404-Antwort enthält keine noindex-Anweisung.', ['CORE-ERR-02'], response.finalUrl)
    }
    if (facts.canonicals.length > 0 || facts.openGraphUrls.length > 0) {
      addIssue(result, 'warning', 'not-found-url-metadata', 'Die 404-Antwort enthält einen Canonical oder og:url.', ['CORE-ERR-02'], response.finalUrl)
    }
    if (/\b(?:stack trace|node_modules\/|at [\w$.]+ \([^\n]+:\d+:\d+\))/i.test(response.body.toString('utf8'))) {
      addIssue(result, 'error', 'not-found-technical-details', 'Die 404-Antwort enthält mögliche Stack- oder interne Pfaddetails.', ['CORE-ERR-01'], response.finalUrl)
    }
  }
  catch (error) {
    addIssue(result, 'error', 'not-found-fetch-failed', `Die 404-Antwort konnte nicht geprüft werden: ${error.message}`, ['CORE-ERR-01'], notFoundUrl.href)
  }
}

async function inspectTarget(inputUrl, options) {
  const result = {
    issues: [],
    requestedUrl: inputUrl,
    resources: [],
  }

  try {
    const page = await fetchResource(inputUrl, options, {
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      headers: { 'accept-encoding': 'identity' },
      maximumBytes: options.maxHtmlBytes,
    })
    result.finalUrl = page.finalUrl
    result.page = {
      bytes: page.body.byteLength,
      finalUrl: page.finalUrl,
      headers: headerSnapshot(page.headers),
      redirects: page.redirects,
      status: page.status,
    }

    if (page.status < 200 || page.status >= 300) {
      addIssue(result, 'error', 'page-http-status', `Die Zielseite antwortet mit HTTP ${page.status}.`, ['CORE-DOM-01'], page.finalUrl)
      return result
    }
    if (page.redirects.length > 1) {
      addIssue(result, 'warning', 'page-redirect-chain', `Die Zielseite benötigt ${page.redirects.length} Weiterleitungen.`, ['CORE-DOM-07'], inputUrl)
    }
    if (page.redirects.some(redirect => redirect.from.startsWith('https:') && redirect.to.startsWith('http:'))) {
      addIssue(result, 'error', 'page-https-downgrade', 'Die Zielseite leitet von HTTPS auf HTTP um.', ['CORE-DOM-07'], inputUrl)
    }

    checkMimeType(result, page, 'html', 'HTML')
    checkSecurityHeaders(result, page, 'HTML')
    checkCacheHeaders(result, page, 'html', 'HTML')

    const facts = extractHtmlFacts(page.body.toString('utf8'), page.finalUrl)
    const selectedResources = [{ label: 'HTML', type: 'html', url: page.finalUrl }]
    const stylesheet = facts.resources.find(resource => resource.type === 'css')
    const script = facts.resources.find(resource => resource.type === 'javascript')
    if (stylesheet) {
      selectedResources.push({ label: 'CSS', type: stylesheet.type, url: stylesheet.url })
    }
    if (script) {
      selectedResources.push({ label: 'JavaScript', type: script.type, url: script.url })
    }

    for (const resource of selectedResources) {
      const variants = await checkCompression(result, resource, options)
      result.resources.push({ ...resource, variants })

      const identityResponse = await fetchResource(resource.url, options, {
        headers: { 'accept-encoding': 'identity' },
        maximumBytes: options.maxHtmlBytes,
      })
      checkMimeType(result, identityResponse, resource.type, resource.label)
      checkCacheHeaders(result, identityResponse, resource.type, resource.label)
    }

    if (options.checkHttpRedirect && new URL(page.finalUrl).protocol === 'https:') {
      await checkHttpRedirect(result, page.finalUrl, options)
    }
    await checkNotFound(result, page.finalUrl, options)
  }
  catch (error) {
    addIssue(result, 'error', 'page-fetch-failed', `Die Zielseite konnte nicht geprüft werden: ${error.message}`, ['CORE-DOM-01'], inputUrl)
  }

  return result
}

function summarize(results, strict) {
  const issues = results.flatMap(result => result.issues)
  const errors = issues.filter(issue => issue.severity === 'error').length
  const warnings = issues.filter(issue => issue.severity === 'warning').length
  return {
    errors,
    failed: errors > 0 || (strict && warnings > 0),
    targets: results.length,
    warnings,
  }
}

function jsonReport(results, options) {
  return {
    generatedAt: new Date().toISOString(),
    options: {
      checkHttpRedirect: options.checkHttpRedirect,
      maxRedirects: options.maxRedirects,
      notFoundPath: options.notFoundPath,
      strict: options.strict,
      timeoutMilliseconds: options.timeoutMilliseconds,
    },
    results,
    summary: summarize(results, options.strict),
    tool: 'http-check',
    toolPackage: { name: packageName, version: packageVersion },
  }
}

function printText(results, options) {
  console.log(`${packageName} ${packageVersion}`)
  for (const result of results) {
    console.log(`\n=== ${result.requestedUrl} ===`)
    if (result.page) {
      console.log(`HTML: HTTP ${result.page.status}, ${result.page.bytes} Bytes, Ziel ${result.page.finalUrl}`)
    }
    if (result.httpRedirect) {
      console.log(`HTTP→HTTPS: ${result.httpRedirect.redirects.length} Weiterleitung(en), Ziel ${result.httpRedirect.finalUrl}`)
    }
    if (result.notFound) {
      console.log(`404-Probe: HTTP ${result.notFound.status}, ${result.notFound.finalUrl}`)
    }
    for (const resource of result.resources) {
      const variants = ['identity', 'gzip', 'br']
        .map((encoding) => {
          const variant = resource.variants[encoding]
          return variant ? `${encoding}=${variant.bytes} B (${variant.contentEncoding})` : `${encoding}=Fehler`
        })
        .join(', ')
      console.log(`${resource.label}: ${variants}`)
    }
    if (result.issues.length === 0) {
      console.log('OK: Keine Fehler oder Warnungen.')
    }
    else {
      for (const issue of result.issues) {
        const ids = issue.checklistIds.length > 0 ? ` ${issue.checklistIds.join(',')}` : ''
        console.log(`${issue.severity === 'error' ? 'FEHLER' : 'WARNUNG'} [${issue.code}]${ids}: ${issue.message}`)
      }
    }
  }

  const summary = summarize(results, options.strict)
  console.log(`\nErgebnis: ${summary.targets} Ziel(e), ${summary.errors} Fehler, ${summary.warnings} Warnung(en).`)
  if (summary.failed) {
    console.log(options.strict && summary.errors === 0
      ? 'NICHT BESTANDEN: --strict wertet Warnungen als Fehler.'
      : 'NICHT BESTANDEN.')
  }
  else {
    console.log('BESTANDEN.')
  }
}

export async function runHttpCheck(inputUrls, options = {}) {
  const mergedOptions = { ...defaultOptions, ...options }
  const validatedInputs = inputUrls.map(value => validateUrl(value, mergedOptions).href)
  const results = []

  for (const url of new Set(validatedInputs)) {
    results.push(await inspectTarget(url, mergedOptions))
  }

  return {
    options: mergedOptions,
    results,
    summary: summarize(results, mergedOptions.strict),
  }
}

async function main() {
  try {
    const { options, urls } = parseArguments(process.argv.slice(2))
    if (options.help) {
      console.log(usage())
      return
    }
    if (urls.length === 0) {
      throw new Error(`Mindestens eine URL fehlt.\n\n${usage()}`)
    }

    const report = await runHttpCheck(urls, options)
    if (options.json) {
      console.log(JSON.stringify(jsonReport(report.results, options), null, 2))
    }
    else {
      printText(report.results, options)
    }
    if (report.summary.failed) {
      process.exitCode = 1
    }
  }
  catch (error) {
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({
        error: error.message,
        summary: { errors: 1, failed: true, targets: 0, warnings: 0 },
        tool: 'http-check',
      }, null, 2))
    }
    else {
      console.error(`Fehler: ${error.message}`)
    }
    process.exitCode = 2
  }
}

if (isMainModule(import.meta.url)) {
  await main()
}
