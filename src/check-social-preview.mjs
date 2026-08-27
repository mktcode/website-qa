#!/usr/bin/env node

/* eslint-disable no-console */
/* oxlint-disable no-await-in-loop */

import { fileTypeFromBuffer } from 'file-type'
import { parse } from 'parse5'
import robotsParser from 'robots-parser'
import sharp from 'sharp'
import { fetchResource, normalizeMimeType, redactReportData, redactText, reportUrl, validateUrl } from './lib/http-client.mjs'
import { writeJsonOutput } from './lib/json-output.mjs'
import { readOnlyNavigationConcern } from './lib/navigation-safety.mjs'
import { isMainModule, packageName, packageVersion } from './lib/package-info.mjs'
import { checklistReference, technicalSignals, technicalSignalSummary } from './lib/signal-report.mjs'
import { parseSitemapXml } from './lib/sitemap-parser.mjs'
import { jsonOutputIntent, technicalErrorReport } from './lib/technical-report.mjs'

const defaultOptions = {
  allowHttp: false,
  allowPrivate: false,
  json: false,
  jsonFile: undefined,
  maxHtmlBytes: 2 * 1024 * 1024,
  maxImageBytes: 10 * 1024 * 1024,
  maxPages: 50,
  maxRedirects: 5,
  maxSitemaps: 20,
  sitemap: false,
  sitemapUrl: undefined,
  strict: false,
  timeoutMilliseconds: 15_000,
}

const userAgents = [
  {
    key: 'browser',
    label: 'Browser',
    value: 'Mozilla/5.0 (compatible; SocialPreviewCheck/1.0)',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    value: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  },
  {
    key: 'x',
    label: 'X/Twitter',
    value: 'Twitterbot/1.0',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    value: 'LinkedInBot/1.0',
  },
]

export const robotsPolicyReviewedAt = '2026-08-27'

const robotsPolicyDefinitions = [
  {
    category: 'social',
    documentation: 'https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers',
    key: 'facebookexternalhit',
    label: 'FacebookExternalHit',
    token: 'facebookexternalhit',
  },
  {
    category: 'social',
    documentation: 'https://developer.x.com/en/docs/x-for-websites/cards/guides/getting-started',
    key: 'twitterbot',
    label: 'Twitterbot',
    token: 'Twitterbot',
  },
  {
    category: 'social',
    documentation: 'https://www.linkedin.com/help/linkedin/answer/a521928',
    key: 'linkedinbot',
    label: 'LinkedInBot',
    token: 'LinkedInBot',
  },
  {
    category: 'ai-search',
    documentation: 'https://developers.openai.com/api/docs/bots',
    key: 'openai-search',
    label: 'OAI-SearchBot',
    token: 'OAI-SearchBot',
  },
  {
    category: 'ai-user',
    documentation: 'https://developers.openai.com/api/docs/bots',
    key: 'openai-user',
    label: 'ChatGPT-User',
    robotsMayNotApply: true,
    token: 'ChatGPT-User',
  },
  {
    category: 'ai-training',
    documentation: 'https://developers.openai.com/api/docs/bots',
    key: 'openai-training',
    label: 'GPTBot',
    token: 'GPTBot',
  },
  {
    category: 'ai-search',
    documentation: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
    key: 'anthropic-search',
    label: 'Claude-SearchBot',
    token: 'Claude-SearchBot',
  },
  {
    category: 'ai-user',
    documentation: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
    key: 'anthropic-user',
    label: 'Claude-User',
    token: 'Claude-User',
  },
  {
    category: 'ai-training',
    documentation: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
    key: 'anthropic-training',
    label: 'ClaudeBot',
    token: 'ClaudeBot',
  },
  {
    category: 'ai-search',
    documentation: 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers',
    key: 'google-search',
    label: 'Googlebot (Search/Gemini-Grounding)',
    token: 'Googlebot',
  },
  {
    category: 'ai-search',
    documentation: 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers',
    key: 'google-vertex',
    label: 'Google-CloudVertexBot',
    token: 'Google-CloudVertexBot',
  },
  {
    category: 'ai-training',
    documentation: 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers',
    key: 'google-extended',
    label: 'Google-Extended',
    productTokenOnly: true,
    token: 'Google-Extended',
  },
  {
    category: 'ai-search',
    documentation: 'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0',
    key: 'microsoft-copilot',
    label: 'Bingbot (Search/Copilot)',
    token: 'bingbot',
  },
  {
    category: 'ai-search',
    documentation: 'https://docs.mistral.ai/robots',
    key: 'mistral-index',
    label: 'MistralAI-Index',
    token: 'MistralAI-Index',
  },
  {
    category: 'ai-user',
    documentation: 'https://docs.mistral.ai/robots',
    key: 'mistral-user',
    label: 'MistralAI-User',
    token: 'MistralAI-User',
  },
  {
    category: 'ai-training',
    documentation: 'https://docs.mistral.ai/robots',
    key: 'mistral-training',
    label: 'MistralAI-Training',
    token: 'MistralAI-Training',
  },
  {
    category: 'ai-search',
    documentation: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers',
    key: 'perplexity-search',
    label: 'PerplexityBot',
    token: 'PerplexityBot',
  },
  {
    category: 'ai-user',
    documentation: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers',
    key: 'perplexity-user',
    label: 'Perplexity-User',
    robotsMayNotApply: true,
    token: 'Perplexity-User',
  },
  {
    category: 'ai-user',
    documentation: 'https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers',
    key: 'meta-fetcher',
    label: 'Meta-ExternalFetcher',
    robotsMayNotApply: true,
    token: 'meta-externalfetcher',
  },
  {
    category: 'ai-training',
    documentation: 'https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers',
    key: 'meta-training',
    label: 'Meta-ExternalAgent',
    token: 'meta-externalagent',
  },
  {
    category: 'ai-search',
    documentation: 'https://support.apple.com/en-us/119829',
    key: 'apple-search',
    label: 'Applebot',
    token: 'Applebot',
  },
  {
    category: 'ai-training',
    documentation: 'https://support.apple.com/en-us/119829',
    key: 'apple-extended',
    label: 'Applebot-Extended',
    productTokenOnly: true,
    token: 'Applebot-Extended',
  },
]

const limitedSourceVerification = {
  linkedinbot: 'officialContextOnly',
  twitterbot: 'historicalRedirect',
}

export const robotsPolicies = robotsPolicyDefinitions.map(policy => Object.assign(policy, {
  sourceVerification: limitedSourceVerification[policy.key] || 'currentOfficial',
}))

function robotsPolicySourceSummary() {
  return Object.fromEntries(['currentOfficial', 'officialContextOnly', 'historicalRedirect']
    .map(status => [status, robotsPolicies.filter(policy => policy.sourceVerification === status).length]))
}

const robotsCategoryLabels = {
  'social': 'Social-Vorschau',
  'ai-search': 'KI-Suche/Index',
  'ai-user': 'KI-Nutzerabruf',
  'ai-training': 'KI-Training/Datennutzung',
}

const requiredOpenGraphKeys = ['og:title', 'og:description', 'og:type', 'og:url', 'og:image']
const socialMetadataKeys = [
  ...requiredOpenGraphKeys,
  'og:site_name',
  'og:locale',
  'og:image:alt',
  'og:image:type',
  'og:image:width',
  'og:image:height',
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
  'twitter:image:alt',
  'twitter:site',
  'twitter:creator',
]

function usage() {
  return `${packageName} ${packageVersion}

Social-Metadaten und Vorschaubilder gegen öffentliche URLs prüfen.

Aufruf:
  website-qa-social <URL> [weitere URL ...] [Optionen]

Optionen:
  --json                 Maschinenlesbare JSON-Ausgabe auf stdout
  --json-file=<Pfad>     JSON atomar in eine lokale Datei schreiben
  --strict               Warnungen führen ebenfalls zu Exitcode 1
  --sitemap              Zusätzlich URLs aus /sitemap.xml prüfen
  --sitemap-url=<URL>    Abweichende Sitemap-URL verwenden
  --max-pages=<Anzahl>   Höchstens so viele Seiten prüfen (Standard: 50)
  --max-sitemaps=<N>     Höchstens so viele Sitemap-Dateien abrufen (Standard: 20)
  --timeout=<Millisek.>  Timeout je Abruf (Standard: 15000)
  --max-redirects=<N>    Maximale Anzahl Weiterleitungen (Standard: 5)
  --allow-http           HTTP-Eingabe für lokale oder bewusste Prüfungen erlauben
  --allow-private        localhost und private IP-Adressen erlauben
  --help                 Diese Hilfe anzeigen

Beispiele:
  website-qa-social https://example.de/
  website-qa-social https://example.de/ --json
  website-qa-social https://example.de/ --sitemap --max-pages=20`
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
    else if (argument === '--sitemap') {
      options.sitemap = true
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
    else if (argument.startsWith('--max-sitemaps=')) {
      options.maxSitemaps = parsePositiveInteger(argument.slice('--max-sitemaps='.length), '--max-sitemaps')
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

  return { options, urls }
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

export function extractHtmlMetadata(html) {
  const document = parse(html)
  const metadata = new Map()
  const canonicals = []
  let documentTitle = ''
  let htmlLanguage = ''

  function addMetadata(key, value) {
    const normalizedKey = key.trim().toLowerCase()
    const normalizedValue = value.trim()
    if (!normalizedKey || !normalizedValue) {
      return
    }
    metadata.set(normalizedKey, [...(metadata.get(normalizedKey) || []), normalizedValue])
  }

  function visit(node) {
    if (node.tagName === 'html') {
      htmlLanguage = attribute(node, 'lang')?.trim() || ''
    }
    else if (node.tagName === 'title' && !documentTitle) {
      documentTitle = collectText(node).trim()
    }
    else if (node.tagName === 'meta') {
      const key = attribute(node, 'property') || attribute(node, 'name')
      const content = attribute(node, 'content')
      if (key && content) {
        addMetadata(key, content)
      }
    }
    else if (node.tagName === 'link') {
      const relations = (attribute(node, 'rel') || '').toLowerCase().split(/\s+/)
      const href = attribute(node, 'href')?.trim()
      if (relations.includes('canonical') && href) {
        canonicals.push(href)
      }
    }

    for (const child of node.childNodes || []) {
      visit(child)
    }
  }

  visit(document)

  return {
    canonicals,
    documentTitle,
    htmlLanguage,
    metadata: Object.fromEntries(metadata.entries()),
  }
}

function firstValue(metadata, key) {
  return metadata[key]?.[0]
}

function normalizeComparableUrl(value) {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.href
  }
  catch {
    return value
  }
}

function issueChecklistRefs(code) {
  if (code === 'ai-discovery-blocked-by-robots') {
    return ['CORE-ROB-02', 'CORE-SOC-02']
  }
  if (code.startsWith('robots-') || code === 'crawler-blocked-by-robots') {
    return ['CORE-ROB-01', 'CORE-SOC-02']
  }
  if (code.includes('canonical')) {
    return ['CORE-DOM-05', 'CORE-DOM-06', 'CORE-SOC-02']
  }
  if (code.includes('image') || code.includes('open-graph') || code.includes('twitter') || code.includes('metadata')) {
    return ['CORE-SOC-01', 'CORE-SOC-02']
  }
  return ['CORE-SOC-02']
}

function addIssue(result, severity, code, message) {
  result.issues.push({ checklistRefs: issueChecklistRefs(code), code, message, severity })
}

function checkAbsoluteUrl(result, value, label, options) {
  if (!value) {
    return undefined
  }
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('unsupported protocol')
    }
    if (url.protocol !== 'https:' && !options.allowHttp) {
      addIssue(result, 'warning', 'insecure-metadata-url', `${label} verwendet kein HTTPS: ${value}`)
    }
    return url
  }
  catch {
    addIssue(result, 'error', 'invalid-metadata-url', `${label} ist keine absolute HTTP-/HTTPS-URL: ${value}`)
    return undefined
  }
}

function checkLength(result, value, label, minimum, maximum) {
  if (!value) {
    return
  }
  if (value.length < minimum || value.length > maximum) {
    addIssue(
      result,
      'warning',
      'metadata-length',
      `${label} hat ${value.length} Zeichen; als Orientierung gelten ${minimum} bis ${maximum}.`,
    )
  }
}

function checkMetadata(result, metadataResult, finalUrl, options) {
  const { canonicals, metadata } = metadataResult

  for (const key of requiredOpenGraphKeys) {
    if (!firstValue(metadata, key)) {
      addIssue(result, 'error', 'missing-open-graph', `${key} fehlt im serverseitigen HTML.`)
    }
  }

  for (const key of socialMetadataKeys) {
    const values = metadata[key] || []
    const distinctValues = [...new Set(values)]
    if (distinctValues.length > 1) {
      addIssue(result, 'error', 'conflicting-metadata', `${key} besitzt widersprüchliche Werte: ${distinctValues.join(' | ')}`)
    }
    else if (values.length > 1) {
      addIssue(result, 'warning', 'duplicate-metadata', `${key} ist mehrfach mit demselben Wert vorhanden.`)
    }
  }

  if (canonicals.length === 0) {
    addIssue(result, 'error', 'missing-canonical', 'Ein Canonical-Link fehlt.')
  }
  else if (new Set(canonicals).size > 1) {
    addIssue(result, 'error', 'conflicting-canonical', `Mehrere unterschiedliche Canonicals: ${canonicals.join(' | ')}`)
  }
  else if (canonicals.length > 1) {
    addIssue(result, 'warning', 'duplicate-canonical', 'Der Canonical-Link ist mehrfach vorhanden.')
  }

  const canonical = canonicals[0]
  const openGraphUrl = firstValue(metadata, 'og:url')
  const openGraphImage = firstValue(metadata, 'og:image')
  const twitterImage = firstValue(metadata, 'twitter:image')

  checkAbsoluteUrl(result, canonical, 'Canonical', options)
  checkAbsoluteUrl(result, openGraphUrl, 'og:url', options)
  checkAbsoluteUrl(result, openGraphImage, 'og:image', options)
  checkAbsoluteUrl(result, twitterImage, 'twitter:image', options)

  if (canonical && normalizeComparableUrl(canonical) !== normalizeComparableUrl(finalUrl)) {
    addIssue(result, 'error', 'canonical-final-url-mismatch', `Canonical ${canonical} weicht von der finalen URL ${finalUrl} ab.`)
  }
  if (canonical && openGraphUrl && normalizeComparableUrl(canonical) !== normalizeComparableUrl(openGraphUrl)) {
    addIssue(result, 'error', 'canonical-open-graph-mismatch', `Canonical ${canonical} und og:url ${openGraphUrl} stimmen nicht überein.`)
  }

  const twitterCard = firstValue(metadata, 'twitter:card')
  if (!twitterCard) {
    addIssue(result, 'error', 'missing-twitter-card', 'twitter:card fehlt.')
  }
  else if (!['app', 'player', 'summary', 'summary_large_image'].includes(twitterCard)) {
    addIssue(result, 'error', 'invalid-twitter-card', `twitter:card hat einen unbekannten Wert: ${twitterCard}`)
  }

  for (const [twitterKey, fallbackKey] of [
    ['twitter:title', 'og:title'],
    ['twitter:description', 'og:description'],
    ['twitter:image', 'og:image'],
  ]) {
    if (!firstValue(metadata, twitterKey)) {
      const fallback = firstValue(metadata, fallbackKey)
      addIssue(
        result,
        fallback ? 'warning' : 'error',
        'twitter-fallback',
        `${twitterKey} fehlt${fallback ? `; ${fallbackKey} dient als Fallback` : ' und besitzt keinen OpenGraph-Fallback'}.`,
      )
    }
  }

  if (!firstValue(metadata, 'og:image:alt')) {
    addIssue(result, 'warning', 'missing-image-alt', 'og:image:alt fehlt.')
  }
  if (!firstValue(metadata, 'twitter:image:alt')) {
    addIssue(result, 'warning', 'missing-twitter-image-alt', 'twitter:image:alt fehlt.')
  }

  const locale = firstValue(metadata, 'og:locale')
  if (locale && !/^[a-z]{2}_[A-Z]{2}$/.test(locale)) {
    addIssue(result, 'warning', 'invalid-open-graph-locale', `og:locale verwendet nicht das übliche Format de_DE: ${locale}`)
  }

  checkLength(result, firstValue(metadata, 'og:title'), 'og:title', 15, 70)
  checkLength(result, firstValue(metadata, 'og:description'), 'og:description', 50, 200)
  checkLength(result, firstValue(metadata, 'twitter:title'), 'twitter:title', 15, 70)
  checkLength(result, firstValue(metadata, 'twitter:description'), 'twitter:description', 50, 200)

  return {
    canonical,
    openGraphImage,
    twitterImage,
  }
}

function metadataSnapshot(metadataResult) {
  return Object.fromEntries([
    ['canonical', metadataResult.canonicals[0]],
    ...socialMetadataKeys.map(key => [key, firstValue(metadataResult.metadata, key)]),
  ].filter(([, value]) => value !== undefined))
}

function checkAgentParity(result, baseline, candidate, label) {
  if (normalizeComparableUrl(candidate.finalUrl) !== normalizeComparableUrl(baseline.finalUrl)) {
    addIssue(result, 'error', 'crawler-final-url-mismatch', `${label} endet bei ${candidate.finalUrl} statt ${baseline.finalUrl}.`)
  }

  const baselineSnapshot = metadataSnapshot(baseline.metadata)
  const candidateSnapshot = metadataSnapshot(candidate.metadata)
  const changedKeys = [...new Set([...Object.keys(baselineSnapshot), ...Object.keys(candidateSnapshot)])]
    .filter(key => baselineSnapshot[key] !== candidateSnapshot[key])

  const missingRequired = requiredOpenGraphKeys.filter(
    key => baselineSnapshot[key] && !candidateSnapshot[key],
  )
  if (missingRequired.length > 0) {
    addIssue(result, 'error', 'crawler-missing-metadata', `${label} erhält nicht alle OpenGraph-Pflichtfelder: ${missingRequired.join(', ')}`)
  }
  if (changedKeys.length > 0) {
    addIssue(result, 'warning', 'crawler-metadata-difference', `${label} erhält abweichende Metadaten: ${changedKeys.join(', ')}`)
  }
}

async function checkImage(result, imageUrl, sources, metadata, options) {
  const imageResult = {
    sources,
    url: imageUrl,
  }
  result.images.push(imageResult)

  try {
    const concern = readOnlyNavigationConcern(new URL(imageUrl))
    if (concern) {
      throw new Error(`Nur-Lese-Richtlinie: ${concern}`)
    }
    const response = await fetchResource(imageUrl, options, {
      accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/svg+xml,image/*;q=0.8,*/*;q=0.1',
      maximumBytes: options.maxImageBytes,
      userAgent: userAgents.find(agent => agent.key === 'facebook').value,
      validateRedirect: nextUrl => !readOnlyNavigationConcern(nextUrl),
    })
    imageResult.finalUrl = response.finalUrl
    imageResult.redirects = response.redirects
    imageResult.status = response.status
    imageResult.bytes = response.body.byteLength
    imageResult.contentType = normalizeMimeType(response.headers['content-type'])
    imageResult.cacheControl = response.headers['cache-control']

    if (response.status < 200 || response.status >= 300) {
      addIssue(result, 'error', 'image-http-status', `Vorschaubild ${imageUrl} antwortet mit HTTP ${response.status}.`)
      return
    }
    if (!imageResult.contentType?.startsWith('image/')) {
      addIssue(result, 'error', 'image-content-type', `Vorschaubild ${imageUrl} liefert ${imageResult.contentType || 'keinen Content-Type'}.`)
    }

    const detectedType = await fileTypeFromBuffer(response.body)
    const sharpMetadata = await sharp(response.body, { limitInputPixels: 100_000_000 }).metadata()
    imageResult.detectedType = detectedType?.mime || (sharpMetadata.format ? `image/${sharpMetadata.format}` : undefined)
    imageResult.width = sharpMetadata.width
    imageResult.height = sharpMetadata.height

    if (detectedType?.mime && imageResult.contentType && normalizeMimeType(detectedType.mime) !== imageResult.contentType) {
      addIssue(
        result,
        'error',
        'image-mime-mismatch',
        `Vorschaubild ${imageUrl}: Header ${imageResult.contentType}, tatsächlicher Typ ${detectedType.mime}.`,
      )
    }

    if (!imageResult.width || !imageResult.height) {
      addIssue(result, 'error', 'image-dimensions-missing', `Pixelabmessungen von ${imageUrl} konnten nicht ermittelt werden.`)
      return
    }

    if (imageResult.width < 600 || imageResult.height < 315) {
      addIssue(
        result,
        'warning',
        'image-small',
        `Vorschaubild ${imageUrl} ist nur ${imageResult.width}×${imageResult.height} Pixel groß; empfohlen sind mindestens 600×315.`,
      )
    }

    const card = firstValue(metadata, 'twitter:card')
    const ratio = imageResult.width / imageResult.height
    if (card === 'summary_large_image' && (ratio < 1.7 || ratio > 2.1)) {
      addIssue(
        result,
        'warning',
        'image-aspect-ratio',
        `Vorschaubild ${imageUrl} hat für summary_large_image das ungewöhnliche Seitenverhältnis ${ratio.toFixed(2)}:1.`,
      )
    }
    if (response.body.byteLength > 5 * 1024 * 1024) {
      addIssue(result, 'warning', 'image-file-size', `Vorschaubild ${imageUrl} ist größer als 5 MiB.`)
    }

    if (sources.includes('og:image')) {
      const declaredType = normalizeMimeType(firstValue(metadata, 'og:image:type'))
      const declaredWidth = Number(firstValue(metadata, 'og:image:width'))
      const declaredHeight = Number(firstValue(metadata, 'og:image:height'))
      const actualType = normalizeMimeType(detectedType?.mime || imageResult.contentType)

      if (declaredType && actualType && declaredType !== actualType) {
        addIssue(result, 'error', 'declared-image-type-mismatch', `og:image:type ${declaredType} entspricht nicht ${actualType}.`)
      }
      if (Number.isFinite(declaredWidth) && declaredWidth > 0 && declaredWidth !== imageResult.width) {
        addIssue(result, 'error', 'declared-image-width-mismatch', `og:image:width ${declaredWidth} entspricht nicht ${imageResult.width}.`)
      }
      if (Number.isFinite(declaredHeight) && declaredHeight > 0 && declaredHeight !== imageResult.height) {
        addIssue(result, 'error', 'declared-image-height-mismatch', `og:image:height ${declaredHeight} entspricht nicht ${imageResult.height}.`)
      }
    }
  }
  catch (error) {
    addIssue(result, 'error', 'image-fetch-failed', `Vorschaubild ${imageUrl} konnte nicht geprüft werden: ${error.message}`)
  }
}

function parseRobotDirectives(...values) {
  return new Set(values
    .filter(Boolean)
    .flatMap(value => value.toLowerCase().split(/[;,]/))
    .map(value => value.trim())
    .filter(Boolean))
}

async function checkRobots(result, pageUrl, agentResults, options) {
  const robotsUrl = new URL('/robots.txt', pageUrl).href
  try {
    const response = await fetchResource(robotsUrl, options, {
      accept: 'text/plain,*/*;q=0.1',
      maximumBytes: 512 * 1024,
      userAgent: userAgents[0].value,
      validateRedirect: nextUrl => !readOnlyNavigationConcern(nextUrl),
    })
    result.robots = {
      status: response.status,
      url: response.finalUrl,
    }

    if (response.status === 404) {
      addIssue(result, 'warning', 'robots-missing', `robots.txt fehlt unter ${robotsUrl}; Crawler und KI-Trainingstokens sind dadurch nicht blockiert.`)
    }
    else if (response.status < 200 || response.status >= 300) {
      addIssue(result, 'warning', 'robots-http-status', `robots.txt antwortet mit HTTP ${response.status}.`)
      return
    }

    const robotsText = response.status === 404 ? '' : response.body.toString('utf8')
    const parser = robotsParser(response.finalUrl, robotsText)
    result.robots.policies = robotsPolicies.map((policy) => {
      const allowed = parser.isAllowed(pageUrl, policy.token) !== false
      if (!allowed && policy.category === 'social') {
        addIssue(result, 'error', 'crawler-blocked-by-robots', `${policy.label} wird durch robots.txt für ${pageUrl} blockiert.`)
      }
      else if (!allowed && ['ai-search', 'ai-user'].includes(policy.category)) {
        addIssue(
          result,
          'warning',
          'ai-discovery-blocked-by-robots',
          `${policy.label} wird durch robots.txt blockiert; das kann KI-Sichtbarkeit oder nutzerinitiierte Abrufe verhindern.`,
        )
      }

      return {
        allowed,
        category: policy.category,
        documentation: policy.documentation,
        key: policy.key,
        label: policy.label,
        productTokenOnly: policy.productTokenOnly || false,
        robotsMayNotApply: policy.robotsMayNotApply || false,
        sourceVerification: policy.sourceVerification,
        token: policy.token,
      }
    })
  }
  catch (error) {
    addIssue(result, 'warning', 'robots-fetch-failed', `robots.txt konnte nicht geprüft werden: ${error.message}`)
  }

  for (const agentResult of agentResults) {
    const directives = parseRobotDirectives(
      agentResult.headers['x-robots-tag'],
      ...(agentResult.metadata.metadata.robots || []),
    )
    for (const directive of ['noindex', 'noimageindex']) {
      if (directives.has(directive)) {
        addIssue(result, 'warning', 'crawler-robots-directive', `${agentResult.label} erhält die Robots-Anweisung ${directive}.`)
      }
    }
  }
}

async function inspectPage(inputUrl, options) {
  const result = {
    agents: [],
    images: [],
    issues: [],
    requestedUrl: inputUrl,
  }
  const successfulAgents = []

  for (const agent of userAgents) {
    try {
      const response = await fetchResource(inputUrl, options, {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        maximumBytes: options.maxHtmlBytes,
        userAgent: agent.value,
        validateRedirect: nextUrl => !readOnlyNavigationConcern(nextUrl),
      })
      const contentType = normalizeMimeType(response.headers['content-type'])
      const agentResult = {
        contentType,
        finalUrl: response.finalUrl,
        headers: response.headers,
        key: agent.key,
        label: agent.label,
        redirects: response.redirects,
        status: response.status,
      }
      result.agents.push({
        contentType,
        finalUrl: response.finalUrl,
        key: agent.key,
        label: agent.label,
        redirects: response.redirects,
        status: response.status,
      })

      if (response.status < 200 || response.status >= 300) {
        addIssue(result, 'error', 'crawler-http-status', `${agent.label} erhält HTTP ${response.status}.`)
        continue
      }
      if (!['text/html', 'application/xhtml+xml'].includes(contentType)) {
        addIssue(result, 'error', 'crawler-content-type', `${agent.label} erhält ${contentType || 'keinen Content-Type'} statt HTML.`)
        continue
      }
      if (response.redirects.length > 1) {
        addIssue(result, 'warning', 'redirect-chain', `${agent.label} benötigt ${response.redirects.length} Weiterleitungen.`)
      }
      if (response.redirects.some(redirect => redirect.from.startsWith('https:') && redirect.to.startsWith('http:'))) {
        addIssue(result, 'error', 'https-downgrade', `${agent.label} wird von HTTPS auf HTTP weitergeleitet.`)
      }

      agentResult.metadata = extractHtmlMetadata(response.body.toString('utf8'))
      successfulAgents.push(agentResult)
    }
    catch (error) {
      addIssue(result, 'error', 'crawler-fetch-failed', `${agent.label} konnte die Seite nicht abrufen: ${error.message}`)
    }
  }

  const baseline = successfulAgents.find(agent => agent.key === 'browser') || successfulAgents[0]
  if (!baseline) {
    return result
  }

  result.finalUrl = baseline.finalUrl
  result.metadata = baseline.metadata
  const metadataSummary = checkMetadata(result, baseline.metadata, baseline.finalUrl, options)

  for (const candidate of successfulAgents.filter(agent => agent !== baseline)) {
    checkAgentParity(result, baseline, candidate, candidate.label)
  }

  await checkRobots(result, baseline.finalUrl, successfulAgents, options)

  const imageSources = new Map()
  for (const [source, value] of [
    ['og:image', metadataSummary.openGraphImage],
    ['twitter:image', metadataSummary.twitterImage],
  ]) {
    if (!value) {
      continue
    }
    try {
      const absoluteUrl = new URL(value).href
      imageSources.set(absoluteUrl, [...(imageSources.get(absoluteUrl) || []), source])
    }
    catch {
      // The metadata validation already reports the malformed URL.
    }
  }

  for (const [imageUrl, sources] of imageSources) {
    await checkImage(result, imageUrl, sources, baseline.metadata.metadata, options)
  }

  return result
}

async function discoverSitemapUrls(baseUrl, options) {
  const origin = new URL(baseUrl).origin
  const initialSitemap = options.sitemapUrl
    ? validateUrl(options.sitemapUrl, options, 'Sitemap-URL').href
    : new URL('/sitemap.xml', baseUrl).href
  const queue = [initialSitemap]
  const visitedSitemaps = new Set()
  const pages = []
  let skippedNavigation = 0
  let truncated = false

  while (queue.length > 0) {
    if (pages.length >= options.maxPages) {
      truncated = true
      break
    }
    if (visitedSitemaps.size >= options.maxSitemaps) {
      truncated = true
      break
    }
    const currentUrl = queue.shift()
    if (visitedSitemaps.has(currentUrl)) {
      continue
    }
    visitedSitemaps.add(currentUrl)

    const response = await fetchResource(currentUrl, options, {
      accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
      allowedOrigins: [origin],
      maximumBytes: 5 * 1024 * 1024,
      userAgent: userAgents[0].value,
      validateRedirect: nextUrl => !readOnlyNavigationConcern(nextUrl),
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Sitemap ${currentUrl} antwortet mit HTTP ${response.status}.`)
    }

    const sitemap = parseSitemapXml(response.body.toString('utf8'))
    for (const location of sitemap.locations) {
      const locationUrl = validateUrl(location, options, 'Sitemap-Eintrag')
      if (locationUrl.origin !== origin) {
        continue
      }
      if (readOnlyNavigationConcern(locationUrl)) {
        skippedNavigation += 1
        truncated = true
        continue
      }
      if (sitemap.kind === 'index') {
        if (!visitedSitemaps.has(locationUrl.href) && !queue.includes(locationUrl.href)) {
          queue.push(locationUrl.href)
        }
      }
      else if (!pages.includes(locationUrl.href)) {
        if (pages.length >= options.maxPages) {
          truncated = true
          break
        }
        pages.push(locationUrl.href)
      }
    }
  }

  return { pages, skippedNavigation, truncated }
}

function summarize(results, strict) {
  const issues = results.flatMap(result => result.issues)
  const errors = issues.filter(issue => issue.severity === 'error').length
  const warnings = issues.filter(issue => issue.severity === 'warning').length
  return {
    errors,
    failed: errors > 0 || (strict && warnings > 0),
    pages: results.length,
    warnings,
  }
}

function metadataUrlIsSecure(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  }
  catch {
    return false
  }
}

function createSocialAssertions(result) {
  const trainingPolicies = Array.isArray(result.robots?.policies)
    ? result.robots.policies.filter(policy => policy.category === 'ai-training')
    : []
  const subject = {
    allowedTrainingTokens: trainingPolicies.filter(policy => policy.allowed).length,
    blockedTrainingTokens: trainingPolicies.filter(policy => !policy.allowed).length,
    checkedAgents: result.agents.map(agent => agent.key),
    checkedImages: result.images.length,
    robotsPolicyReviewedAt,
    robotsPolicySourceSummary: robotsPolicySourceSummary(),
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
  const issueCodes = new Set(result.issues.map(issue => issue.code))
  const metadata = result.metadata?.metadata
  const canonicals = result.metadata?.canonicals || []

  let outcome
  if (!metadata) {
    outcome = 'inconclusive'
  }
  else {
    const requiredValuesAreSingle = requiredOpenGraphKeys.every(key => metadata[key]?.length === 1)
    const urlsAreSecure = ['og:url', 'og:image'].every(key => metadataUrlIsSecure(firstValue(metadata, key)))
    outcome = requiredValuesAreSingle && urlsAreSecure ? 'pass' : 'fail'
  }
  add('social.metadata.open-graph-complete', outcome, {
    fail: 'Mindestens eine geprüfte Seite besitzt keine eindeutigen OpenGraph-Pflichtfelder oder verwendet für og:url beziehungsweise og:image keine absolute HTTPS-URL.',
    inconclusive: 'Die OpenGraph-Pflichtfelder konnten nicht aus einem erfolgreichen serverseitigen HTML-Abruf ausgewertet werden.',
    pass: 'Die geprüfte Seite besitzt eindeutige OpenGraph-Pflichtfelder mit absoluten HTTPS-URLs für og:url und og:image.',
  }[outcome])

  if (!metadata) {
    outcome = 'inconclusive'
  }
  else {
    const twitterCard = firstValue(metadata, 'twitter:card')
    const cardIsValid = ['app', 'player', 'summary', 'summary_large_image'].includes(twitterCard)
    const fallbackFieldsArePresent = [
      ['twitter:title', 'og:title'],
      ['twitter:description', 'og:description'],
      ['twitter:image', 'og:image'],
    ].every(([twitterKey, fallbackKey]) => firstValue(metadata, twitterKey) || firstValue(metadata, fallbackKey))
    const imageUrl = firstValue(metadata, 'twitter:image') || firstValue(metadata, 'og:image')
    outcome = cardIsValid && fallbackFieldsArePresent && metadataUrlIsSecure(imageUrl) ? 'pass' : 'fail'
  }
  add('social.metadata.twitter-card-valid', outcome, {
    fail: 'twitter:card oder die erforderlichen X-/Twitter-Werte beziehungsweise OpenGraph-Fallbacks sind unvollständig oder das Bild verwendet keine absolute HTTPS-URL.',
    inconclusive: 'Die X-/Twitter-Metadaten konnten nicht aus einem erfolgreichen serverseitigen HTML-Abruf ausgewertet werden.',
    pass: 'twitter:card sowie die erforderlichen X-/Twitter-Werte oder OpenGraph-Fallbacks sind technisch verwendbar.',
  }[outcome])

  if (!metadata || !result.finalUrl) {
    outcome = 'inconclusive'
  }
  else {
    const canonical = canonicals.length === 1 ? canonicals[0] : undefined
    const openGraphUrls = metadata['og:url'] || []
    const openGraphUrl = openGraphUrls.length === 1 ? openGraphUrls[0] : undefined
    outcome = canonical
      && openGraphUrl
      && normalizeComparableUrl(canonical) === normalizeComparableUrl(result.finalUrl)
      && normalizeComparableUrl(canonical) === normalizeComparableUrl(openGraphUrl)
      ? 'pass'
      : 'fail'
    if (outcome === 'pass' && result.coverage?.truncated) {
      outcome = 'inconclusive'
    }
  }
  add('social.metadata.canonical-open-graph-consistent', outcome, {
    fail: 'Canonical, finale Seiten-URL und og:url sind nicht eindeutig oder stimmen nicht überein.',
    inconclusive: 'Canonical-/OpenGraph-Konsistenz konnte wegen fehlender Antworten oder begrenzter Seitenabdeckung nicht abschließend ausgewertet werden.',
    pass: 'Canonical, finale Seiten-URL und og:url sind eindeutig und stimmen überein.',
  }[outcome])

  const expectedAgents = userAgents.map(agent => agent.key)
  if (!expectedAgents.every(key => result.agents.some(agent => agent.key === key))) {
    outcome = 'inconclusive'
  }
  else {
    const responsesAreHtml = result.agents.every(agent => agent.status >= 200
      && agent.status < 300
      && ['text/html', 'application/xhtml+xml'].includes(agent.contentType))
    const parityIssues = [
      'crawler-final-url-mismatch',
      'crawler-metadata-difference',
      'crawler-missing-metadata',
      'conflicting-metadata',
      'duplicate-metadata',
      'https-downgrade',
      'redirect-chain',
    ]
    outcome = responsesAreHtml && !parityIssues.some(code => issueCodes.has(code)) ? 'pass' : 'fail'
  }
  add('social.crawlers.html-metadata-consistent', outcome, {
    fail: 'Mindestens ein Social-Crawler erhält keine erfolgreiche HTML-Antwort, eine abweichende finale URL, abweichende Metadaten oder eine ungeeignete Weiterleitung.',
    inconclusive: 'Nicht alle vorgesehenen Browser- und Social-Crawler-Abrufe konnten ausgewertet werden.',
    pass: 'Browser, Facebook, X/Twitter und LinkedIn erhalten erfolgreiche, konsistente HTML-Antworten und Social-Metadaten.',
  }[outcome])

  const imageFailureCodes = [
    'declared-image-height-mismatch',
    'declared-image-type-mismatch',
    'declared-image-width-mismatch',
    'image-aspect-ratio',
    'image-content-type',
    'image-dimensions-missing',
    'image-file-size',
    'image-http-status',
    'image-mime-mismatch',
    'image-small',
    'missing-image-alt',
    'missing-twitter-image-alt',
  ]
  if (imageFailureCodes.some(code => issueCodes.has(code)) || result.images.length === 0) {
    outcome = 'fail'
  }
  else if (issueCodes.has('image-fetch-failed') || result.images.some(image => !image.status)) {
    outcome = 'inconclusive'
  }
  else {
    outcome = 'pass'
  }
  add('social.images.preview-technically-valid', outcome, {
    fail: 'Mindestens ein vorgesehenes Vorschaubild fehlt oder verletzt die geprüften Anforderungen an Abruf, MIME-Typ, Dateigröße, Pixelmaße, Seitenverhältnis, Deklarationen oder Alternativtext.',
    inconclusive: 'Mindestens ein Vorschaubild konnte nicht vollständig abgerufen oder ausgewertet werden.',
    pass: 'Die vorgesehenen Vorschaubilder erfüllen die geprüften technischen Anforderungen.',
  }[outcome])

  if (!result.robots) {
    outcome = 'inconclusive'
  }
  else {
    outcome = result.robots.status >= 200 && result.robots.status < 300 ? 'pass' : 'fail'
  }
  add('social.robots.file-retrievable', outcome, {
    fail: 'robots.txt antwortet nicht erfolgreich.',
    inconclusive: 'robots.txt konnte nicht belastbar abgerufen werden.',
    pass: 'robots.txt wurde erfolgreich abgerufen und ausgewertet.',
  }[outcome])

  const policies = result.robots?.policies
  if (!Array.isArray(policies) || policies.length !== robotsPolicies.length) {
    outcome = 'inconclusive'
  }
  else {
    const socialPolicies = policies.filter(policy => policy.category === 'social')
    outcome = socialPolicies.length > 0
      && socialPolicies.every(policy => policy.allowed)
      && !issueCodes.has('crawler-robots-directive')
      ? 'pass'
      : 'fail'
  }
  add('social.robots.social-crawlers-allowed', outcome, {
    fail: 'Mindestens ein vorgesehener Social-Crawler ist durch robots.txt oder eine Robots-Anweisung blockiert.',
    inconclusive: 'Die Regeln für die vorgesehenen Social-Crawler konnten nicht vollständig ausgewertet werden.',
    pass: 'Die vorgesehenen Social-Crawler sind für die geprüfte Seite nicht durch robots.txt oder Robots-Anweisungen blockiert.',
  }[outcome])

  if (!Array.isArray(policies) || policies.length !== robotsPolicies.length) {
    outcome = 'inconclusive'
  }
  else {
    const policiesByKey = new Map(policies.map(policy => [policy.key, policy]))
    outcome = robotsPolicies.every((policy) => {
      const reportedPolicy = policiesByKey.get(policy.key)
      return reportedPolicy?.documentation.startsWith('https://')
        && reportedPolicy.sourceVerification === 'currentOfficial'
    })
      ? 'pass'
      : 'inconclusive'
  }
  add('social.robots.policy-matrix-recorded', outcome, {
    inconclusive: 'Crawler-/Produktkennungen und Quellenstand sind dokumentiert, aber mindestens ein Token besitzt keine aktuelle offizielle Quelle, die den Token ausdrücklich bestätigt.',
    pass: 'Crawler-/Produktkennungen, Kategorien, erlaubte und blockierte Trainings-/Datennutzungstokens, aktuelle offizielle Quellen und Quellenstand sind im technischen Bericht dokumentiert. Ob die beobachtete Policy der freigegebenen Betreiberentscheidung entspricht, bleibt manuell zu prüfen.',
  }[outcome])

  return assertions
}

function signalSummary(results) {
  return technicalSignalSummary(technicalSignals(results.flatMap(result => result.assertions || createSocialAssertions(result)), 'social-preview-check'))
}

function compactMetadata(metadataResult) {
  if (!metadataResult) {
    return undefined
  }
  return {
    canonical: metadataResult.canonicals[0],
    openGraph: Object.fromEntries(
      Object.entries(metadataResult.metadata)
        .filter(([key]) => key.startsWith('og:'))
        .map(([key, values]) => [key, values.length === 1 ? values[0] : values]),
    ),
    twitter: Object.fromEntries(
      Object.entries(metadataResult.metadata)
        .filter(([key]) => key.startsWith('twitter:'))
        .map(([key, values]) => [key, values.length === 1 ? values[0] : values]),
    ),
  }
}

export function createJsonReport(results, options) {
  const compactResults = results.map(result => ({
    agents: result.agents,
    coverage: result.coverage,
    signals: technicalSignals(result.assertions || createSocialAssertions(result), 'social-preview-check'),
    finalUrl: result.finalUrl,
    images: result.images,
    issues: result.issues,
    metadata: compactMetadata(result.metadata),
    requestedUrl: result.requestedUrl,
    robots: result.robots,
  }))
  const reportedResults = redactReportData(compactResults, '', { hideHosts: options.allowPrivate })
  for (let index = 0; index < reportedResults.length; index += 1) {
    const parameterNames = reportUrl(results[index].requestedUrl).parameterNames
    if (parameterNames.length > 0) {
      reportedResults[index].requestedUrlParameterNames = parameterNames
    }
  }
  return {
    checklist: checklistReference(),
    generatedAt: new Date().toISOString(),
    options: {
      maxPages: options.maxPages,
      maxRedirects: options.maxRedirects,
      maxSitemaps: options.maxSitemaps,
      privateTargetsRedacted: Boolean(options.allowPrivate),
      sitemap: options.sitemap,
      sitemapUrl: redactReportData(options.sitemapUrl, 'sitemapUrl'),
      strict: options.strict,
      timeoutMilliseconds: options.timeoutMilliseconds,
    },
    privateTargetsRedacted: Boolean(options.allowPrivate),
    readOnlyGuarantees: {
      browserInteractions: false,
      buttonsActivated: false,
      formActionsFetched: false,
      formsSubmitted: false,
      methods: ['GET'],
    },
    results: reportedResults,
    robotsPolicyReviewedAt,
    robotsPolicySourceSummary: robotsPolicySourceSummary(),
    schemaVersion: 2,
    summary: summarize(reportedResults, options.strict),
    tool: 'social-preview-check',
    toolPackage: { name: packageName, version: packageVersion },
  }
}

function printText(results, options) {
  console.log(`${packageName} ${packageVersion}`)
  for (const result of results) {
    console.log(`\n=== ${result.requestedUrl} ===`)
    if (result.agents.length > 0) {
      console.log(`Crawler: ${result.agents.map(agent => `${agent.label}=HTTP ${agent.status}`).join(', ')}`)
    }
    if (result.metadata) {
      const metadata = result.metadata.metadata
      console.log(`OpenGraph: ${requiredOpenGraphKeys.map(key => `${key}=${firstValue(metadata, key) ? 'ok' : 'fehlt'}`).join(', ')}`)
      console.log(`Twitter/X: card=${firstValue(metadata, 'twitter:card') || 'fehlt'}, title=${firstValue(metadata, 'twitter:title') ? 'ok' : 'Fallback'}, description=${firstValue(metadata, 'twitter:description') ? 'ok' : 'Fallback'}, image=${firstValue(metadata, 'twitter:image') ? 'ok' : 'Fallback'}`)
    }
    for (const image of result.images) {
      const dimensions = image.width && image.height ? `${image.width}×${image.height}` : 'Abmessungen unbekannt'
      console.log(`Bild: HTTP ${image.status ?? 'Fehler'}, ${image.contentType || 'Typ unbekannt'}, ${dimensions}, ${image.bytes ?? 0} Bytes`)
    }
    if (result.robots?.policies) {
      for (const [category, label] of Object.entries(robotsCategoryLabels)) {
        const policies = result.robots.policies.filter(policy => policy.category === category)
        console.log(`Robots ${label}: ${policies.map(policy => `${policy.label}=${policy.allowed ? 'erlaubt' : 'blockiert'}${policy.productTokenOnly ? ' (Produkttoken)' : ''}${policy.robotsMayNotApply ? ' (nutzerinitiiert)' : ''}`).join(', ')}`)
      }
    }
    if (result.issues.length === 0) {
      console.log('OK: Keine Fehler oder Warnungen.')
    }
    else {
      for (const issue of result.issues) {
        console.log(`${issue.severity === 'error' ? 'FEHLER' : 'WARNUNG'} [${issue.code}]: ${issue.message}`)
      }
    }
  }

  const summary = summarize(results, options.strict)
  const signals = signalSummary(results)
  console.log(`\nTechnische Signale: ${signals.positive} positiv, ${signals.defect} Defekt(e), ${signals.inconclusive} unklar, ${signals.notApplicable} nicht anwendbar.`)
  console.log('Checklistenreferenzen dienen nur der manuellen QA-Arbeit und ändern keinen Checklistenstatus.')
  console.log('KI-Training/Datennutzung: beobachtete robots.txt-Regeln werden dokumentiert, aber nicht als Freigabeentscheidung bewertet.')
  const sourceSummary = robotsPolicySourceSummary()
  console.log(`Robots-Matrix: ${robotsPolicies.length} Kennungen, Quellenstand ${robotsPolicyReviewedAt}; ${sourceSummary.currentOfficial} aktuell offiziell, ${sourceSummary.officialContextOnly} nur offizieller Kontext, ${sourceSummary.historicalRedirect} historischer Redirect.`)
  console.log(`Ergebnis: ${summary.pages} Seite(n), ${summary.errors} Fehler, ${summary.warnings} Warnung(en).`)
  if (summary.failed) {
    console.log(options.strict && summary.errors === 0
      ? 'TECHNISCHER LAUF MIT STRICT-RELEVANTEN WARNUNGEN.'
      : 'TECHNISCHER LAUF MIT FEHLERBEFUND.')
  }
  else {
    console.log('TECHNISCHER LAUF OHNE FEHLERBEFUND.')
  }
}

export async function runSocialPreviewCheck(inputUrls, options = {}) {
  const mergedOptions = { ...defaultOptions, ...options }
  const validatedInputs = inputUrls.map(value => validateUrl(value, mergedOptions).href)
  let urls = [...validatedInputs]
  let sitemapCoverageTruncated = false
  let sitemapSkippedNavigation = 0

  if (mergedOptions.sitemap) {
    for (const input of validatedInputs) {
      const discovered = await discoverSitemapUrls(input, mergedOptions)
      urls.push(...discovered.pages)
      sitemapCoverageTruncated ||= discovered.truncated
      sitemapSkippedNavigation += discovered.skippedNavigation
    }
  }

  const discoveredUrls = [...new Set(urls)]
  urls = discoveredUrls.slice(0, mergedOptions.maxPages)
  const results = []
  for (const url of urls) {
    const result = await inspectPage(url, mergedOptions)
    result.coverage = {
      discoveredPages: discoveredUrls.length,
      selectedPages: urls.length,
      skippedNavigation: sitemapSkippedNavigation,
      truncated: sitemapCoverageTruncated || discoveredUrls.length > urls.length,
    }
    result.assertions = createSocialAssertions(result)
    results.push(result)
  }

  return {
    options: mergedOptions,
    results,
    summary: summarize(results, mergedOptions.strict),
  }
}

async function main() {
  const outputIntent = jsonOutputIntent(process.argv.slice(2))
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

    const report = await runSocialPreviewCheck(urls, options)
    if (options.json) {
      const output = createJsonReport(report.results, options)
      if (options.jsonFile) {
        writeJsonOutput(options.jsonFile, output)
      }
      else {
        console.log(JSON.stringify(output, null, 2))
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
    const errorReport = technicalErrorReport('social-preview-check', redactText(error.message))
    if (outputIntent.json || parsed?.options?.json) {
      const jsonFile = parsed?.options?.jsonFile || outputIntent.jsonFile
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
      console.error(`Fehler: ${redactText(error.message)}`)
    }
    process.exitCode = 2
  }
}

if (isMainModule(import.meta.url)) {
  await main()
}
