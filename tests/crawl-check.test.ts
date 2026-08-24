import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createJsonReport,
  extractHtmlFacts,
  parseArguments,
  parseSitemapXml,
  runCrawlCheck,
} from '../src/check-crawl.mjs'

const servers = new Set<ReturnType<typeof createServer>>()

afterEach(async () => {
  await Promise.all([...servers].map(server => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
      }
      else {
        resolve()
      }
    })
  })))
  servers.clear()
})

function listen(server: ReturnType<typeof createServer>) {
  servers.add(server)
  return new Promise<string>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve(`http://127.0.0.1:${address.port}/`)
    })
  })
}

function htmlPage(origin: string, path: string, options: {
  body?: string
  canonical?: string
  description?: string
  noindex?: boolean
  title?: string
} = {}) {
  const title = options.title || `Seite ${path}`
  const description = options.description || `Eindeutige Beschreibung für ${path}`
  return `<!doctype html><html lang="de"><head>
    <title>${title}</title>
    <meta name="description" content="${description}">
    ${options.noindex ? '<meta name="robots" content="noindex, follow">' : ''}
    <link rel="canonical" href="${options.canonical || new URL(path, origin).href}">
  </head><body><h1>${title}</h1>${options.body || ''}</body></html>`
}

describe('crawl checker', () => {
  it('parses the read-only crawl options', () => {
    const parsed = parseArguments([
      'https://example.com/',
      '--sitemap',
      '--max-pages=25',
      '--max-resources=200',
      '--max-redirects=3',
      '--timeout=5000',
      '--json',
      '--strict',
    ])

    expect(parsed.urls).toEqual(['https://example.com/'])
    expect(parsed.options).toMatchObject({
      json: true,
      maxPages: 25,
      maxRedirects: 3,
      maxResources: 200,
      sitemap: true,
      strict: true,
      timeoutMilliseconds: 5000,
    })
  })

  it('parses XML sitemaps and rejects malformed XML', () => {
    const sitemap = parseSitemapXml(`<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/about</loc></url>
      </urlset>`)

    expect(sitemap).toEqual({
      kind: 'urlset',
      locations: ['https://example.com/', 'https://example.com/about'],
    })
    expect(parseSitemapXml('<urlset><url><loc>https://example.com/?a=1&amp;b=2</loc></url></urlset>').locations).toEqual(['https://example.com/?a=1&b=2'])
    expect(() => parseSitemapXml('<urlset><url></urlset>')).toThrow(/Ungültiges Sitemap-XML/)
  })

  it('extracts forms without treating their actions as navigation', () => {
    const facts = extractHtmlFacts(`<!doctype html><html lang="de"><body>
      <a href="/safe">Sicherer Link</a>
      <form action="/submit" method="post"><button type="submit">Senden</button></form>
    </body></html>`, 'https://example.com/')

    expect(facts.internalLinks).toEqual([{ fragment: '', url: 'https://example.com/safe' }])
    expect(facts.forms).toEqual([{ action: 'https://example.com/submit', method: 'POST' }])
  })

  it('crawls sitemap, pages and resources using GET without submitting forms or fetching external links', async () => {
    const requests: Array<{ method?: string, url?: string }> = []
    let origin = ''

    const server = createServer((request, response) => {
      requests.push({ method: request.method, url: request.url })
      const path = request.url?.split('?')[0] || '/'

      if (path === '/sitemap.xml') {
        response.writeHead(200, { 'content-type': 'application/xml' })
        response.end(`<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${origin}pages.xml</loc></sitemap></sitemapindex>`)
        return
      }
      if (path === '/pages.xml') {
        response.writeHead(200, { 'content-type': 'application/xml' })
        response.end(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}</loc></url><url><loc>${origin}about</loc></url></urlset>`)
        return
      }
      if (path === '/robots.txt') {
        response.writeHead(200, { 'content-type': 'text/plain' })
        response.end(`User-agent: *\nAllow: /\nSitemap: ${origin}sitemap.xml\n`)
        return
      }
      if (path === '/style.12345678.css') {
        response.writeHead(200, {
          'cache-control': 'public, max-age=31536000, immutable',
          'content-type': 'text/css',
        })
        response.end('@font-face { src: url("/font.12345678.woff2"); }')
        return
      }
      if (path === '/app.12345678.js') {
        response.writeHead(200, {
          'cache-control': 'public, max-age=31536000, immutable',
          'content-type': 'application/javascript',
        })
        response.end('console.info("read only");')
        return
      }
      if (path === '/image.webp') {
        response.writeHead(200, { 'content-type': 'image/webp' })
        response.end('image')
        return
      }
      if (path === '/font.12345678.woff2') {
        response.writeHead(200, {
          'cache-control': 'public, max-age=31536000, immutable',
          'content-type': 'font/woff2',
        })
        response.end('font')
        return
      }
      if (path === '/download.pdf') {
        response.writeHead(200, { 'content-type': 'application/pdf' })
        response.end('pdf')
        return
      }
      if (path === '/about') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(htmlPage(origin, '/about', {
          body: '<section id="section">Ziel</section>',
          description: 'Eindeutige Beschreibung der Über-uns-Seite',
          title: 'Über uns',
        }))
        return
      }
      if (path === '/private') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(htmlPage(origin, '/private', {
          description: 'Nicht indexierbare interne Seite',
          noindex: true,
          title: 'Privater Bereich',
        }))
        return
      }
      if (path === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(htmlPage(origin, '/', {
          body: `<link rel="stylesheet" href="/style.12345678.css">
            <script src="/app.12345678.js"></script>
            <img src="/image.webp" alt="Test">
            <a href="/about#section">Über uns</a>
            <a href="/private">Privat</a>
            <a href="/download.pdf">Download</a>
            <a href="https://external.example/path">Extern</a>
            <form action="/submit" method="post"><button type="submit">Absenden</button></form>`,
          description: 'Eindeutige Beschreibung der Startseite',
          title: 'Startseite',
        }))
        return
      }

      response.writeHead(500, { 'content-type': 'text/plain' })
      response.end('Dieser Pfad darf im lesenden Crawl nicht aufgerufen werden.')
    })
    origin = await listen(server)

    const report = await runCrawlCheck([origin], {
      allowHttp: true,
      allowPrivate: true,
      sitemap: true,
      strict: true,
    })
    const result = report.results[0] as unknown as {
      externalLinks: unknown[]
      forms: Array<{ action: string, requested: boolean }>
      pages: unknown[]
      resources: unknown[]
      sitemaps: unknown[]
    }

    expect(report.summary).toEqual({
      errors: 0,
      externalLinks: 1,
      failed: false,
      formsObservedNotSubmitted: 1,
      pages: 3,
      resources: 5,
      skippedNavigation: 0,
      warnings: 0,
    })
    expect(createJsonReport(report.results, report.options).readOnlyGuarantees).toEqual({
      buttonsActivated: false,
      externalLinksFetched: false,
      formActionsFetched: false,
      formsSubmitted: false,
      methods: ['GET'],
    })
    expect(result.sitemaps).toHaveLength(2)
    expect(result.pages).toHaveLength(3)
    expect(result.resources).toHaveLength(5)
    expect(result.forms).toEqual([expect.objectContaining({
      action: `${origin}submit`,
      requested: false,
    })])
    expect(requests.every(request => request.method === 'GET')).toBe(true)
    expect(requests.some(request => request.url?.startsWith('/submit'))).toBe(false)
    expect(requests.some(request => request.url?.includes('external.example'))).toBe(false)
  })

  it('skips suspicious GET navigation before it can cause a side effect', async () => {
    const requestedPaths = [] as string[]
    let origin = ''
    const server = createServer((request, response) => {
      requestedPaths.push(request.url || '')
      if (request.url === '/') {
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end(htmlPage(origin, '/', {
          body: '<a href="/delete-account">Konto löschen</a><a href="/safe?token=secret">Bestätigen</a>',
          title: 'Sichere Startseite',
        }))
        return
      }
      response.writeHead(500)
      response.end('Dieser potenziell zustandsverändernde Pfad darf nicht aufgerufen werden.')
    })
    origin = await listen(server)

    const report = await runCrawlCheck([origin], {
      allowHttp: true,
      allowPrivate: true,
    })
    const result = report.results[0] as unknown as {
      skippedLinks: Array<{ targetUrl: string }>
    }

    expect(report.summary).toMatchObject({ errors: 0, skippedNavigation: 2, warnings: 2 })
    expect(result.skippedLinks).toHaveLength(2)
    expect(requestedPaths).toEqual(['/'])
  })

  it('reports sitemap, canonical, redirect, noindex and status errors', async () => {
    let origin = ''
    const server = createServer((request, response) => {
      const path = request.url?.split('?')[0] || '/'
      if (path === '/sitemap.xml') {
        response.writeHead(200, { 'content-type': 'application/xml' })
        response.end(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>${origin}</loc></url><url><loc>${origin}</loc></url>
          <url><loc>${origin}redirect</loc></url><url><loc>${origin}hidden</loc></url><url><loc>${origin}missing</loc></url>
        </urlset>`)
        return
      }
      if (path === '/robots.txt') {
        response.writeHead(200, { 'content-type': 'text/plain' })
        response.end(`Sitemap: ${origin}sitemap.xml`)
        return
      }
      if (path === '/redirect') {
        response.writeHead(301, { location: '/about' })
        response.end()
        return
      }
      if (path === '/missing') {
        response.writeHead(404, { 'content-type': 'text/html' })
        response.end(htmlPage(origin, '/missing', { noindex: true, title: 'Fehlt' }))
        return
      }
      if (path === '/hidden') {
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end(htmlPage(origin, '/hidden', { noindex: true, title: 'Versteckt' }))
        return
      }
      if (path === '/about') {
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end(htmlPage(origin, '/about', { title: 'Zielseite' }))
        return
      }
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(htmlPage(origin, '/', {
        canonical: `${origin}wrong`,
        title: 'Startseite',
      }))
    })
    origin = await listen(server)

    const report = await runCrawlCheck([origin], {
      allowHttp: true,
      allowPrivate: true,
      sitemap: true,
      strict: true,
    })
    const result = report.results[0] as unknown as { issues: Array<{ code: string }> }
    const issueCodes = result.issues.map(issue => issue.code)

    expect(report.summary.failed).toBe(true)
    expect(issueCodes).toEqual(expect.arrayContaining([
      'page-canonical-mismatch',
      'page-http-status',
      'sitemap-location-duplicate',
      'sitemap-page-noindex',
      'sitemap-page-redirect',
    ]))
  })

  it('rejects private targets unless explicitly allowed', async () => {
    await expect(runCrawlCheck(['http://127.0.0.1/'], { allowHttp: true })).rejects.toThrow(/privates Ziel/)
  })
})
