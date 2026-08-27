/* oxlint-disable no-await-in-loop */

import { Buffer } from 'node:buffer'
import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

const redirectStatuses = new Set([301, 302, 303, 307, 308])
const urlFieldNames = new Set([
  'action',
  'canonical',
  'finalurl',
  'from',
  'helpurl',
  'href',
  'location',
  'pageurl',
  'preferredurl',
  'requestedurl',
  'sourceurl',
  'targeturl',
  'to',
  'url',
])

function isNonPublicIpv4(address) {
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true
  }

  const [first, second, third] = octets
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0 && third === 0)
    || (first === 192 && second === 0 && third === 2)
    || (first === 192 && second === 168)
    || (first === 198 && second >= 18 && second <= 19)
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
    || first >= 224
}

function ipv6Groups(address) {
  let normalized = address.toLowerCase()
  const dottedSuffix = normalized.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  if (dottedSuffix) {
    const octets = dottedSuffix.split('.').map(Number)
    if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return undefined
    }
    normalized = `${normalized.slice(0, -dottedSuffix.length)}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`
  }

  const halves = normalized.split('::')
  if (halves.length > 2) {
    return undefined
  }
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const missing = 8 - left.length - right.length
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) {
    return undefined
  }

  const groups = [...left, ...Array.from({ length: missing }).fill('0'), ...right]
  if (groups.length !== 8 || groups.some(group => !/^[\da-f]{1,4}$/.test(group))) {
    return undefined
  }
  return groups.map(group => Number.parseInt(group, 16))
}

function mappedIpv4(address) {
  if (isIP(address) === 4) {
    return address
  }
  if (isIP(address) !== 6) {
    return undefined
  }

  const groups = ipv6Groups(address)
  if (!groups || groups.slice(0, 5).some(group => group !== 0) || groups[5] !== 65_535) {
    return undefined
  }
  return [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join('.')
}

function isNonPublicIp(address) {
  const ipv4 = mappedIpv4(address)
  if (ipv4) {
    return isNonPublicIpv4(ipv4)
  }

  if (isIP(address) !== 6) {
    return true
  }

  const normalized = address.toLowerCase()
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || /^fe[89ab]/.test(normalized)
    || /^fe[c-f]/.test(normalized)
    || normalized.startsWith('ff')
    || normalized === '2001:db8::'
    || normalized.startsWith('2001:db8:')
}

export function normalizedHostname(hostname) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '')
}

function isPrivateHostname(hostname) {
  const normalized = normalizedHostname(hostname)
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    return true
  }

  return isIP(normalized) > 0 && isNonPublicIp(normalized)
}

export function reportUrl(value, options = {}) {
  try {
    const url = new URL(value)
    const parameterNames = [...new Set([...url.searchParams.keys()].map(name => name.slice(0, 100)))].slice(0, 100)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { parameterNames: [], url: `(${url.protocol.slice(0, -1)}-URL redigiert)`.slice(0, 2048) }
    }
    if (options.hideHosts || isPrivateHostname(url.hostname)) {
      return { parameterNames, url: '(privates/lokales Ziel)' }
    }
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return {
      parameterNames,
      url: url.href.slice(0, 2048),
    }
  }
  catch {
    return { parameterNames: [], url: '(ungültige URL)' }
  }
}

function redactPath(value) {
  if (!String(value).startsWith('/')) {
    return undefined
  }
  try {
    const url = new URL(value, 'https://website-qa.invalid')
    return url.pathname.slice(0, 2048)
  }
  catch {
    return undefined
  }
}

export function redactText(value, maximumLength = 1000, options = {}) {
  return String(value)
    .replace(/https?:\/\/(?!\[)[^\s"')<>]+/gi, match => reportUrl(match, options).url)
    .replace(/\b(token|secret|password|authorization|code)=[^\s&,;]+/gi, '$1=[REDACTED]')
    .replace(/\bbearer\s+[\w.~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b[\w.!#$%&'*+/=?^`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, match => isNonPublicIp(match) ? '[REDACTED_PRIVATE_IP]' : match)
    .replace(/\[?(?:::1|f[cd][\da-f:]+|fe[89ab][\da-f:]+)\]?/gi, '[REDACTED_PRIVATE_IP]')
    .replace(/\b(?:localhost|[\w-]+(?:\.[\w-]+)*\.local)\b/gi, '[REDACTED_PRIVATE_HOST]')
    .slice(0, maximumLength)
}

function redactString(value, key, options) {
  if (['(privates/lokales Ziel)', '(ungültige URL)'].includes(value)) {
    return value
  }
  const normalizedKey = String(key || '').toLowerCase()
  if (normalizedKey === 'targeturl' && value === 'matchedAgainstRedactedTechnicalReport') {
    return value
  }
  if (urlFieldNames.has(normalizedKey) || normalizedKey.endsWith('url')) {
    const path = redactPath(value)
    return path || reportUrl(value, options).url
  }
  if (normalizedKey === 'notfoundpath' || normalizedKey === 'sitemapurl') {
    return redactPath(value) || reportUrl(value, options).url
  }
  return redactText(value, 10_000, options)
}

export function redactReportData(value, key = '', options = {}) {
  if (typeof value === 'string') {
    return redactString(value, key, options)
  }
  if (Array.isArray(value)) {
    return value.map(item => redactReportData(item, key, options))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      redactReportData(entryValue, entryKey, options),
    ]))
  }
  return value
}

export function validateUrl(value, options, context = 'URL') {
  let url
  try {
    url = new URL(value)
  }
  catch {
    throw new Error(`${context} ist ungültig.`)
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${context} muss HTTP oder HTTPS verwenden.`)
  }
  if (url.username || url.password) {
    throw new Error(`${context} darf keine Zugangsdaten enthalten.`)
  }
  if (url.protocol === 'http:' && !options.allowHttp) {
    throw new Error(`${context} verwendet HTTP. Nur mit --allow-http zulassen: ${reportUrl(url.href).url}`)
  }
  if (isPrivateHostname(url.hostname) && !options.allowPrivate) {
    throw new Error(`${context} verweist auf ein privates Ziel. Nur mit --allow-private zulassen.`)
  }

  url.hash = ''
  return url
}

function remainingTimeout(options) {
  const configured = options.timeoutMilliseconds || 15_000
  if (!options.deadline) {
    return configured
  }
  const remaining = options.deadline - Date.now()
  if (remaining <= 0) {
    throw new Error(`Laufzeitlimit von ${configured} ms ist abgelaufen.`)
  }
  return Math.min(configured, remaining)
}

async function withNetworkDeadline(promise, options, label) {
  const milliseconds = remainingTimeout(options)
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} überschritt das verbleibende Laufzeitlimit.`)), milliseconds)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

export async function validatedResolution(url, options) {
  const hostname = normalizedHostname(url.hostname)
  if (isIP(hostname) > 0) {
    if (!options.allowPrivate && isNonPublicIp(hostname)) {
      throw new Error('Abrufziel verwendet eine nicht öffentliche Adresse.')
    }
    return [{ address: hostname, family: isIP(hostname) }]
  }

  let addresses
  try {
    addresses = await withNetworkDeadline(lookup(hostname, { all: true, verbatim: true }), options, 'DNS-Auflösung')
  }
  catch (error) {
    throw new Error(`DNS-Auflösung fehlgeschlagen: ${redactText(error.message)}`, { cause: error })
  }

  if (addresses.length === 0) {
    throw new Error(`DNS-Auflösung für ${hostname} lieferte keine Adresse.`)
  }
  if (!options.allowPrivate && addresses.some(result => isNonPublicIp(result.address))) {
    throw new Error('Abrufziel löst auf eine nicht öffentliche Adresse auf.')
  }
  return addresses
}

export async function assertPublicResolution(url, options) {
  await validatedResolution(url, options)
}

export async function chromiumHostResolverRule(url, options) {
  const resolutions = await validatedResolution(url, options)
  const pinnedResolution = resolutions.find(result => result.family === 4) || resolutions[0]
  const pinnedAddress = pinnedResolution.family === 6 ? `[${pinnedResolution.address}]` : pinnedResolution.address
  return `MAP ${normalizedHostname(url.hostname)} ${pinnedAddress}`
}

function normalizedHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [
    name.toLowerCase(),
    Array.isArray(value) ? value.join(', ') : value || '',
  ]))
}

async function requestOnce(url, options, request) {
  const resolutions = await validatedResolution(url, options)
  const pinnedResolution = resolutions.find(result => result.family === 4) || resolutions[0]
  const timeoutMilliseconds = remainingTimeout(options)

  const transport = url.protocol === 'https:' ? https : http
  const maximumBytes = request.maximumBytes || options.maxHtmlBytes || 2 * 1024 * 1024

  return new Promise((resolve, reject) => {
    const clientRequest = transport.request(url, {
      headers: {
        'accept': request.accept || '*/*',
        'user-agent': request.userAgent || 'WebsiteQualityCheck/1.0',
        ...request.headers,
      },
      lookup(_hostname, lookupOptions, callback) {
        if (lookupOptions?.all) {
          callback(null, [pinnedResolution])
        }
        else {
          callback(null, pinnedResolution.address, pinnedResolution.family)
        }
      },
      method: 'GET',
    }, (response) => {
      const declaredLength = Number(response.headers['content-length'])
      if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
        response.destroy()
        reject(new Error(`Antwort ist mit ${declaredLength} Bytes größer als das Limit von ${maximumBytes} Bytes.`))
        return
      }

      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > maximumBytes) {
          response.destroy(new Error(`Antwort überschreitet das Limit von ${maximumBytes} Bytes.`))
          return
        }
        chunks.push(Buffer.from(chunk))
      })
      response.on('end', () => {
        resolve({
          body: Buffer.concat(chunks, size),
          headers: normalizedHeaders(response.headers),
          status: response.statusCode || 0,
        })
      })
      response.on('error', reject)
    })

    clientRequest.setTimeout(timeoutMilliseconds, () => {
      clientRequest.destroy(new Error(`Abruf von ${reportUrl(url.href).url} überschritt das verbleibende Laufzeitlimit.`))
    })
    clientRequest.on('error', reject)
    clientRequest.end()
  })
}

export async function fetchResource(input, options, request = {}) {
  let currentUrl = validateUrl(input, options, 'Abruf-URL')
  const redirects = []

  for (let redirectCount = 0; redirectCount <= options.maxRedirects; redirectCount += 1) {
    // Redirects müssen nacheinander gegen dieselben Sicherheitsgrenzen geprüft werden.
    const response = await requestOnce(currentUrl, options, request)

    if (redirectStatuses.has(response.status)) {
      const location = response.headers.location
      if (!location) {
        throw new Error(`HTTP ${response.status} ohne Location-Header bei ${reportUrl(currentUrl.href).url}`)
      }
      if (redirectCount === options.maxRedirects) {
        throw new Error(`Mehr als ${options.maxRedirects} Weiterleitungen ab ${reportUrl(input).url}`)
      }

      const nextUrl = validateUrl(new URL(location, currentUrl).href, options, 'Weiterleitungsziel')
      if (request.allowedOrigins && !request.allowedOrigins.includes(nextUrl.origin)) {
        throw new Error(`Weiterleitungsziel ${nextUrl.origin} liegt außerhalb der erlaubten Origins.`)
      }
      if (request.validateRedirect && request.validateRedirect(nextUrl, currentUrl) === false) {
        throw new Error(`Weiterleitungsziel ${reportUrl(nextUrl.href).url} wurde durch die Nur-Lese-Richtlinie abgelehnt.`)
      }
      redirects.push({
        from: currentUrl.href,
        status: response.status,
        to: nextUrl.href,
      })
      currentUrl = nextUrl
      continue
    }

    return {
      ...response,
      finalUrl: currentUrl.href,
      redirects,
    }
  }

  throw new Error(`Weiterleitungslimit ab ${reportUrl(input).url} überschritten.`)
}

export function normalizeMimeType(value) {
  return value?.split(';')[0].trim().toLowerCase().replace('image/jpg', 'image/jpeg')
}
