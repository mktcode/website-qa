#!/usr/bin/env node

/* eslint-disable no-console */
/* oxlint-disable no-await-in-loop */

import { fileTypeFromBuffer } from 'file-type'
import { parse } from 'parse5'
import robotsParser from 'robots-parser'
import sharp from 'sharp'
import { fetchResource, normalizeMimeType, redactReportData, redactText, validateUrl } from './lib/http-client.mjs'
import { writeJsonOutput } from './lib/json-output.mjs'
import { isMainModule, packageName, packageVersion } from './lib/package-info.mjs'

const defaultOptions = {
  aiTrainingOptIn: false,
  allowHttp: false,
  allowPrivate: false,
  json: false,
  jsonFile: undefined,
  maxHtmlBytes: 2 * 1024 * 1024,
  maxImageBytes: 10 * 1024 * 1024,
  maxPages: 50,
  maxRedirects: 5,
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

export const robotsPolicyReviewedAt = '2026-08-22'

export const robotsPolicies = [
  {
    category: 'social',
    documentation: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/',
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
    documentation: 'https://platform.openai.com/docs/bots',
    key: 'openai-search',
    label: 'OAI-SearchBot',
    token: 'OAI-SearchBot',
  },
  {
    category: 'ai-user',
    documentation: 'https://platform.openai.com/docs/bots',
    key: 'openai-user',
    label: 'ChatGPT-User',
    robotsMayNotApply: true,
    token: 'ChatGPT-User',
  },
  {
    category: 'ai-training',
    documentation: 'https://platform.openai.com/docs/bots',
    key: 'openai-training',
    label: 'GPTBot',
    token: 'GPTBot',
  },
  {
    category: 'ai-search',
    documentation: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
    key: 'anthropic-search',
    label: 'Claude-SearchBot',
    token: 'Claude-SearchBot',
  },
  {
    category: 'ai-user',
    documentation: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
    key: 'anthropic-user',
    label: 'Claude-User',
    token: 'Claude-User',
  },
  {
    category: 'ai-training',
    documentation: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
    key: 'anthropic-training',
    label: 'ClaudeBot',
    token: 'ClaudeBot',
  },
  {
    category: 'ai-search',
    documentation: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers',
    key: 'google-search',
    label: 'Googlebot (Search/Gemini-Grounding)',
    token: 'Googlebot',
  },
  {
    category: 'ai-search',
    documentation: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers',
    key: 'google-vertex',
    label: 'Google-CloudVertexBot',
    token: 'Google-CloudVertexBot',
  },
  {
    category: 'ai-training',
    documentation: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers',
    key: 'google-extended',
    label: 'Google-Extended',
    productTokenOnly: true,
    token: 'Google-Extended',
  },
  {
    category: 'ai-search',
    documentation: 'https://blogs.bing.com/webmaster/september-2025/Introducing-new-publishing-controls-for-Bing-Search-and-Copilot',
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
    documentation: 'https://docs.perplexity.ai/guides/bots',
    key: 'perplexity-search',
    label: 'PerplexityBot',
    token: 'PerplexityBot',
  },
  {
    category: 'ai-user',
    documentation: 'https://docs.perplexity.ai/guides/bots',
    key: 'perplexity-user',
    label: 'Perplexity-User',
    robotsMayNotApply: true,
    token: 'Perplexity-User',
  },
  {
    category: 'ai-user',
    documentation: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/',
    key: 'meta-fetcher',
    label: 'Meta-ExternalFetcher',
    robotsMayNotApply: true,
    token: 'meta-externalfetcher',
  },
  {
    category: 'ai-training',
    documentation: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/',
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
  return `Social-Metadaten und Vorschaubilder gegen öffentliche URLs prüfen.

Aufruf:
  website-qa-social <URL> [weitere URL ...] [Optionen]

Optionen:
  --json                 Maschinenlesbare JSON-Ausgabe auf stdout
  --json-file=<Pfad>     JSON atomar in eine lokale Datei schreiben
  --strict               Warnungen führen ebenfalls zu Exitcode 1
  --ai-training-opt-in   Dokumentierte ausdrückliche KI-Trainingsfreigabe bestätigen
                         (ändert robots.txt nicht; unterdrückt nur diese Warnung)
  --sitemap              Zusätzlich URLs aus /sitemap.xml prüfen
  --sitemap-url=<URL>    Abweichende Sitemap-URL verwenden
  --max-pages=<Anzahl>   Höchstens so viele Seiten prüfen (Standard: 50)
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
    else if (argument === '--ai-training-opt-in') {
      options.aiTrainingOptIn = true
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

function addIssue(result, severity, code, message) {
  result.issues.push({ code, message, severity })
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
    const response = await fetchResource(imageUrl, options, {
      accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/svg+xml,image/*;q=0.8,*/*;q=0.1',
      maximumBytes: options.maxImageBytes,
      userAgent: userAgents.find(agent => agent.key === 'facebook').value,
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
        token: policy.token,
      }
    })

    const allowedTrainingPolicies = result.robots.policies
      .filter(policy => policy.category === 'ai-training' && policy.allowed)
    if (allowedTrainingPolicies.length > 0 && !options.aiTrainingOptIn) {
      addIssue(
        result,
        'warning',
        'ai-training-opt-in-missing',
        `KI-Training/Datennutzung ist für ${allowedTrainingPolicies.map(policy => policy.label).join(', ')} nicht per robots.txt ausgeschlossen. Standardmäßig wird ein Opt-out erwartet; eine Freigabe muss ausdrücklich dokumentiert sein. --ai-training-opt-in bestätigt nur diese Prüfentscheidung und ändert robots.txt nicht.`,
      )
    }
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

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', '\'')
}

function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map(match => decodeXml(match[1].trim()))
    .filter(Boolean)
}

async function discoverSitemapUrls(baseUrl, options) {
  const origin = new URL(baseUrl).origin
  const initialSitemap = options.sitemapUrl
    ? validateUrl(options.sitemapUrl, options, 'Sitemap-URL').href
    : new URL('/sitemap.xml', baseUrl).href
  const queue = [{ depth: 0, url: initialSitemap }]
  const visitedSitemaps = new Set()
  const pages = []

  while (queue.length > 0 && pages.length < options.maxPages) {
    const current = queue.shift()
    if (visitedSitemaps.has(current.url)) {
      continue
    }
    visitedSitemaps.add(current.url)

    const response = await fetchResource(current.url, options, {
      accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
      maximumBytes: 5 * 1024 * 1024,
      userAgent: userAgents[0].value,
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Sitemap ${current.url} antwortet mit HTTP ${response.status}.`)
    }

    const xml = response.body.toString('utf8')
    const isIndex = /<sitemapindex\b/i.test(xml)
    for (const location of sitemapLocations(xml)) {
      const locationUrl = validateUrl(location, options, 'Sitemap-Eintrag')
      if (locationUrl.origin !== origin) {
        continue
      }
      if (isIndex && current.depth < 2) {
        queue.push({ depth: current.depth + 1, url: locationUrl.href })
      }
      else if (!pages.includes(locationUrl.href)) {
        pages.push(locationUrl.href)
        if (pages.length >= options.maxPages) {
          break
        }
      }
    }
  }

  return pages
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
  return redactReportData({
    generatedAt: new Date().toISOString(),
    results: results.map(result => ({
      agents: result.agents,
      finalUrl: result.finalUrl,
      images: result.images,
      issues: result.issues,
      metadata: compactMetadata(result.metadata),
      requestedUrl: result.requestedUrl,
      robots: result.robots,
    })),
    aiTrainingOptIn: options.aiTrainingOptIn,
    privateTargetsRedacted: Boolean(options.allowPrivate),
    robotsPolicyReviewedAt,
    summary: summarize(results, options.strict),
    tool: 'social-preview-check',
    toolPackage: { name: packageName, version: packageVersion },
  }, '', { hideHosts: options.allowPrivate })
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
  console.log(`\nKI-Trainingsfreigabe: ${options.aiTrainingOptIn ? 'ausdrücklich für diese Prüfung bestätigt' : 'nicht bestätigt; Opt-out wird standardmäßig erwartet'}.`)
  console.log(`Robots-Matrix: ${robotsPolicies.length} Kennungen, Quellenstand ${robotsPolicyReviewedAt}.`)
  console.log(`Ergebnis: ${summary.pages} Seite(n), ${summary.errors} Fehler, ${summary.warnings} Warnung(en).`)
  if (summary.failed) {
    console.log(options.strict && summary.errors === 0
      ? 'NICHT BESTANDEN: --strict wertet Warnungen als Fehler.'
      : 'NICHT BESTANDEN.')
  }
  else {
    console.log('BESTANDEN.')
  }
}

export async function runSocialPreviewCheck(inputUrls, options = {}) {
  const mergedOptions = { ...defaultOptions, ...options }
  const validatedInputs = inputUrls.map(value => validateUrl(value, mergedOptions).href)
  let urls = [...validatedInputs]

  if (mergedOptions.sitemap) {
    for (const input of validatedInputs) {
      const discovered = await discoverSitemapUrls(input, mergedOptions)
      urls.push(...discovered)
    }
  }

  urls = [...new Set(urls)].slice(0, mergedOptions.maxPages)
  const results = []
  for (const url of urls) {
    results.push(await inspectPage(url, mergedOptions))
  }

  return {
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
    const errorReport = {
      error: redactText(error.message),
      robotsPolicyReviewedAt,
      summary: { errors: 1, failed: true, pages: 0, warnings: 0 },
      tool: 'social-preview-check',
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
