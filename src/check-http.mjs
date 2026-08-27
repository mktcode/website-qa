#!/usr/bin/env node

/* eslint-disable no-console */
/* oxlint-disable no-await-in-loop */

import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { parse } from 'parse5'
import { checklistItemIdsForTool, evaluateChecklist } from './lib/checklist-report.mjs'
import { fetchResource, normalizeMimeType, redactReportData, redactText, reportUrl, validateUrl } from './lib/http-client.mjs'
import { writeJsonOutput } from './lib/json-output.mjs'
import { isMainModule, packageName, packageVersion } from './lib/package-info.mjs'

const defaultOptions = {
  allowHttp: false,
  allowPrivate: false,
  checkHttpRedirect: true,
  json: false,
  jsonFile: undefined,
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
  return `${packageName} ${packageVersion}

HTTP-Auslieferung öffentlicher Websites prüfen.

Aufruf:
  website-qa-http <URL> [weitere URL ...] [Optionen]

Optionen:
  --json                    Maschinenlesbare JSON-Ausgabe auf stdout
  --json-file=<Pfad>        JSON atomar in eine lokale Datei schreiben
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
    else if (argument.startsWith('--json-file=')) {
      options.json = true
      options.jsonFile = argument.slice('--json-file='.length)
      if (!options.jsonFile) {
        throw new Error('--json-file benötigt einen Pfad.')
      }
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

function addAssertion(result, assertionId, outcome, message, url, details = {}) {
  result.assertions.push({
    assertionId,
    assertionVersion: 1,
    message,
    outcome,
    subject: {
      ...details,
      url,
    },
  })
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

function directiveValues(value, directive) {
  const matching = value
    ?.toLowerCase()
    .split(';')
    .map(part => part.trim().split(/\s+/).filter(Boolean))
    .find(([name]) => name === directive)
  return matching?.slice(1)
}

function checkSecurityHeaders(result, response, label, documentLike = true) {
  const headers = response.headers
  const finalUrl = new URL(response.finalUrl)
  const checklistIds = ['CORE-DOM-08', 'CORE-ERR-04', 'CORE-SEC-04', 'CORE-SEC-05']
  result.securityHeaderCoverage.checkedResponseClasses.push(label)

  if (finalUrl.protocol === 'https:') {
    const hsts = headers['strict-transport-security']
    if (!hsts) {
      addIssue(result, 'error', 'hsts-missing', `${label}: Strict-Transport-Security fehlt.`, checklistIds, response.finalUrl)
      addAssertion(result, 'http.hsts.present', 'fail', `${label}: HSTS fehlt.`, response.finalUrl, { responseClass: label })
      addAssertion(result, 'http.hsts.max-age-adequate', 'inconclusive', `${label}: max-age ist ohne HSTS nicht prüfbar.`, response.finalUrl, { responseClass: label })
    }
    else {
      addAssertion(result, 'http.hsts.present', 'pass', `${label}: HSTS ist vorhanden.`, response.finalUrl, { responseClass: label })
      const maxAge = Number(hsts.match(/(?:^|;)\s*max-age\s*=\s*(\d+)/i)?.[1])
      if (!Number.isFinite(maxAge)) {
        addIssue(result, 'error', 'hsts-invalid', `${label}: HSTS enthält kein gültiges max-age.`, checklistIds, response.finalUrl)
        addAssertion(result, 'http.hsts.max-age-adequate', 'fail', `${label}: HSTS enthält kein gültiges max-age.`, response.finalUrl, { responseClass: label })
      }
      else if (maxAge < 15_552_000) {
        addIssue(result, 'warning', 'hsts-short', `${label}: HSTS max-age ist mit ${maxAge} Sekunden kürzer als 180 Tage.`, checklistIds, response.finalUrl)
        addAssertion(result, 'http.hsts.max-age-adequate', 'fail', `${label}: HSTS max-age ist kürzer als 180 Tage.`, response.finalUrl, { maxAge, responseClass: label })
      }
      else {
        addAssertion(result, 'http.hsts.max-age-adequate', 'pass', `${label}: HSTS max-age beträgt mindestens 180 Tage.`, response.finalUrl, { maxAge, responseClass: label })
      }
    }
  }
  else {
    addAssertion(result, 'http.hsts.present', 'notApplicable', `${label}: HSTS ist auf der ausdrücklich zugelassenen HTTP-Antwort nicht anwendbar.`, response.finalUrl, { responseClass: label })
    addAssertion(result, 'http.hsts.max-age-adequate', 'notApplicable', `${label}: HSTS max-age ist auf der ausdrücklich zugelassenen HTTP-Antwort nicht anwendbar.`, response.finalUrl, { responseClass: label })
  }

  const nosniff = headers['x-content-type-options']?.trim().toLowerCase() === 'nosniff'
  addAssertion(
    result,
    'http.security.nosniff-valid',
    nosniff ? 'pass' : 'fail',
    nosniff ? `${label}: X-Content-Type-Options ist wirksam als nosniff deklariert.` : `${label}: X-Content-Type-Options: nosniff fehlt oder ist ungültig.`,
    response.finalUrl,
    { responseClass: label },
  )
  if (!nosniff) {
    addIssue(result, 'warning', 'nosniff-missing', `${label}: X-Content-Type-Options: nosniff fehlt.`, checklistIds, response.finalUrl)
  }

  if (!documentLike) {
    return
  }

  const referrerPolicyDeclared = Boolean(headers['referrer-policy']?.trim())
  addAssertion(
    result,
    'http.security.referrer-policy-declared',
    referrerPolicyDeclared ? 'pass' : 'fail',
    referrerPolicyDeclared ? `${label}: Referrer-Policy ist deklariert.` : `${label}: Referrer-Policy fehlt.`,
    response.finalUrl,
    { responseClass: label },
  )
  if (!referrerPolicyDeclared) {
    addIssue(result, 'warning', 'referrer-policy-missing', `${label}: Referrer-Policy fehlt.`, checklistIds, response.finalUrl)
  }

  const permissionsPolicyDeclared = Boolean(headers['permissions-policy']?.trim())
  addAssertion(
    result,
    'http.security.permissions-policy-declared',
    permissionsPolicyDeclared ? 'pass' : 'fail',
    permissionsPolicyDeclared ? `${label}: Permissions-Policy ist deklariert.` : `${label}: Permissions-Policy fehlt.`,
    response.finalUrl,
    { responseClass: label },
  )
  if (!permissionsPolicyDeclared) {
    addIssue(result, 'warning', 'permissions-policy-missing', `${label}: Permissions-Policy fehlt.`, checklistIds, response.finalUrl)
  }

  const contentSecurityPolicy = headers['content-security-policy']?.trim()
  const cspDeclared = Boolean(contentSecurityPolicy)
  addAssertion(
    result,
    'http.security.csp-declared',
    cspDeclared ? 'pass' : 'fail',
    cspDeclared ? `${label}: Content-Security-Policy ist deklariert.` : `${label}: Content-Security-Policy fehlt.`,
    response.finalUrl,
    { responseClass: label },
  )
  if (!cspDeclared) {
    addIssue(result, 'warning', 'csp-missing', `${label}: Content-Security-Policy fehlt.`, checklistIds, response.finalUrl)
  }

  const frameAncestors = directiveValues(contentSecurityPolicy, 'frame-ancestors')
  const frameAncestorsProtects = Boolean(frameAncestors?.length)
    && !(frameAncestors.length === 1 && frameAncestors[0] === '*')
  const frameOptions = headers['x-frame-options']?.trim().toLowerCase()
  const framingProtected = frameAncestorsProtects || ['deny', 'sameorigin'].includes(frameOptions)
  addAssertion(
    result,
    'http.security.framing-protection-present',
    framingProtected ? 'pass' : 'fail',
    framingProtected ? `${label}: CSP frame-ancestors oder X-Frame-Options begrenzt Framing.` : `${label}: Kein wirksamer deklarierter Framing-Schutz erkannt.`,
    response.finalUrl,
    { responseClass: label },
  )
  if (!framingProtected) {
    addIssue(result, 'warning', 'framing-protection-missing', `${label}: Weder CSP frame-ancestors noch ein wirksames X-Frame-Options schützt vor Framing.`, checklistIds, response.finalUrl)
  }
}

function addSecurityHeaderCoverageAssertions(result) {
  const expected = [...new Set(result.securityHeaderCoverage.expectedResponseClasses)]
  const checked = new Set(result.securityHeaderCoverage.checkedResponseClasses)

  function addCoverageAssertion(assertionId, expectedResponseClasses, description) {
    const missing = expectedResponseClasses.filter(responseClass => !checked.has(responseClass))
    addAssertion(
      result,
      assertionId,
      missing.length === 0 ? 'pass' : 'inconclusive',
      missing.length === 0
        ? `${description} wurden vollständig beobachtet.`
        : `${description} konnten nicht vollständig beobachtet werden; offen: ${missing.join(', ')}.`,
      result.finalUrl || result.requestedUrl,
      { checkedResponseClasses: [...checked], expectedResponseClasses },
    )
  }

  addCoverageAssertion(
    'http.security.document-response-coverage-complete',
    expected.filter(responseClass => ['HTML', '404-Antwort'].includes(responseClass)),
    'Die dokumentartigen Sicherheitsheaderantworten',
  )
  addCoverageAssertion(
    'http.security.selected-response-coverage-complete',
    expected,
    'Die ausgewählten Sicherheitsheaderantworten',
  )
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
    const publiclyCacheable = /\bpublic\b/i.test(cacheControl) && /\bmax-age\s*=\s*[1-9]\d*/i.test(cacheControl)
    if (publiclyCacheable) {
      addIssue(result, 'warning', 'not-found-public-cache', `${label}: Die 404-Antwort ist ausdrücklich öffentlich cachebar.`, ['CORE-PERF-05'], response.finalUrl)
    }
    addAssertion(
      result,
      'cache.not-found.not-publicly-cacheable',
      publiclyCacheable ? 'fail' : 'pass',
      publiclyCacheable ? `${label}: 404 ist ausdrücklich öffentlich cachebar.` : `${label}: 404 ist nicht ausdrücklich öffentlich cachebar.`,
      response.finalUrl,
      { responseClass: label },
    )
    return
  }

  if (['css', 'javascript'].includes(resourceType) && !cacheControl) {
    addIssue(result, 'warning', 'asset-cache-control-missing', `${label}: Cache-Control fehlt.`, ['CORE-PERF-05'], response.finalUrl)
  }

  const looksVersioned = /\/(?:_nuxt|assets)\/|[._-][a-f\d]{8,}[._-]/i.test(new URL(response.finalUrl).pathname)
  if (looksVersioned) {
    const immutable = /\bimmutable\b/i.test(cacheControl) && /\bmax-age\s*=\s*(?:[3-9]\d{7}|\d{9,})/i.test(cacheControl)
    if (!immutable) {
      addIssue(result, 'warning', 'versioned-asset-cache-short', `${label}: Die versioniert wirkende Ressource besitzt keinen langfristigen unveränderlichen Cache.`, ['CORE-PERF-05'], response.finalUrl)
    }
    addAssertion(
      result,
      'cache.versioned-asset.immutable',
      immutable ? 'pass' : 'fail',
      immutable ? `${label}: Versioniertes Asset ist langfristig immutable cachebar.` : `${label}: Langfristiges immutable-Caching fehlt.`,
      response.finalUrl,
      { resourceType },
    )
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
        decodable: true,
        finalUrl: response.finalUrl,
        headers: headerSnapshot(response.headers),
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
          variants[encoding].decodable = false
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

  const identityValid = identity
    && identity.status >= 200
    && identity.status < 300
    && identity.contentEncoding === 'identity'
    && textMimeTypes.has(identity.contentType)
  addAssertion(
    result,
    'compression.identity.valid',
    identity ? (identityValid ? 'pass' : 'fail') : 'inconclusive',
    identityValid ? `${resource.label}: Identity-Auslieferung ist gültig.` : `${resource.label}: Identity-Auslieferung ist nicht vollständig gültig.`,
    resource.url,
    { resourceType: resource.type },
  )

  for (const encoding of ['gzip', 'br']) {
    const assertionId = encoding === 'gzip' ? 'compression.gzip.effective' : 'compression.br.effective'
    const variant = variants[encoding]
    let outcome = 'pass'
    let message = `${resource.label}: ${encoding} ist gültig, variiert und reduziert die Übertragungsgröße.`
    if (!identity || !variant) {
      outcome = 'inconclusive'
      message = `${resource.label}: ${encoding} konnte nicht vollständig geprüft werden.`
    }
    else if (identity.bytes < 1024) {
      outcome = 'notApplicable'
      message = `${resource.label}: Für ${identity.bytes} Bytes wird keine Kompression verlangt.`
    }
    else {
      const varies = (variant.vary || '').toLowerCase().split(',').map(value => value.trim()).includes('accept-encoding')
      const effective = variant.status >= 200
        && variant.status < 300
        && variant.contentEncoding === encoding
        && variant.decodable
        && varies
        && variant.bytes < identity.bytes
      if (!effective) {
        outcome = 'fail'
        message = `${resource.label}: ${encoding} ist nicht vollständig gültig, variiert oder größenwirksam.`
      }
    }
    addAssertion(result, assertionId, outcome, message, resource.url, { resourceType: resource.type })
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

    const hasRedirect = response.redirects.length > 0
    const permanent = hasRedirect && [301, 308].includes(response.redirects[0].status)
    const preservesTarget = response.finalUrl === expectedUrl.href
    const direct = response.redirects.length === 1
    addAssertion(result, 'http.redirect.permanent', permanent ? 'pass' : 'fail', permanent ? 'HTTP leitet permanent auf HTTPS.' : 'HTTP leitet nicht permanent auf HTTPS.', probeUrl.href)
    addAssertion(result, 'http.redirect.path-query-preserved', preservesTarget ? 'pass' : 'fail', preservesTarget ? 'Pfad und Query bleiben erhalten.' : 'Pfad oder Query weichen am Weiterleitungsziel ab.', probeUrl.href)
    addAssertion(result, 'http.redirect.chain-direct', direct ? 'pass' : 'fail', direct ? 'HTTP erreicht HTTPS mit genau einer Weiterleitung.' : `HTTP benötigt ${response.redirects.length} Weiterleitungen.`, probeUrl.href)

    if (!hasRedirect) {
      addIssue(result, 'error', 'http-redirect-missing', 'HTTP leitet nicht auf HTTPS um.', ['CORE-DOM-02', 'CORE-DOM-07'], probeUrl.href)
      return
    }
    if (!permanent) {
      addIssue(result, 'warning', 'http-redirect-temporary', `HTTP verwendet zunächst Status ${response.redirects[0].status} statt einer permanenten Weiterleitung.`, ['CORE-DOM-02'], probeUrl.href)
    }
    if (!preservesTarget) {
      addIssue(result, 'error', 'http-redirect-target-mismatch', `HTTP endet bei ${response.finalUrl} statt pfad- und queryerhaltend bei ${expectedUrl.href}.`, ['CORE-DOM-02', 'CORE-DOM-07'], probeUrl.href)
    }
    if (response.redirects.length > 1) {
      addIssue(result, 'warning', 'http-redirect-chain', `HTTP benötigt ${response.redirects.length} Weiterleitungen bis zum Ziel.`, ['CORE-DOM-07'], probeUrl.href)
    }
  }
  catch (error) {
    addIssue(result, 'error', 'http-redirect-fetch-failed', `HTTP-Weiterleitung konnte nicht geprüft werden: ${error.message}`, ['CORE-DOM-02'], probeUrl.href)
    for (const assertionId of ['http.redirect.permanent', 'http.redirect.path-query-preserved', 'http.redirect.chain-direct']) {
      addAssertion(result, assertionId, 'inconclusive', `HTTP-Weiterleitung konnte nicht geprüft werden: ${error.message}`, probeUrl.href)
    }
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

    const hasNotFoundStatus = response.status === 404
    addAssertion(result, 'error.not-found.status-404', hasNotFoundStatus ? 'pass' : 'fail', hasNotFoundStatus ? 'Unbekannter Pfad antwortet mit HTTP 404.' : `Unbekannter Pfad antwortet mit HTTP ${response.status}.`, response.finalUrl)
    if (!hasNotFoundStatus) {
      addIssue(result, 'error', 'not-found-status', `Der unbekannte Pfad antwortet mit HTTP ${response.status} statt 404.`, ['CORE-ERR-01'], response.finalUrl)
    }
    checkMimeType(result, response, 'html', '404-Antwort')
    checkSecurityHeaders(result, response, '404-Antwort')
    checkCacheHeaders(result, response, 'not-found', '404-Antwort')

    const facts = extractHtmlFacts(response.body.toString('utf8'), response.finalUrl)
    const robotDirectives = directives(response.headers['x-robots-tag'], ...facts.robots)
    const hasNoindex = robotDirectives.has('noindex')
    const hasUrlMetadata = facts.canonicals.length > 0 || facts.openGraphUrls.length > 0
    const hasTechnicalDetails = /\b(?:stack trace|node_modules\/|at [\w$.]+ \([^\n]+:\d+:\d+\))/i.test(response.body.toString('utf8'))
    addAssertion(result, 'error.not-found.noindex', hasNoindex ? 'pass' : 'fail', hasNoindex ? '404-Antwort enthält noindex.' : '404-Antwort enthält kein noindex.', response.finalUrl)
    addAssertion(result, 'error.not-found.no-url-metadata', hasUrlMetadata ? 'fail' : 'pass', hasUrlMetadata ? '404-Antwort enthält Canonical oder og:url.' : '404-Antwort enthält weder Canonical noch og:url.', response.finalUrl)
    addAssertion(result, 'error.not-found.no-technical-details', hasTechnicalDetails ? 'fail' : 'pass', hasTechnicalDetails ? '404-Antwort enthält mögliche technische Interna.' : 'Automatische Stichprobe erkennt keine typischen technischen Interna.', response.finalUrl)
    if (!hasNoindex) {
      addIssue(result, 'error', 'not-found-noindex-missing', 'Die 404-Antwort enthält keine noindex-Anweisung.', ['CORE-ERR-02'], response.finalUrl)
    }
    if (hasUrlMetadata) {
      addIssue(result, 'warning', 'not-found-url-metadata', 'Die 404-Antwort enthält einen Canonical oder og:url.', ['CORE-ERR-02'], response.finalUrl)
    }
    if (hasTechnicalDetails) {
      addIssue(result, 'error', 'not-found-technical-details', 'Die 404-Antwort enthält mögliche Stack- oder interne Pfaddetails.', ['CORE-ERR-01'], response.finalUrl)
    }
  }
  catch (error) {
    addIssue(result, 'error', 'not-found-fetch-failed', `Die 404-Antwort konnte nicht geprüft werden: ${error.message}`, ['CORE-ERR-01'], notFoundUrl.href)
    for (const assertionId of ['error.not-found.status-404', 'error.not-found.noindex', 'error.not-found.no-url-metadata', 'error.not-found.no-technical-details', 'cache.not-found.not-publicly-cacheable']) {
      addAssertion(result, assertionId, 'inconclusive', `404-Antwort konnte nicht geprüft werden: ${error.message}`, notFoundUrl.href)
    }
  }
}

async function inspectTarget(inputUrl, options) {
  const result = {
    assertions: [],
    issues: [],
    requestedUrl: inputUrl,
    resources: [],
    securityHeaderCoverage: {
      checkedResponseClasses: [],
      expectedResponseClasses: ['HTML', '404-Antwort'],
    },
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

    const checksHttpsNavigation = new URL(inputUrl).protocol === 'https:'
    const hasHttpsDowngrade = page.redirects.some(redirect => redirect.from.startsWith('https:') && redirect.to.startsWith('http:'))
    const hasDirectChain = page.redirects.length <= 1
    addAssertion(
      result,
      'https.redirect.no-downgrade',
      checksHttpsNavigation ? (hasHttpsDowngrade ? 'fail' : 'pass') : 'notApplicable',
      checksHttpsNavigation ? (hasHttpsDowngrade ? 'Zielnavigation enthält einen HTTPS-Downgrade.' : 'Zielnavigation enthält keinen HTTPS-Downgrade.') : 'Die ausdrücklich zugelassene HTTP-Eingabe ist keine HTTPS-Navigation.',
      inputUrl,
    )
    addAssertion(result, 'https.redirect.chain-direct', hasDirectChain ? 'pass' : 'fail', hasDirectChain ? 'Zielnavigation besitzt keine unnötige Kette.' : `Zielnavigation benötigt ${page.redirects.length} Weiterleitungen.`, inputUrl)

    if (page.status < 200 || page.status >= 300) {
      addIssue(result, 'error', 'page-http-status', `Die Zielseite antwortet mit HTTP ${page.status}.`, ['CORE-DOM-01'], page.finalUrl)
      addSecurityHeaderCoverageAssertions(result)
      return result
    }
    if (!hasDirectChain) {
      addIssue(result, 'warning', 'page-redirect-chain', `Die Zielseite benötigt ${page.redirects.length} Weiterleitungen.`, ['CORE-DOM-07'], inputUrl)
    }
    if (hasHttpsDowngrade) {
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
      result.securityHeaderCoverage.expectedResponseClasses.push('CSS')
    }
    if (script) {
      selectedResources.push({ label: 'JavaScript', type: script.type, url: script.url })
      result.securityHeaderCoverage.expectedResponseClasses.push('JavaScript')
    }

    for (const resource of selectedResources) {
      const variants = await checkCompression(result, resource, options)
      result.resources.push({ ...resource, variants })

      const identity = variants.identity
      if (identity) {
        const identityResponse = { finalUrl: identity.finalUrl, headers: identity.headers }
        checkMimeType(result, identityResponse, resource.type, resource.label)
        checkCacheHeaders(result, identityResponse, resource.type, resource.label)
        if (resource.type !== 'html') {
          checkSecurityHeaders(result, identityResponse, resource.label, false)
        }
      }
    }

    if (options.checkHttpRedirect && new URL(page.finalUrl).protocol === 'https:') {
      await checkHttpRedirect(result, page.finalUrl, options)
    }
    await checkNotFound(result, page.finalUrl, options)
  }
  catch (error) {
    addIssue(result, 'error', 'page-fetch-failed', `Die Zielseite konnte nicht geprüft werden: ${error.message}`, ['CORE-DOM-01'], inputUrl)
    if (!result.page) {
      addAssertion(result, 'https.redirect.no-downgrade', 'inconclusive', `Zielnavigation konnte nicht geprüft werden: ${error.message}`, inputUrl)
      addAssertion(result, 'https.redirect.chain-direct', 'inconclusive', `Zielnavigation konnte nicht geprüft werden: ${error.message}`, inputUrl)
    }
  }

  addSecurityHeaderCoverageAssertions(result)
  return result
}

function checklistCoverage(results) {
  return evaluateChecklist({
    assertions: results.flatMap(result => result.assertions),
    itemIds: checklistItemIdsForTool('http-check'),
  })
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

export function createJsonReport(results, options) {
  const reportedResults = redactReportData(results, '', { hideHosts: options.allowPrivate })
  for (let index = 0; index < reportedResults.length; index += 1) {
    const parameterNames = reportUrl(results[index].requestedUrl).parameterNames
    if (parameterNames.length > 0) {
      reportedResults[index].requestedUrlParameterNames = parameterNames
    }
  }
  return {
    checklistCoverage: checklistCoverage(reportedResults),
    generatedAt: new Date().toISOString(),
    options: {
      checkHttpRedirect: options.checkHttpRedirect,
      maxRedirects: options.maxRedirects,
      notFoundPath: redactReportData(options.notFoundPath, 'notFoundPath'),
      privateTargetsRedacted: Boolean(options.allowPrivate),
      strict: options.strict,
      timeoutMilliseconds: options.timeoutMilliseconds,
    },
    readOnlyGuarantees: {
      methods: ['GET'],
      mutatingActionsInvoked: false,
    },
    results: reportedResults,
    schemaVersion: 1,
    summary: summarize(reportedResults, options.strict),
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

  const coverage = checklistCoverage(results)
  const checklistSummary = coverage.summary.checklistItems
  const nonAutomaticSummary = coverage.summary.nonAutomaticCriteria
  console.log(`\nChecklistennachweis ${coverage.catalog.version}: ${checklistSummary.pass} Punkt(e) vollständig, ${checklistSummary.partial} teilweise, ${checklistSummary.fail} fehlgeschlagen, ${checklistSummary.open + checklistSummary.inconclusive} offen/unklar.`)
  console.log(`Nicht automatisch belegbare Kriterien: ${nonAutomaticSummary.pass} belegt, ${nonAutomaticSummary.total - nonAutomaticSummary.pass - nonAutomaticSummary.notApplicable} offen; sie werden durch diesen Lauf nicht stillschweigend abgeschlossen.`)

  const summary = summarize(results, options.strict)
  console.log(`Ergebnis: ${summary.targets} Ziel(e), ${summary.errors} Fehler, ${summary.warnings} Warnung(en).`)
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
    checklistCoverage: checklistCoverage(results),
    options: mergedOptions,
    results,
    summary: summarize(results, mergedOptions.strict),
  }
}

async function main() {
  let parsed
  try {
    parsed = parseArguments(process.argv.slice(2))
    const { options, urls } = parsed
    if (options.help) {
      console.log(usage())
      return
    }
    if (urls.length === 0) {
      throw new Error(`Mindestens eine URL fehlt.\n\n${usage()}`)
    }

    const report = await runHttpCheck(urls, options)
    if (options.json) {
      const jsonReport = createJsonReport(report.results, options)
      if (options.jsonFile) {
        writeJsonOutput(options.jsonFile, jsonReport)
      }
      else {
        console.log(JSON.stringify(jsonReport, null, 2))
      }
    }
    else {
      printText(redactReportData(report.results, '', { hideHosts: options.allowPrivate }), options)
    }
    if (report.summary.failed) {
      process.exitCode = 1
    }
  }
  catch (error) {
    const errorReport = {
      error: redactText(error.message),
      schemaVersion: 1,
      summary: { errors: 1, failed: true, targets: 0, warnings: 0 },
      tool: 'http-check',
    }
    if (process.argv.includes('--json') || parsed?.options?.json) {
      if (parsed?.options?.jsonFile) {
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
      console.error(`Fehler: ${redactText(error.message)}`)
    }
    process.exitCode = 2
  }
}

if (isMainModule(import.meta.url)) {
  await main()
}
