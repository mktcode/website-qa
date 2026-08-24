/* oxlint-disable no-await-in-loop */

import { Buffer } from 'node:buffer'
import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

const redirectStatuses = new Set([301, 302, 303, 307, 308])

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

function mappedIpv4(address) {
  const match = address.toLowerCase().match(/^(?:::ffff:)?(\d+\.\d+\.\d+\.\d+)$/)
  return match?.[1]
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
    || normalized.startsWith('ff')
    || normalized === '2001:db8::'
    || normalized.startsWith('2001:db8:')
}

function isPrivateHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    return true
  }

  return isIP(normalized) > 0 && isNonPublicIp(normalized)
}

export function validateUrl(value, options, context = 'URL') {
  let url
  try {
    url = new URL(value)
  }
  catch {
    throw new Error(`${context} ist ungültig: ${value}`)
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${context} muss HTTP oder HTTPS verwenden: ${value}`)
  }
  if (url.username || url.password) {
    throw new Error(`${context} darf keine Zugangsdaten enthalten: ${value}`)
  }
  if (url.protocol === 'http:' && !options.allowHttp) {
    throw new Error(`${context} verwendet HTTP. Nur mit --allow-http zulassen: ${value}`)
  }
  if (isPrivateHostname(url.hostname) && !options.allowPrivate) {
    throw new Error(`${context} verweist auf ein privates Ziel. Nur mit --allow-private zulassen: ${value}`)
  }

  url.hash = ''
  return url
}

export async function assertPublicResolution(url, options) {
  if (options.allowPrivate || isIP(url.hostname) > 0) {
    return
  }

  let addresses
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true })
  }
  catch (error) {
    throw new Error(`DNS-Auflösung für ${url.hostname} fehlgeschlagen: ${error.message}`, { cause: error })
  }

  if (addresses.length === 0) {
    throw new Error(`DNS-Auflösung für ${url.hostname} lieferte keine Adresse.`)
  }

  const nonPublicAddress = addresses.find(result => isNonPublicIp(result.address))
  if (nonPublicAddress) {
    throw new Error(`Abrufziel ${url.hostname} löst auf eine nicht öffentliche Adresse auf.`)
  }
}

function normalizedHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [
    name.toLowerCase(),
    Array.isArray(value) ? value.join(', ') : value || '',
  ]))
}

async function requestOnce(url, options, request) {
  await assertPublicResolution(url, options)

  const transport = url.protocol === 'https:' ? https : http
  const maximumBytes = request.maximumBytes || options.maxHtmlBytes || 2 * 1024 * 1024

  return new Promise((resolve, reject) => {
    const clientRequest = transport.request(url, {
      headers: {
        'accept': request.accept || '*/*',
        'user-agent': request.userAgent || 'WebsiteQualityCheck/1.0',
        ...request.headers,
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

    clientRequest.setTimeout(options.timeoutMilliseconds, () => {
      clientRequest.destroy(new Error(`Abruf von ${url.href} überschritt ${options.timeoutMilliseconds} ms.`))
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
        throw new Error(`HTTP ${response.status} ohne Location-Header bei ${currentUrl}`)
      }
      if (redirectCount === options.maxRedirects) {
        throw new Error(`Mehr als ${options.maxRedirects} Weiterleitungen ab ${input}`)
      }

      const nextUrl = validateUrl(new URL(location, currentUrl).href, options, 'Weiterleitungsziel')
      if (request.allowedOrigins && !request.allowedOrigins.includes(nextUrl.origin)) {
        throw new Error(`Weiterleitungsziel ${nextUrl.origin} liegt außerhalb der erlaubten Origins.`)
      }
      if (request.validateRedirect && request.validateRedirect(nextUrl, currentUrl) === false) {
        throw new Error(`Weiterleitungsziel ${nextUrl.href} wurde durch die Nur-Lese-Richtlinie abgelehnt.`)
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

  throw new Error(`Weiterleitungslimit ab ${input} überschritten.`)
}

export function normalizeMimeType(value) {
  return value?.split(';')[0].trim().toLowerCase().replace('image/jpg', 'image/jpeg')
}
