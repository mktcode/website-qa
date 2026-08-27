import { XMLParser, XMLValidator } from 'fast-xml-parser'

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
