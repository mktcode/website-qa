#!/usr/bin/env node

/* eslint-disable no-console */
/* oxlint-disable no-await-in-loop */

import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { parse } from 'parse5'
import { checklistItemIdsForTool, evaluatePilotChecklist } from './lib/checklist-report.mjs'
import { fetchResource, normalizeMimeType, redactReportData, redactText, reportUrl, validateUrl } from './lib/http-client.mjs'
import { writeJsonOutput } from './lib/json-output.mjs'
import { isMainModule, packageName, packageVersion } from './lib/package-info.mjs'

const defaultOptions = {
  allowHttp: false,
  allowPrivate: false,
  json: false,
  jsonFile: undefined,
  maxHtmlBytes: 5 * 1024 * 1024,
  maxPages: 50,
  maxRedirects: 5,
  maxResources: 500,
  maxSitemaps: 20,
  sitemap: false,
  sitemapUrl: undefined,
  strict: false,
  timeoutMilliseconds: 15_000,
}

const htmlMimeTypes = new Set(['application/xhtml+xml', 'text/html'])
const xmlMimeTypes = new Set(['application/xml', 'application/xml-sitemap', 'text/xml'])
const ignoredProtocols = new Set(['data:', 'javascript:', 'mailto:', 'tel:'])
const potentiallyMutatingPathSegments = [
  'abmelden',
  'activate',
  'bestätigen',
  'bestaetigen',
  'cancel',
  'checkout',
  'confirm',
  'deactivate',
  'delete',
  'destroy',
  'kündigen',
  'kuendigen',
  'löschen',
  'loeschen',
  'logout',
  'order',
  'purchase',
  'remove',
  'reset',
  'revoke',
  'sign-out',
  'signout',
  'stornieren',
  'unsubscribe',
  'widerrufen',
]
const sensitiveNavigationParameters = new Set([
  'action',
  'auth',
  'code',
  'confirm',
  'delete',
  'remove',
  'token',
  'unsubscribe',
])

function usage() {
  return `Öffentliche Seiten, interne Links und Ressourcen ausschließlich lesend prüfen.

Aufruf:
  website-qa-crawl <URL> [Optionen]

Optionen:
  --sitemap                 /sitemap.xml und enthaltene URLs einbeziehen
  --sitemap-url=<URL>       Abweichende Sitemap-URL verwenden
  --max-pages=<Anzahl>      Höchstens so viele HTML-/Linkziele prüfen (Standard: 50)
  --max-resources=<Anzahl>  Höchstens so viele Seitenressourcen prüfen (Standard: 500)
  --timeout=<Millisek.>     Timeout je GET-Abruf (Standard: 15000)
  --max-redirects=<N>       Maximale Anzahl Weiterleitungen (Standard: 5)
  --json                    Maschinenlesbare JSON-Ausgabe auf stdout
  --json-file=<Pfad>        JSON atomar in eine lokale Datei schreiben
  --strict                  Warnungen führen ebenfalls zu Exitcode 1
  --allow-http              HTTP-Eingabe für lokale Prüfungen erlauben
  --allow-private           localhost und private IP-Adressen erlauben
  --help                    Diese Hilfe anzeigen

Das Werkzeug verwendet ausnahmslos GET. Formulare werden nur inventarisiert;
ihre Actions werden nie aufgerufen. Buttons oder andere Bedienelemente werden
nicht betätigt. Externe Links werden erfasst, aber nicht abgerufen.`
}

function parsePositiveInteger(value, optionName) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} benötigt eine positive ganze Zahl.`)
  }
  return parsed
}

export function parseArguments(argv) {
  const options = { ...defaultOptions }
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
      options.maxPages = parsePositiveInteger(argument.slice('--max-pages='.length), '--max-pages')
    }
    else if (argument.startsWith('--max-resources=')) {
      options.maxResources = parsePositiveInteger(argument.slice('--max-resources='.length), '--max-resources')
    }
    else if (argument.startsWith('--timeout=')) {
      options.timeoutMilliseconds = parsePositiveInteger(argument.slice('--timeout='.length), '--timeout')
    }
    else if (argument.startsWith('--max-redirects=')) {
      options.maxRedirects = parsePositiveInteger(argument.slice('--max-redirects='.length), '--max-redirects')
    }
    else if (argument.startsWith('-')) {
      throw new Error(`Unbekannte Option: ${argument}`)
    }
    else {
      urls.push(argument)
    }
  }

  if (urls.length > 1) {
    throw new Error('Der Crawl prüft genau eine Website pro Lauf.')
  }

  return { options, urls }
}

function addIssue(result, severity, code, message, checklistIds = [], url = result.finalUrl || result.requestedUrl) {
  result.issues.push({ checklistIds, code, message, severity, url })
}

function addAssertion(result, assertionId, outcome, message) {
  result.assertions.push({
    assertionId,
    assertionVersion: 1,
    message,
    outcome,
    subject: {
      checkedPages: result.pages.length,
      checkedResources: result.resources.length,
      checkedSitemaps: result.sitemaps.length,
      skippedNavigations: result.skippedLinks.length,
      url: result.finalUrl || result.requestedUrl,
    },
  })
}

const incompletePageCrawlIssueCodes = new Set([
  'initial-fetch-failed',
  'navigation-skipped-read-only',
  'page-fetch-failed',
  'page-http-status',
  'page-limit-reached',
  'sitemap-page-http-status',
])

function crawlAssertionOutcome(result, failureCodes, dependencyCodes = []) {
  const issueCodes = new Set(result.issues.map(issue => issue.code))
  if (failureCodes.some(code => issueCodes.has(code))) {
    return 'fail'
  }
  if (result.pages.length === 0
    || [...incompletePageCrawlIssueCodes, ...dependencyCodes].some(code => issueCodes.has(code))) {
    return 'inconclusive'
  }
  return 'pass'
}

function resultIssueCodes(result) {
  return new Set(result.issues.map(issue => issue.code))
}

function outcomeFromIssueCodes(result, { failureCodes = [], inconclusiveCodes = [] }) {
  const codes = resultIssueCodes(result)
  if (failureCodes.some(code => codes.has(code))) {
    return 'fail'
  }
  if (inconclusiveCodes.some(code => codes.has(code))) {
    return 'inconclusive'
  }
  return 'pass'
}

function sitemapPageInvalid(page) {
  if (!page.sources.includes('sitemap') || page.status < 200 || page.status >= 300 || page.redirects.length > 0 || !page.indexable || page.canonical.length !== 1) {
    return page.sources.includes('sitemap')
  }
  const canonical = resolveWebUrl(page.canonical[0], page.finalUrl)
  return !canonical || page.canonical[0] !== canonical.href || normalizedComparableUrl(canonical.href) !== normalizedComparableUrl(page.finalUrl)
}

function addExtendedCrawlAssertions(result, options) {
  const incompletePageCodes = [...incompletePageCrawlIssueCodes]
  const sitemapEnabled = Boolean(options.sitemap)
  const sitemapFilesObserved = result.sitemaps.length > 0
  const sitemapPageLocations = result.sitemaps
    .filter(sitemap => sitemap.kind === 'urlset')
    .reduce((sum, sitemap) => sum + sitemap.locations, 0)

  let outcome = sitemapEnabled
    ? outcomeFromIssueCodes(result, {
        failureCodes: ['sitemap-content-type', 'sitemap-http-status', 'sitemap-redirect', 'sitemap-xml-invalid'],
        inconclusiveCodes: ['sitemap-fetch-failed', 'sitemap-limit'],
      })
    : 'inconclusive'
  if (outcome === 'pass' && !sitemapFilesObserved) {
    outcome = 'inconclusive'
  }
  addAssertion(result, 'crawl.sitemap.file-valid', outcome, {
    fail: 'Mindestens eine geprüfte Sitemap ist nicht direkt als erfolgreiche, gültige XML-Antwort mit passendem Medientyp verfügbar.',
    inconclusive: sitemapEnabled
      ? 'Die Sitemap-Dateien konnten nicht vollständig und abschließend geprüft werden.'
      : 'Der Crawl wurde ohne Sitemap-Modus ausgeführt; Sitemap-Dateien wurden nicht geprüft.',
    pass: 'Alle geprüften Sitemap-Dateien sind direkt als erfolgreiche, gültige XML-Antworten mit passendem Medientyp verfügbar.',
  }[outcome])

  outcome = sitemapEnabled
    ? outcomeFromIssueCodes(result, {
        failureCodes: ['robots-http-status', 'robots-sitemap-reference-missing'],
        inconclusiveCodes: ['robots-fetch-failed', 'sitemap-fetch-failed'],
      })
    : 'inconclusive'
  addAssertion(result, 'crawl.sitemap.robots-reference-present', outcome, {
    fail: 'robots.txt ist für den Sitemap-Abgleich technisch abweichend oder referenziert die geprüfte Sitemap nicht.',
    inconclusive: sitemapEnabled
      ? 'Der Sitemap-Verweis in robots.txt konnte nicht abschließend geprüft werden.'
      : 'Der Crawl wurde ohne Sitemap-Modus ausgeführt; der robots.txt-Verweis wurde nicht geprüft.',
    pass: 'robots.txt referenziert die geprüfte Sitemap.',
  }[outcome])

  outcome = sitemapEnabled
    ? outcomeFromIssueCodes(result, {
        failureCodes: ['sitemap-location-duplicate', 'sitemap-location-external', 'sitemap-location-invalid'],
        inconclusiveCodes: ['sitemap-coverage-incomplete', 'sitemap-fetch-failed', 'sitemap-http-status', 'sitemap-limit', 'sitemap-xml-invalid'],
      })
    : 'inconclusive'
  if (outcome === 'pass' && (resultIssueCodes(result).has('indexable-page-not-in-sitemap') || sitemapPageLocations === 0 || result.pages.some(sitemapPageInvalid))) {
    outcome = 'fail'
  }
  addAssertion(result, 'crawl.sitemap.entries-valid', outcome, {
    fail: 'Mindestens ein Sitemap-Eintrag ist ungültig, doppelt, fremd, nicht kanonisch, nicht indexierbar, weitergeleitet oder keine erfolgreiche 200-Seite.',
    inconclusive: sitemapEnabled
      ? 'Die Sitemap-Einträge konnten wegen eines unvollständigen Sitemap- oder Seitenlaufs nicht abschließend geprüft werden.'
      : 'Der Crawl wurde ohne Sitemap-Modus ausgeführt; Sitemap-Einträge wurden nicht geprüft.',
    pass: 'Die geprüfte Sitemap enthält ausschließlich eindeutige, absolute, kanonische, indexierbare 200-URLs des Zielorigins.',
  }[outcome])

  outcome = sitemapEnabled
    ? outcomeFromIssueCodes(result, {
        inconclusiveCodes: ['page-limit-reached', 'sitemap-coverage-incomplete', 'sitemap-fetch-failed', 'sitemap-http-status', 'sitemap-limit', 'sitemap-xml-invalid'],
      })
    : 'inconclusive'
  if (outcome === 'pass' && !sitemapFilesObserved) {
    outcome = 'inconclusive'
  }
  addAssertion(result, 'crawl.sitemap.coverage-complete', outcome, {
    inconclusive: sitemapEnabled
      ? 'Die Sitemap-Abdeckung ist wegen fehlender Dateien, Abruffehlern oder erreichter Limits nicht vollständig.'
      : 'Der Crawl wurde ohne Sitemap-Modus ausgeführt; die Sitemap-Abdeckung wurde nicht geprüft.',
    pass: 'Alle gültig erfassten Sitemap-URLs wurden innerhalb der dokumentierten Limits geprüft.',
  }[outcome])

  outcome = crawlAssertionOutcome(
    result,
    ['internal-fragment-missing', 'page-fetch-failed', 'page-http-status', 'sitemap-page-http-status'],
  )
  addAssertion(result, 'crawl.navigation.internal-valid', outcome, {
    fail: 'Mindestens ein geprüftes internes Seiten- oder Fragmentziel ist nicht erfolgreich erreichbar.',
    inconclusive: 'Interne Seiten- und Fragmentziele konnten wegen eines unvollständigen oder sicherheitsbedingt begrenzten Laufs nicht abschließend geprüft werden.',
    pass: 'Alle geprüften internen Seiten- und Fragmentziele sind erfolgreich erreichbar.',
  }[outcome])

  outcome = crawlAssertionOutcome(
    result,
    ['internal-page-redirect', 'sitemap-page-redirect'],
  )
  addAssertion(result, 'crawl.navigation.internal-direct', outcome, {
    fail: 'Mindestens ein geprüftes internes Seitenziel benötigt eine Weiterleitung.',
    inconclusive: 'Interne Weiterleitungen konnten wegen eines unvollständigen oder sicherheitsbedingt begrenzten Laufs nicht abschließend geprüft werden.',
    pass: 'Alle geprüften internen Seitenziele sind ohne Weiterleitung direkt erreichbar.',
  }[outcome])

  outcome = outcomeFromIssueCodes(result, {
    failureCodes: ['resource-http-status'],
    inconclusiveCodes: [...incompletePageCodes, 'resource-fetch-failed', 'resource-limit-reached'],
  })
  if (outcome === 'pass' && result.resources.length === 0) {
    outcome = 'notApplicable'
  }
  addAssertion(result, 'crawl.resources.status-valid', outcome, {
    fail: 'Mindestens eine geprüfte interne Ressource antwortet nicht erfolgreich.',
    inconclusive: 'Interne Ressourcenstatus konnten wegen eines unvollständigen oder begrenzten Laufs nicht abschließend geprüft werden.',
    notApplicable: 'Im vollständig geprüften Seitenumfang wurden keine gesonderten internen Ressourcen entdeckt.',
    pass: 'Alle geprüften internen Ressourcen antworten erfolgreich.',
  }[outcome])

  outcome = outcomeFromIssueCodes(result, {
    failureCodes: ['resource-content-type'],
    inconclusiveCodes: [...incompletePageCodes, 'resource-fetch-failed', 'resource-http-status', 'resource-limit-reached'],
  })
  if (outcome === 'pass' && result.resources.length === 0) {
    outcome = 'notApplicable'
  }
  addAssertion(result, 'crawl.resources.mime-valid', outcome, {
    fail: 'Mindestens eine geprüfte interne Ressource verwendet keinen zum Einbindungszweck passenden MIME-Typ.',
    inconclusive: 'Die MIME-Typen interner Ressourcen konnten wegen fehlender Antworten oder eines unvollständigen Laufs nicht abschließend geprüft werden.',
    notApplicable: 'Im vollständig geprüften Seitenumfang wurden keine gesonderten internen Ressourcen entdeckt.',
    pass: 'Alle geprüften internen Ressourcen verwenden zum Einbindungszweck passende MIME-Typen.',
  }[outcome])

  const coverageCodes = [
    'initial-fetch-failed',
    'navigation-skipped-read-only',
    'page-fetch-failed',
    'page-limit-reached',
    'resource-fetch-failed',
    'resource-limit-reached',
    ...(sitemapEnabled ? ['sitemap-coverage-incomplete', 'sitemap-fetch-failed', 'sitemap-http-status', 'sitemap-limit', 'sitemap-xml-invalid'] : []),
  ]
  outcome = outcomeFromIssueCodes(result, { inconclusiveCodes: coverageCodes })
  if (outcome === 'pass' && result.pages.length === 0) {
    outcome = 'inconclusive'
  }
  addAssertion(result, 'crawl.run.coverage-complete', outcome, {
    inconclusive: 'Der Crawl ist wegen Abruffehlern, Limits oder sicherheitsbedingt ausgelassenen Navigationen nicht vollständig.',
    pass: 'Der ausschließlich lesende Crawl blieb innerhalb der dokumentierten Seiten-, Ressourcen- und Sitemapgrenzen und musste keine Navigation aus Sicherheitsgründen auslassen.',
  }[outcome])
}

function addCrawlAssertions(result, options) {
  const definitions = [
    {
      failureCodes: ['page-canonical-missing', 'page-canonical-multiple', 'page-canonical-not-absolute'],
      id: 'crawl.canonical.single-absolute',
      messages: {
        fail: 'Mindestens eine geprüfte indexierbare Seite besitzt nicht genau einen absoluten Canonical.',
        inconclusive: 'Die Canonical-Vollständigkeit ist wegen eines unvollständigen Seitenlaufs nicht abschließend prüfbar.',
        pass: 'Alle geprüften indexierbaren Seiten besitzen genau einen absoluten Canonical.',
      },
    },
    {
      dependencyCodes: ['page-canonical-missing', 'page-canonical-multiple', 'page-canonical-not-absolute'],
      failureCodes: ['page-canonical-mismatch'],
      id: 'crawl.canonical.matches-final-url',
      messages: {
        fail: 'Mindestens ein geprüfter Canonical weicht von der finalen Seiten-URL ab.',
        inconclusive: 'Der Canonical-Abgleich ist wegen fehlender, mehrdeutiger oder unvollständig geprüfter Angaben nicht abschließend möglich.',
        pass: 'Alle geprüften Canonicals entsprechen der jeweiligen finalen Seiten-URL.',
      },
    },
    {
      failureCodes: ['page-title-missing'],
      id: 'crawl.metadata.title-present',
      messages: {
        fail: 'Mindestens einer geprüften Seite fehlt der Seitentitel.',
        inconclusive: 'Die Titelprüfung ist wegen eines unvollständigen Seitenlaufs nicht abschließend möglich.',
        pass: 'Alle geprüften Seiten besitzen einen Seitentitel.',
      },
    },
    {
      failureCodes: ['page-description-duplicate', 'page-description-missing'],
      id: 'crawl.metadata.description-single',
      messages: {
        fail: 'Mindestens eine geprüfte Seite besitzt nicht genau eine Meta-Beschreibung.',
        inconclusive: 'Die Prüfung der Meta-Beschreibungen ist wegen eines unvollständigen Seitenlaufs nicht abschließend möglich.',
        pass: 'Alle geprüften Seiten besitzen genau eine Meta-Beschreibung.',
      },
    },
    {
      failureCodes: ['page-description-duplicate-across-pages', 'page-title-duplicate'],
      id: 'crawl.metadata.unique',
      messages: {
        fail: 'Seitentitel oder Meta-Beschreibungen werden auf mehreren geprüften indexierbaren Seiten wiederholt.',
        inconclusive: 'Die Duplikatprüfung ist wegen eines unvollständigen Seitenlaufs nicht abschließend möglich.',
        pass: 'Die geprüften indexierbaren Seiten verwenden eindeutige Titel und Meta-Beschreibungen.',
      },
    },
    {
      failureCodes: ['page-language-missing'],
      id: 'crawl.document.language-present',
      messages: {
        fail: 'Mindestens einer geprüften Seite fehlt das lang-Attribut.',
        inconclusive: 'Die Sprachangaben sind wegen eines unvollständigen Seitenlaufs nicht abschließend prüfbar.',
        pass: 'Alle geprüften Seiten besitzen ein lang-Attribut.',
      },
    },
    {
      failureCodes: ['page-h1-count'],
      id: 'crawl.document.single-h1',
      messages: {
        fail: 'Mindestens eine geprüfte Seite besitzt nicht genau eine H1-Überschrift.',
        inconclusive: 'Die H1-Prüfung ist wegen eines unvollständigen Seitenlaufs nicht abschließend möglich.',
        pass: 'Alle geprüften Seiten besitzen genau eine H1-Überschrift.',
      },
    },
  ]

  for (const definition of definitions) {
    const outcome = crawlAssertionOutcome(result, definition.failureCodes, definition.dependencyCodes)
    addAssertion(result, definition.id, outcome, definition.messages[outcome])
  }
  addExtendedCrawlAssertions(result, options)
}

function normalizedComparableUrl(value) {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.href
  }
  catch {
    return value
  }
}

function attribute(node, name) {
  return node.attrs?.find(item => item.name.toLowerCase() === name)?.value
}

function collectText(node) {
  if (node.nodeName === '#text') {
    return node.value || ''
  }
  return (node.childNodes || []).map(collectText).join('')
}

function resolveWebUrl(value, baseUrl) {
  if (!value) {
    return undefined
  }

  try {
    const url = new URL(value, baseUrl)
    if (ignoredProtocols.has(url.protocol) || !['http:', 'https:'].includes(url.protocol)) {
      return undefined
    }
    if (url.username || url.password) {
      return undefined
    }
    return url
  }
  catch {
    return undefined
  }
}

export function readOnlyNavigationConcern(url) {
  const pathSegments = url.pathname.split('/').filter(Boolean).map(segment => decodeURIComponentSafely(segment).toLowerCase())
  const pathConcern = pathSegments.find(segment => potentiallyMutatingPathSegments.some(keyword => segment === keyword || segment.startsWith(`${keyword}-`) || segment.startsWith(`${keyword}_`)))
  if (pathConcern) {
    return `verdächtiges Pfadsegment ${pathConcern}`
  }
  const parameterConcern = [...url.searchParams.keys()].find(name => sensitiveNavigationParameters.has(name.toLowerCase()))
  if (parameterConcern) {
    return `potenziell zustandsverändernder Query-Parameter ${parameterConcern}`
  }
  return undefined
}

function srcsetUrls(value, baseUrl) {
  if (!value || value.trim().toLowerCase().startsWith('data:')) {
    return []
  }

  return value.split(',')
    .map(candidate => candidate.trim().split(/\s+/)[0])
    .map(candidate => resolveWebUrl(candidate, baseUrl))
    .filter(Boolean)
}

function resourceTypeForPreload(node) {
  const as = (attribute(node, 'as') || '').toLowerCase()
  if (as === 'style') {
    return 'stylesheet'
  }
  if (as === 'script') {
    return 'script'
  }
  if (['font', 'image', 'audio', 'video'].includes(as)) {
    return as
  }
  return 'preload'
}

export function extractHtmlFacts(html, baseUrl) {
  const document = parse(html)
  const facts = {
    anchorNames: new Set(),
    canonicals: [],
    description: [],
    externalLinks: [],
    forms: [],
    h1: [],
    htmlLanguage: '',
    ids: new Set(),
    internalLinks: [],
    metaRefresh: [],
    resources: [],
    robots: [],
    title: '',
  }

  function addNavigation(value) {
    const url = resolveWebUrl(value, baseUrl)
    if (!url) {
      return
    }
    const link = { fragment: url.hash ? decodeURIComponentSafely(url.hash.slice(1)) : '', url: url.href }
    if (url.origin === new URL(baseUrl).origin) {
      facts.internalLinks.push(link)
    }
    else {
      facts.externalLinks.push(url.href)
    }
  }

  function addResource(type, value) {
    const url = resolveWebUrl(value, baseUrl)
    if (url) {
      facts.resources.push({ type, url: url.href })
    }
  }

  function visit(node) {
    const id = attribute(node, 'id')
    if (id) {
      facts.ids.add(id)
    }
    if (node.tagName === 'a') {
      const name = attribute(node, 'name')
      if (name) {
        facts.anchorNames.add(name)
      }
      addNavigation(attribute(node, 'href'))
    }
    else if (node.tagName === 'form') {
      const action = attribute(node, 'action') || baseUrl
      facts.forms.push({
        action: resolveWebUrl(action, baseUrl)?.href || action,
        method: (attribute(node, 'method') || 'get').toUpperCase(),
      })
    }
    else if (node.tagName === 'html') {
      facts.htmlLanguage ||= attribute(node, 'lang')?.trim() || ''
    }
    else if (node.tagName === 'h1') {
      facts.h1.push(collectText(node).replace(/\s+/g, ' ').trim())
    }
    else if (node.tagName === 'title' && !facts.title) {
      facts.title = collectText(node).replace(/\s+/g, ' ').trim()
    }
    else if (node.tagName === 'link') {
      const relations = (attribute(node, 'rel') || '').toLowerCase().split(/\s+/)
      const href = attribute(node, 'href')
      if (relations.includes('canonical') && href) {
        facts.canonicals.push(href.trim())
      }
      if (relations.includes('stylesheet')) {
        addResource('stylesheet', href)
      }
      else if (relations.includes('icon')) {
        addResource('image', href)
      }
      else if (relations.includes('modulepreload')) {
        addResource('script', href)
      }
      else if (relations.includes('preload')) {
        addResource(resourceTypeForPreload(node), href)
      }
    }
    else if (node.tagName === 'script') {
      addResource('script', attribute(node, 'src'))
    }
    else if (node.tagName === 'img') {
      addResource('image', attribute(node, 'src'))
      for (const url of srcsetUrls(attribute(node, 'srcset'), baseUrl)) {
        addResource('image', url.href)
      }
    }
    else if (node.tagName === 'source') {
      addResource(attribute(node, 'type')?.startsWith('audio/') ? 'audio' : attribute(node, 'type')?.startsWith('video/') ? 'video' : 'image', attribute(node, 'src'))
      for (const url of srcsetUrls(attribute(node, 'srcset'), baseUrl)) {
        addResource('image', url.href)
      }
    }
    else if (node.tagName === 'video') {
      addResource('video', attribute(node, 'src'))
      addResource('image', attribute(node, 'poster'))
    }
    else if (node.tagName === 'audio') {
      addResource('audio', attribute(node, 'src'))
    }
    else if (node.tagName === 'iframe') {
      addNavigation(attribute(node, 'src'))
    }
    else if (node.tagName === 'object') {
      addResource('object', attribute(node, 'data'))
    }
    else if (node.tagName === 'meta') {
      const key = (attribute(node, 'name') || attribute(node, 'http-equiv') || '').toLowerCase()
      const content = attribute(node, 'content')?.trim() || ''
      if (key === 'description' && content) {
        facts.description.push(content)
      }
      else if (key === 'robots' && content) {
        facts.robots.push(content)
      }
      else if (key === 'refresh' && content) {
        facts.metaRefresh.push(content)
      }
    }

    for (const child of node.childNodes || []) {
      visit(child)
    }
  }

  visit(document)
  return facts
}

function decodeURIComponentSafely(value) {
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

function robotDirectives(...values) {
  return new Set(values
    .filter(Boolean)
    .flatMap(value => value.toLowerCase().split(/[;,]/))
    .map(value => value.trim())
    .filter(Boolean))
}

function arrayValue(value) {
  if (value === undefined || value === null) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function decodeSafeXmlEntities(value) {
  const namedEntities = {
    amp: '&',
    apos: '\'',
    gt: '>',
    lt: '<',
    quot: '"',
  }
  return value.replace(/&(?:#\d{1,7}|#x[\da-f]{1,6}|amp|apos|gt|lt|quot);/gi, (entity) => {
    const token = entity.slice(1, -1).toLowerCase()
    if (namedEntities[token]) {
      return namedEntities[token]
    }
    const codePoint = token.startsWith('#x')
      ? Number.parseInt(token.slice(2), 16)
      : Number.parseInt(token.slice(1), 10)
    if (!Number.isInteger(codePoint) || codePoint < 1 || codePoint > 0x10FFFF || (codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
      return entity
    }
    return String.fromCodePoint(codePoint)
  })
}

function xmlText(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return decodeSafeXmlEntities(String(value).trim())
  }
  return typeof value?.['#text'] === 'string' ? decodeSafeXmlEntities(value['#text'].trim()) : ''
}

export function parseSitemapXml(xml) {
  const validation = XMLValidator.validate(xml, { allowBooleanAttributes: false })
  if (validation !== true) {
    const line = validation.err?.line ? ` in Zeile ${validation.err.line}` : ''
    throw new Error(`Ungültiges Sitemap-XML${line}: ${validation.err?.msg || 'unbekannter XML-Fehler'}`)
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: false,
    trimValues: true,
  })
  const parsed = parser.parse(xml)

  if (parsed.urlset) {
    return {
      kind: 'urlset',
      locations: arrayValue(parsed.urlset.url).map(entry => xmlText(entry?.loc)).filter(Boolean),
    }
  }
  if (parsed.sitemapindex) {
    return {
      kind: 'index',
      locations: arrayValue(parsed.sitemapindex.sitemap).map(entry => xmlText(entry?.loc)).filter(Boolean),
    }
  }
  throw new Error('Sitemap enthält weder urlset noch sitemapindex als Wurzelelement.')
}

function expectedMimeType(type, contentType) {
  if (type === 'stylesheet') {
    return contentType === 'text/css'
  }
  if (type === 'script') {
    return new Set(['application/ecmascript', 'application/javascript', 'text/ecmascript', 'text/javascript']).has(contentType)
  }
  if (type === 'image') {
    return contentType?.startsWith('image/')
  }
  if (type === 'font') {
    return contentType?.startsWith('font/') || new Set(['application/font-woff', 'application/font-woff2', 'application/octet-stream', 'application/vnd.ms-fontobject']).has(contentType)
  }
  if (type === 'audio') {
    return contentType?.startsWith('audio/')
  }
  if (type === 'video') {
    return contentType?.startsWith('video/')
  }
  return true
}

function inferredCssResourceType(url) {
  const extension = new URL(url).pathname.toLowerCase().match(/\.([a-z\d]+)$/)?.[1]
  if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(extension)) {
    return 'font'
  }
  if (['avif', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'webp'].includes(extension)) {
    return 'image'
  }
  return 'css-reference'
}

function extractCssResources(css, baseUrl) {
  const resources = []
  const pattern = /url\(([^)]*)\)/gi
  for (const match of css.matchAll(pattern)) {
    let value = match[1]?.trim()
    if (value && ['\'', '"'].includes(value[0]) && value.at(-1) === value[0]) {
      value = value.slice(1, -1).trim()
    }
    if (!value || value.toLowerCase().startsWith('data:')) {
      continue
    }
    const url = resolveWebUrl(value, baseUrl)
    if (url) {
      resources.push({ type: inferredCssResourceType(url.href), url: url.href })
    }
  }
  return resources
}

function resourceAccept(types) {
  if (types.has('image')) {
    return 'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.8,*/*;q=0.1'
  }
  if (types.has('stylesheet')) {
    return 'text/css,*/*;q=0.1'
  }
  if (types.has('script')) {
    return 'text/javascript,application/javascript,*/*;q=0.1'
  }
  if (types.has('font')) {
    return 'font/woff2,font/woff,application/octet-stream,*/*;q=0.1'
  }
  return '*/*'
}

function snapshotPage(response, entry, facts) {
  const directives = robotDirectives(response.headers['x-robots-tag'], ...facts.robots)
  return {
    bytes: response.body.byteLength,
    canonical: facts.canonicals,
    description: facts.description,
    finalUrl: response.finalUrl,
    h1: facts.h1,
    htmlLanguage: facts.htmlLanguage,
    indexable: !directives.has('noindex'),
    redirects: response.redirects,
    requestedUrl: entry.url,
    robots: [...directives],
    sources: [...entry.sources],
    status: response.status,
    title: facts.title,
  }
}

function checkPageMetadata(result, page, facts) {
  const url = page.finalUrl
  if (!facts.title) {
    addIssue(result, 'error', 'page-title-missing', 'Seitentitel fehlt.', ['CORE-SEO-01'], url)
  }
  if (facts.description.length === 0) {
    addIssue(result, 'warning', 'page-description-missing', 'Meta-Beschreibung fehlt.', ['CORE-SEO-01'], url)
  }
  else if (facts.description.length > 1) {
    addIssue(result, 'warning', 'page-description-duplicate', 'Mehrere Meta-Beschreibungen sind vorhanden.', ['CORE-SEO-01'], url)
  }
  if (!facts.htmlLanguage) {
    addIssue(result, 'error', 'page-language-missing', 'Das html-Element besitzt kein lang-Attribut.', ['CORE-SEO-02'], url)
  }
  if (facts.h1.length !== 1) {
    addIssue(result, 'warning', 'page-h1-count', `Die Seite besitzt ${facts.h1.length} H1-Überschriften statt genau einer.`, ['CORE-SEO-02'], url)
  }
  if (facts.metaRefresh.length > 0) {
    addIssue(result, 'warning', 'page-meta-refresh', 'Die Seite verwendet eine Meta-Refresh-Weiterleitung.', ['CORE-DOM-07'], url)
  }

  if (page.indexable) {
    if (facts.canonicals.length === 0) {
      addIssue(result, 'error', 'page-canonical-missing', 'Auf der indexierbaren Seite fehlt ein Canonical.', ['CORE-DOM-05'], url)
    }
    else if (facts.canonicals.length > 1) {
      addIssue(result, 'error', 'page-canonical-multiple', `Die Seite besitzt ${facts.canonicals.length} Canonicals.`, ['CORE-DOM-05'], url)
    }
  }

  for (const canonical of facts.canonicals) {
    const resolved = resolveWebUrl(canonical, url)
    if (!resolved || canonical !== resolved.href) {
      addIssue(result, 'error', 'page-canonical-not-absolute', `Canonical ist keine absolute HTTP-/HTTPS-URL: ${canonical}`, ['CORE-DOM-05'], url)
      continue
    }
    if (normalizedComparableUrl(resolved.href) !== normalizedComparableUrl(url)) {
      addIssue(result, 'error', 'page-canonical-mismatch', `Canonical ${resolved.href} weicht von der finalen URL ${url} ab.`, ['CORE-DOM-05', 'CORE-DOM-06'], url)
    }
  }
}

function addExternalLink(result, sourceUrl, targetUrl) {
  const key = `${sourceUrl}\n${targetUrl}`
  if (!result.externalLinkKeys.has(key)) {
    result.externalLinkKeys.add(key)
    result.externalLinks.push({ sourceUrl, targetUrl })
  }
}

function enqueueResource(state, value, type, sourceUrl) {
  const url = resolveWebUrl(value, sourceUrl)
  if (!url) {
    return
  }
  if (url.origin !== state.origin) {
    addExternalLink(state.result, sourceUrl, url.href)
    return
  }
  url.hash = ''

  let entry = state.resourceEntries.get(url.href)
  if (!entry) {
    if (state.resourceEntries.size >= state.options.maxResources) {
      state.resourceLimitReached = true
      return
    }
    entry = { sources: new Set(), types: new Set(), url: url.href }
    state.resourceEntries.set(url.href, entry)
    state.resourceQueue.push(entry)
  }
  entry.sources.add(sourceUrl)
  entry.types.add(type)
}

function enqueuePage(state, value, source, linkSourceUrl) {
  const url = resolveWebUrl(value, linkSourceUrl || state.finalUrl)
  if (!url) {
    return
  }
  if (url.origin !== state.origin) {
    if (linkSourceUrl) {
      addExternalLink(state.result, linkSourceUrl, url.href)
    }
    return
  }

  if (source === 'internal-link') {
    const concern = readOnlyNavigationConcern(url)
    if (concern) {
      const key = `${linkSourceUrl}\n${url.href}`
      if (!state.skippedLinkKeys.has(key)) {
        state.skippedLinkKeys.add(key)
        state.result.skippedLinks.push({ reason: concern, sourceUrl: linkSourceUrl, targetUrl: url.href })
        addIssue(state.result, 'warning', 'navigation-skipped-read-only', `Internes Linkziel wurde wegen ${concern} nicht abgerufen.`, ['CORE-SEO-04', 'FORM-TEST-04'], linkSourceUrl)
      }
      return
    }
  }

  const fragment = url.hash ? decodeURIComponentSafely(url.hash.slice(1)) : ''
  url.hash = ''
  if (fragment && linkSourceUrl) {
    state.fragmentLinks.push({ fragment, sourceUrl: linkSourceUrl, targetUrl: url.href })
  }

  let entry = state.pageEntries.get(url.href)
  if (!entry) {
    if (state.pageEntries.size >= state.options.maxPages) {
      state.pageLimitReached = true
      return
    }
    entry = { sources: new Set(), url: url.href }
    state.pageEntries.set(url.href, entry)
    state.pageQueue.push(entry)
  }
  entry.sources.add(source)
}

async function fetchSitemaps(state) {
  const initialUrl = state.options.sitemapUrl
    ? validateUrl(state.options.sitemapUrl, state.options, 'Sitemap-URL').href
    : new URL('/sitemap.xml', state.finalUrl).href
  const queue = [initialUrl]
  const visited = new Set()
  const allLocations = []

  while (queue.length > 0 && visited.size < state.options.maxSitemaps) {
    const sitemapUrl = queue.shift()
    if (visited.has(sitemapUrl)) {
      continue
    }
    visited.add(sitemapUrl)

    try {
      const response = await fetchResource(sitemapUrl, state.options, {
        accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
        allowedOrigins: [state.origin],
        headers: { 'accept-encoding': 'identity' },
        maximumBytes: state.options.maxHtmlBytes,
      })
      const sitemap = {
        contentType: normalizeMimeType(response.headers['content-type']),
        finalUrl: response.finalUrl,
        kind: undefined,
        locations: 0,
        redirects: response.redirects,
        requestedUrl: sitemapUrl,
        status: response.status,
      }
      state.result.sitemaps.push(sitemap)

      if (response.status < 200 || response.status >= 300) {
        addIssue(state.result, 'error', 'sitemap-http-status', `Sitemap antwortet mit HTTP ${response.status}.`, ['CORE-MAP-01', 'CORE-MAP-02'], sitemapUrl)
        continue
      }
      if (!xmlMimeTypes.has(sitemap.contentType)) {
        addIssue(state.result, 'warning', 'sitemap-content-type', `Sitemap liefert ${sitemap.contentType || 'keinen Content-Type'} statt XML.`, ['CORE-MAP-02'], sitemapUrl)
      }
      if (response.redirects.length > 0) {
        addIssue(state.result, 'warning', 'sitemap-redirect', 'Sitemap-URL wird weitergeleitet.', ['CORE-MAP-02'], sitemapUrl)
      }

      let parsed
      try {
        parsed = parseSitemapXml(response.body.toString('utf8'))
      }
      catch (error) {
        addIssue(state.result, 'error', 'sitemap-xml-invalid', `Sitemap enthält ungültiges XML: ${error.message}`, ['CORE-MAP-01', 'CORE-MAP-02'], sitemapUrl)
        continue
      }
      sitemap.kind = parsed.kind
      sitemap.locations = parsed.locations.length
      for (const location of parsed.locations) {
        const locationUrl = resolveWebUrl(location, response.finalUrl)
        if (!locationUrl || location !== locationUrl.href) {
          addIssue(state.result, 'error', 'sitemap-location-invalid', `Sitemap-Eintrag ist keine absolute HTTP-/HTTPS-URL: ${location}`, ['CORE-MAP-01', 'CORE-MAP-02'], sitemapUrl)
          continue
        }
        if (locationUrl.origin !== state.origin) {
          addIssue(state.result, 'error', 'sitemap-location-external', `Sitemap-Eintrag verwendet einen abweichenden Origin: ${locationUrl.href}`, ['CORE-MAP-01', 'CORE-MAP-02'], sitemapUrl)
          continue
        }
        if (parsed.kind === 'index') {
          if (!visited.has(locationUrl.href) && !queue.includes(locationUrl.href)) {
            queue.push(locationUrl.href)
          }
        }
        else {
          allLocations.push(locationUrl.href)
        }
      }
    }
    catch (error) {
      addIssue(state.result, 'error', 'sitemap-fetch-failed', `Sitemap konnte nicht geprüft werden: ${error.message}`, ['CORE-MAP-01', 'CORE-MAP-02'], sitemapUrl)
    }
  }

  if (queue.length > 0) {
    addIssue(state.result, 'error', 'sitemap-limit', `Mehr als ${state.options.maxSitemaps} Sitemap-Dateien entdeckt; Prüfung wurde begrenzt.`, ['CORE-MAP-02'], initialUrl)
  }

  const uniqueLocations = new Set()
  for (const location of allLocations) {
    if (uniqueLocations.has(location)) {
      addIssue(state.result, 'error', 'sitemap-location-duplicate', `Sitemap enthält die URL mehrfach: ${location}`, ['CORE-MAP-02'], initialUrl)
    }
    uniqueLocations.add(location)
  }
  state.sitemapUrls = uniqueLocations
  state.sitemapUrl = initialUrl

  for (const location of uniqueLocations) {
    enqueuePage(state, location, 'sitemap')
  }
}

async function checkRobotsSitemapReference(state) {
  const robotsUrl = new URL('/robots.txt', state.finalUrl).href
  try {
    const response = await fetchResource(robotsUrl, state.options, {
      accept: 'text/plain,*/*;q=0.1',
      allowedOrigins: [state.origin],
      headers: { 'accept-encoding': 'identity' },
      maximumBytes: 512 * 1024,
    })
    state.result.robots = {
      contentType: normalizeMimeType(response.headers['content-type']),
      finalUrl: response.finalUrl,
      status: response.status,
    }
    if (response.status < 200 || response.status >= 300) {
      addIssue(state.result, 'warning', 'robots-http-status', `robots.txt antwortet mit HTTP ${response.status}.`, ['CORE-ROB-01', 'CORE-MAP-01'], robotsUrl)
      return
    }
    const references = []
    for (const line of response.body.toString('utf8').split(/\r?\n/)) {
      const reference = line.match(/^\s*sitemap\s*:\s*(\S+)\s*$/i)?.[1]
      if (reference) {
        references.push(normalizedComparableUrl(reference))
      }
    }
    if (!references.includes(normalizedComparableUrl(state.sitemapUrl))) {
      addIssue(state.result, 'warning', 'robots-sitemap-reference-missing', `robots.txt referenziert die geprüfte Sitemap ${state.sitemapUrl} nicht.`, ['CORE-MAP-01'], robotsUrl)
    }
  }
  catch (error) {
    addIssue(state.result, 'warning', 'robots-fetch-failed', `robots.txt konnte für den Sitemap-Abgleich nicht geprüft werden: ${error.message}`, ['CORE-ROB-01', 'CORE-MAP-01'], robotsUrl)
  }
}

async function processPage(state, entry, suppliedResponse) {
  let response = suppliedResponse
  try {
    response ||= await fetchResource(entry.url, state.options, {
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      allowedOrigins: [state.origin],
      headers: { 'accept-encoding': 'identity' },
      maximumBytes: state.options.maxHtmlBytes,
      validateRedirect: nextUrl => !readOnlyNavigationConcern(nextUrl),
    })
  }
  catch (error) {
    addIssue(state.result, 'error', 'page-fetch-failed', `Internes Linkziel konnte nicht abgerufen werden: ${error.message}`, ['CORE-SEO-04', 'CORE-QA-03'], entry.url)
    return
  }

  const contentType = normalizeMimeType(response.headers['content-type'])
  if (!htmlMimeTypes.has(contentType)) {
    const resourceEntry = {
      sources: entry.sources,
      types: new Set(['download']),
      url: entry.url,
    }
    inspectResourceResponse(state, resourceEntry, response)
    return
  }

  const facts = extractHtmlFacts(response.body.toString('utf8'), response.finalUrl)
  const page = snapshotPage(response, entry, facts)
  state.result.pages.push(page)
  state.pageFacts.set(page.finalUrl, facts)
  state.pagesByRequestedUrl.set(page.requestedUrl, page)

  if (response.status < 200 || response.status >= 300) {
    const sitemapSource = entry.sources.has('sitemap')
    addIssue(
      state.result,
      'error',
      sitemapSource ? 'sitemap-page-http-status' : 'page-http-status',
      `Internes HTML-Ziel antwortet mit HTTP ${response.status}.`,
      sitemapSource ? ['CORE-MAP-01', 'CORE-SEO-04'] : ['CORE-SEO-04', 'CORE-QA-03'],
      entry.url,
    )
    return
  }
  if (response.redirects.length > 0) {
    addIssue(
      state.result,
      entry.sources.has('sitemap') ? 'error' : 'warning',
      entry.sources.has('sitemap') ? 'sitemap-page-redirect' : 'internal-page-redirect',
      `HTML-Ziel benötigt ${response.redirects.length} Weiterleitung(en) und endet bei ${response.finalUrl}.`,
      entry.sources.has('sitemap') ? ['CORE-MAP-01', 'CORE-SEO-04'] : ['CORE-DOM-07', 'CORE-SEO-04'],
      entry.url,
    )
  }

  checkPageMetadata(state.result, page, facts)
  if (entry.sources.has('sitemap') && !page.indexable) {
    addIssue(state.result, 'error', 'sitemap-page-noindex', 'Sitemap enthält eine noindex-Seite.', ['CORE-MAP-01'], entry.url)
  }

  for (const link of facts.internalLinks) {
    enqueuePage(state, link.url, 'internal-link', response.finalUrl)
  }
  for (const externalUrl of facts.externalLinks) {
    addExternalLink(state.result, response.finalUrl, externalUrl)
  }
  for (const form of facts.forms) {
    state.result.forms.push({ ...form, pageUrl: response.finalUrl, requested: false })
  }
  for (const resource of facts.resources) {
    enqueueResource(state, resource.url, resource.type, response.finalUrl)
  }
}

function inspectResourceResponse(state, entry, response) {
  const contentType = normalizeMimeType(response.headers['content-type'])
  const resource = {
    bytes: response.body.byteLength,
    cacheControl: response.headers['cache-control'],
    contentType,
    finalUrl: response.finalUrl,
    redirects: response.redirects,
    requestedUrl: entry.url,
    sources: [...entry.sources],
    status: response.status,
    types: [...entry.types],
  }
  state.result.resources.push(resource)

  if (response.status < 200 || response.status >= 300) {
    addIssue(state.result, 'error', 'resource-http-status', `Ressource antwortet mit HTTP ${response.status}.`, ['CORE-QA-05', 'CORE-QA-08'], entry.url)
    return
  }
  if (response.redirects.length > 0) {
    addIssue(state.result, 'warning', 'resource-redirect', `Ressource benötigt ${response.redirects.length} Weiterleitung(en).`, ['CORE-SEO-04', 'CORE-QA-08'], entry.url)
  }
  for (const type of entry.types) {
    if (!expectedMimeType(type, contentType)) {
      addIssue(state.result, 'error', 'resource-content-type', `Als ${type} verwendete Ressource liefert ${contentType || 'keinen Content-Type'}.`, ['CORE-ERR-03', 'CORE-QA-08'], entry.url)
    }
  }

  const looksVersioned = /\/(?:_nuxt|assets)\/|[._-][a-f\d]{8,}[._-]/i.test(new URL(response.finalUrl).pathname)
  if (looksVersioned && (!/\bimmutable\b/i.test(resource.cacheControl || '') || !/\bmax-age\s*=\s*(?:[3-9]\d{7}|\d{9,})/i.test(resource.cacheControl || ''))) {
    addIssue(state.result, 'warning', 'resource-versioned-cache-short', 'Versioniert wirkende Ressource besitzt keinen langfristigen unveränderlichen Cache.', ['CORE-PERF-05'], entry.url)
  }

  if (entry.types.has('stylesheet') && contentType === 'text/css') {
    for (const cssResource of extractCssResources(response.body.toString('utf8'), response.finalUrl)) {
      enqueueResource(state, cssResource.url, cssResource.type, response.finalUrl)
    }
  }
}

async function processResources(state) {
  let index = 0
  while (index < state.resourceQueue.length) {
    const entry = state.resourceQueue[index]
    index += 1
    try {
      const response = await fetchResource(entry.url, state.options, {
        accept: resourceAccept(entry.types),
        allowedOrigins: [state.origin],
        headers: { 'accept-encoding': 'identity' },
        maximumBytes: state.options.maxHtmlBytes,
      })
      inspectResourceResponse(state, entry, response)
    }
    catch (error) {
      addIssue(state.result, 'error', 'resource-fetch-failed', `Ressource konnte nicht abgerufen werden: ${error.message}`, ['CORE-QA-05', 'CORE-QA-08'], entry.url)
    }
  }
}

function checkFragments(state) {
  for (const link of state.fragmentLinks) {
    const targetPage = state.result.pages.find(page => page.requestedUrl === link.targetUrl || page.finalUrl === link.targetUrl)
    if (!targetPage || targetPage.status < 200 || targetPage.status >= 300) {
      continue
    }
    const facts = state.pageFacts.get(targetPage.finalUrl)
    if (facts && !facts.ids.has(link.fragment) && !facts.anchorNames.has(link.fragment)) {
      addIssue(state.result, 'warning', 'internal-fragment-missing', `Fragment #${link.fragment} ist auf der Zielseite nicht vorhanden.`, ['CORE-QA-03', 'CORE-SEO-04'], link.sourceUrl)
    }
  }
}

function checkSitemapCoverage(state) {
  if (!state.options.sitemap) {
    return
  }

  const checkedSitemapUrls = [...state.sitemapUrls].filter(url => state.pagesByRequestedUrl.has(url)).length
  if (checkedSitemapUrls < state.sitemapUrls.size) {
    addIssue(state.result, 'error', 'sitemap-coverage-incomplete', `Nur ${checkedSitemapUrls} von ${state.sitemapUrls.size} Sitemap-URLs wurden innerhalb des Seitenlimits geprüft.`, ['CORE-MAP-02'], state.sitemapUrl)
  }

  for (const page of state.result.pages) {
    if (page.status < 200 || page.status >= 300 || !page.indexable || new URL(page.finalUrl).origin !== state.origin) {
      continue
    }
    if (!state.sitemapUrls.has(page.finalUrl)) {
      addIssue(state.result, 'warning', 'indexable-page-not-in-sitemap', 'Indexierbare intern gefundene Seite fehlt in der Sitemap.', ['CORE-MAP-01'], page.finalUrl)
    }
  }
}

function checkDuplicateMetadata(result) {
  for (const [field, code, checklistId] of [
    ['title', 'page-title-duplicate', 'CORE-SEO-01'],
    ['description', 'page-description-duplicate-across-pages', 'CORE-SEO-01'],
  ]) {
    const values = new Map()
    for (const page of result.pages.filter(candidate => candidate.indexable && candidate.status >= 200 && candidate.status < 300)) {
      const value = field === 'description' ? page.description[0] : page.title
      if (value) {
        values.set(value, [...(values.get(value) || []), page.finalUrl])
      }
    }
    for (const [value, urls] of values) {
      if (urls.length > 1) {
        addIssue(result, 'warning', code, `${field === 'title' ? 'Seitentitel' : 'Meta-Beschreibung'} wird auf ${urls.length} Seiten wiederholt: ${value}`, [checklistId], urls[0])
      }
    }
  }
}

async function inspectSite(inputUrl, options) {
  const result = {
    assertions: [],
    externalLinkKeys: new Set(),
    externalLinks: [],
    forms: [],
    issues: [],
    pages: [],
    requestedUrl: inputUrl,
    resources: [],
    sitemaps: [],
    skippedLinks: [],
  }

  let initialResponse
  try {
    initialResponse = await fetchResource(inputUrl, options, {
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      headers: { 'accept-encoding': 'identity' },
      maximumBytes: options.maxHtmlBytes,
    })
  }
  catch (error) {
    addIssue(result, 'error', 'initial-fetch-failed', `Start-URL konnte nicht abgerufen werden: ${error.message}`, ['CORE-SEO-04'], inputUrl)
    addCrawlAssertions(result, options)
    delete result.externalLinkKeys
    return result
  }

  result.finalUrl = initialResponse.finalUrl
  const state = {
    finalUrl: initialResponse.finalUrl,
    fragmentLinks: [],
    options,
    origin: new URL(initialResponse.finalUrl).origin,
    pageEntries: new Map(),
    pageFacts: new Map(),
    pageLimitReached: false,
    pageQueue: [],
    pagesByRequestedUrl: new Map(),
    resourceEntries: new Map(),
    resourceLimitReached: false,
    resourceQueue: [],
    result,
    sitemapUrl: undefined,
    skippedLinkKeys: new Set(),
    sitemapUrls: new Set(),
  }

  enqueuePage(state, initialResponse.finalUrl, 'input')
  if (options.sitemap) {
    await fetchSitemaps(state)
    await checkRobotsSitemapReference(state)
  }

  let pageIndex = 0
  while (pageIndex < state.pageQueue.length) {
    const entry = state.pageQueue[pageIndex]
    pageIndex += 1
    const response = entry.url === initialResponse.finalUrl ? initialResponse : undefined
    await processPage(state, entry, response)
  }
  await processResources(state)

  if (state.pageLimitReached) {
    addIssue(result, 'error', 'page-limit-reached', `Mehr als ${options.maxPages} interne HTML-/Linkziele entdeckt; Crawl ist unvollständig.`, ['CORE-SEO-04', 'CORE-VAL-08'], result.finalUrl)
  }
  if (state.resourceLimitReached) {
    addIssue(result, 'error', 'resource-limit-reached', `Mehr als ${options.maxResources} interne Ressourcen entdeckt; Ressourcenlauf ist unvollständig.`, ['CORE-QA-08', 'CORE-VAL-08'], result.finalUrl)
  }

  checkFragments(state)
  checkSitemapCoverage(state)
  checkDuplicateMetadata(result)
  addCrawlAssertions(result, options)
  delete result.externalLinkKeys
  return result
}

function checklistCoverage(results) {
  return evaluatePilotChecklist({
    assertions: results.flatMap(result => result.assertions),
    itemIds: checklistItemIdsForTool('crawl-check'),
  })
}

function summarize(results, strict) {
  const issues = results.flatMap(result => result.issues)
  const errors = issues.filter(issue => issue.severity === 'error').length
  const warnings = issues.filter(issue => issue.severity === 'warning').length
  return {
    errors,
    externalLinks: results.reduce((sum, result) => sum + result.externalLinks.length, 0),
    failed: errors > 0 || (strict && warnings > 0),
    formsObservedNotSubmitted: results.reduce((sum, result) => sum + result.forms.length, 0),
    pages: results.reduce((sum, result) => sum + result.pages.length, 0),
    resources: results.reduce((sum, result) => sum + result.resources.length, 0),
    skippedNavigation: results.reduce((sum, result) => sum + result.skippedLinks.length, 0),
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
      maxPages: options.maxPages,
      maxRedirects: options.maxRedirects,
      maxResources: options.maxResources,
      privateTargetsRedacted: Boolean(options.allowPrivate),
      sitemap: options.sitemap,
      sitemapUrl: redactReportData(options.sitemapUrl, 'sitemapUrl'),
      strict: options.strict,
      timeoutMilliseconds: options.timeoutMilliseconds,
    },
    readOnlyGuarantees: {
      buttonsActivated: false,
      externalLinksFetched: false,
      formActionsFetched: false,
      formsSubmitted: false,
      methods: ['GET'],
    },
    results: reportedResults,
    schemaVersion: 1,
    summary: summarize(reportedResults, options.strict),
    tool: 'crawl-check',
    toolPackage: { name: packageName, version: packageVersion },
  }
}

function printText(results, options) {
  console.log(`${packageName} ${packageVersion}`)
  for (const result of results) {
    console.log(`\n=== ${result.requestedUrl} ===`)
    console.log(`Finaler Origin: ${result.finalUrl ? new URL(result.finalUrl).origin : 'nicht ermittelt'}`)
    console.log(`Geprüft: ${result.pages.length} HTML-Seite(n), ${result.resources.length} Ressource(n), ${result.sitemaps.length} Sitemap-Datei(en).`)
    console.log(`Nur inventarisiert: ${result.externalLinks.length} externe Linkbeziehung(en), ${result.forms.length} Formular(e); keine davon abgerufen oder abgesendet.`)
    if (result.skippedLinks.length > 0) {
      console.log(`Aus Nur-Lese-Vorsicht übersprungen: ${result.skippedLinks.length} potenziell zustandsverändernde Navigation(en).`)
    }

    for (const page of result.pages) {
      console.log(`Seite: HTTP ${page.status}, ${page.indexable ? 'indexierbar' : 'noindex'}, ${page.finalUrl}`)
    }
    if (result.issues.length === 0) {
      console.log('OK: Keine Fehler oder Warnungen.')
    }
    else {
      for (const issue of result.issues) {
        const ids = issue.checklistIds.length > 0 ? ` ${issue.checklistIds.join(',')}` : ''
        console.log(`${issue.severity === 'error' ? 'FEHLER' : 'WARNUNG'} [${issue.code}]${ids}: ${issue.message} (${issue.url})`)
      }
    }
  }

  const coverage = checklistCoverage(results)
  const checklistSummary = coverage.summary.checklistItems
  const nonAutomaticSummary = coverage.summary.nonAutomaticCriteria
  console.log(`\nPilot-Checklistennachweis ${coverage.catalog.version}: ${checklistSummary.pass} Punkt(e) vollständig, ${checklistSummary.partial} teilweise, ${checklistSummary.fail} fehlgeschlagen, ${checklistSummary.open + checklistSummary.inconclusive} offen/unklar.`)
  console.log(`Nicht automatisch belegbare Kriterien: ${nonAutomaticSummary.pass} belegt, ${nonAutomaticSummary.total - nonAutomaticSummary.pass - nonAutomaticSummary.notApplicable} offen; sie werden durch diesen Lauf nicht stillschweigend abgeschlossen.`)

  const summary = summarize(results, options.strict)
  console.log('\nNur lesender Lauf: ausschließlich GET; keine Formular-Action und kein externer Link wurde abgerufen, kein Button betätigt.')
  console.log(`Ergebnis: ${summary.pages} Seite(n), ${summary.resources} Ressource(n), ${summary.errors} Fehler, ${summary.warnings} Warnung(en).`)
  if (summary.failed) {
    console.log(options.strict && summary.errors === 0
      ? 'NICHT BESTANDEN: --strict wertet Warnungen als Fehler.'
      : 'NICHT BESTANDEN.')
  }
  else {
    console.log('BESTANDEN.')
  }
}

export async function runCrawlCheck(inputUrls, options = {}) {
  const mergedOptions = { ...defaultOptions, ...options }
  if (inputUrls.length !== 1) {
    throw new Error('Der Crawl benötigt genau eine Start-URL.')
  }
  const inputUrl = validateUrl(inputUrls[0], mergedOptions).href
  const results = [await inspectSite(inputUrl, mergedOptions)]
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
      throw new Error(`Eine Start-URL fehlt.\n\n${usage()}`)
    }

    const report = await runCrawlCheck(urls, options)
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
      readOnlyGuarantees: {
        buttonsActivated: false,
        externalLinksFetched: false,
        formActionsFetched: false,
        formsSubmitted: false,
        methods: ['GET'],
      },
      schemaVersion: 1,
      summary: { errors: 1, failed: true, pages: 0, resources: 0, warnings: 0 },
      tool: 'crawl-check',
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
