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
      '--json-file=.website-qa/current/crawl.json',
      '--strict',
    ])

    expect(parsed.urls).toEqual(['https://example.com/'])
    expect(parsed.options).toMatchObject({
      json: true,
      jsonFile: '.website-qa/current/crawl.json',
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
            <a href="https://external.example/path?email=person%40example.com">Extern</a>
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
      assertions: Array<{
        assertionId: string
        outcome: string
        subject: { checkedPages: number, checkedResources: number, checkedSitemaps: number }
      }>
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
    const jsonReport = createJsonReport(report.results, report.options)
    expect(jsonReport).toMatchObject({
      checklist: { id: 'website-qa-checklist', version: '2.0.0' },
      readOnlyGuarantees: {
        buttonsActivated: false,
        externalLinksFetched: false,
        formActionsFetched: false,
        formsSubmitted: false,
        methods: ['GET'],
      },
      schemaVersion: 2,
    })
    expect(jsonReport.results[0].signals).toHaveLength(17)
    expect(jsonReport.results[0].signals.every((signal: { status: string }) => signal.status === 'positive')).toBe(true)
    expect(JSON.stringify(jsonReport)).not.toContain('assertions')
    expect(JSON.stringify(jsonReport)).not.toContain('person%40example.com')
    expect(JSON.stringify(jsonReport)).not.toContain('person@example.com')
    expect(JSON.stringify(jsonReport)).not.toContain('127.0.0.1')
    expect(JSON.stringify(jsonReport)).toContain('(privates/lokales Ziel)')
    expect(result.sitemaps).toHaveLength(2)
    expect(result.pages).toHaveLength(3)
    expect(result.resources).toHaveLength(5)
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.media.get-observation-complete')?.outcome).toBe('pass')
    expect(result.forms).toEqual([expect.objectContaining({
      action: `${origin}submit`,
      requested: false,
    })])
    expect(result.assertions).toHaveLength(17)
    expect(result.assertions.every(assertion => assertion.outcome === 'pass')).toBe(true)
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.run.coverage-complete')?.subject).toMatchObject({
      checkedPages: 3,
      checkedResources: 5,
      checkedSitemaps: 2,
    })
    expect(requests.every(request => request.method === 'GET')).toBe(true)
    expect(requests.some(request => request.url?.startsWith('/submit'))).toBe(false)
    expect(requests.some(request => request.url?.includes('external.example'))).toBe(false)
  })

  it('does not treat an omitted sitemap mode as a positive sitemap observation', async () => {
    let origin = ''
    const server = createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(htmlPage(origin, '/', { title: 'Startseite' }))
    })
    origin = await listen(server)

    const report = await runCrawlCheck([origin], {
      allowHttp: true,
      allowPrivate: true,
    })
    const assertions = report.results[0].assertions as Array<{ assertionId: string, outcome: string }>

    expect(assertions.find(assertion => assertion.assertionId === 'crawl.sitemap.file-valid')?.outcome).toBe('inconclusive')
    expect(assertions.find(assertion => assertion.assertionId === 'crawl.sitemap.entries-valid')?.outcome).toBe('inconclusive')
    expect(assertions.find(assertion => assertion.assertionId === 'crawl.resources.status-valid')?.outcome).toBe('notApplicable')
    expect(assertions.find(assertion => assertion.assertionId === 'crawl.media.get-observation-complete')?.outcome).toBe('notApplicable')
    expect(assertions.find(assertion => assertion.assertionId === 'crawl.run.coverage-complete')?.outcome).toBe('pass')
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
      assertions: Array<{ outcome: string }>
      skippedLinks: Array<{ targetUrl: string }>
    }

    expect(report.summary).toMatchObject({ errors: 0, skippedNavigation: 2, warnings: 2 })
    expect(result.skippedLinks).toHaveLength(2)
    expect(result.assertions.every(assertion => assertion.outcome === 'inconclusive')).toBe(true)
    expect(requestedPaths).toEqual(['/'])
  })

  it('skips suspicious HTML- and CSS-discovered resources and their redirect targets', async () => {
    const requestedPaths: string[] = []
    let origin = ''
    const server = createServer((request, response) => {
      requestedPaths.push(request.url || '')
      if (request.url === '/') {
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end(htmlPage(origin, '/', {
          body: '<link rel="stylesheet" href="/delete-style.css"><link rel="stylesheet" href="/safe.css"><script src="/app.js?token=secret"></script><img src="/safe-image">',
          title: 'Sichere Startseite',
        }))
        return
      }
      if (request.url === '/safe.css') {
        response.writeHead(200, { 'content-type': 'text/css' })
        response.end('body { background-image: url("/unsubscribe?code=secret"); }')
        return
      }
      if (request.url === '/safe-image') {
        response.writeHead(302, { location: '/remove-account' })
        response.end()
        return
      }
      response.writeHead(500)
      response.end('Dieser potenziell zustandsverändernde Ressourcenpfad darf nicht aufgerufen werden.')
    })
    origin = await listen(server)

    const report = await runCrawlCheck([origin], {
      allowHttp: true,
      allowPrivate: true,
    })
    const result = report.results[0] as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      issues: Array<{ code: string }>
    }

    expect(result.issues.filter(issue => issue.code === 'resource-skipped-read-only')).toHaveLength(3)
    expect(result.issues.map(issue => issue.code)).toContain('resource-fetch-failed')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.resources.status-valid')?.outcome).toBe('inconclusive')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.run.coverage-complete')?.outcome).toBe('inconclusive')
    expect(requestedPaths).toEqual(['/', '/safe.css', '/safe-image'])
  })

  it('skips suspicious sitemap entries before they can cause a side effect', async () => {
    const requestedPaths = [] as string[]
    let origin = ''
    const server = createServer((request, response) => {
      requestedPaths.push(request.url || '')
      if (request.url === '/') {
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end(htmlPage(origin, '/', { title: 'Sichere Startseite' }))
        return
      }
      if (request.url === '/sitemap.xml') {
        response.writeHead(200, { 'content-type': 'application/xml' })
        response.end(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}</loc></url><url><loc>${origin}delete-account</loc></url><url><loc>${origin}safe?token=secret</loc></url></urlset>`)
        return
      }
      if (request.url === '/robots.txt') {
        response.writeHead(200, { 'content-type': 'text/plain' })
        response.end(`Sitemap: ${origin}sitemap.xml`)
        return
      }
      response.writeHead(500)
      response.end('Dieser potenziell zustandsverändernde Sitemap-Pfad darf nicht aufgerufen werden.')
    })
    origin = await listen(server)

    const report = await runCrawlCheck([origin], {
      allowHttp: true,
      allowPrivate: true,
      sitemap: true,
    })
    const result = report.results[0] as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      skippedLinks: Array<{ sourceUrl: string, targetUrl: string }>
    }

    expect(result.skippedLinks).toHaveLength(2)
    expect(result.skippedLinks.every(link => link.sourceUrl === `${origin}sitemap.xml`)).toBe(true)
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.run.coverage-complete')?.outcome).toBe('inconclusive')
    expect(requestedPaths).toEqual(['/', '/sitemap.xml', '/robots.txt'])
  })

  it('skips suspicious child sitemaps before requesting them', async () => {
    const requestedPaths: string[] = []
    let origin = ''
    const server = createServer((request, response) => {
      requestedPaths.push(request.url || '')
      if (request.url === '/') {
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end(htmlPage(origin, '/', { title: 'Sichere Startseite' }))
        return
      }
      if (request.url === '/sitemap.xml') {
        response.writeHead(200, { 'content-type': 'application/xml' })
        response.end(`<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${origin}safe.xml</loc></sitemap><sitemap><loc>${origin}unsubscribe.xml?code=secret</loc></sitemap></sitemapindex>`)
        return
      }
      if (request.url === '/safe.xml') {
        response.writeHead(200, { 'content-type': 'application/xml' })
        response.end(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}</loc></url></urlset>`)
        return
      }
      if (request.url === '/robots.txt') {
        response.writeHead(200, { 'content-type': 'text/plain' })
        response.end(`Sitemap: ${origin}sitemap.xml`)
        return
      }
      response.writeHead(500)
      response.end('Diese verdächtige Kind-Sitemap darf nicht aufgerufen werden.')
    })
    origin = await listen(server)

    const report = await runCrawlCheck([origin], {
      allowHttp: true,
      allowPrivate: true,
      sitemap: true,
    })
    const result = report.results[0] as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      issues: Array<{ code: string }>
    }

    expect(result.issues.map(issue => issue.code)).toContain('sitemap-skipped-read-only')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.sitemap.coverage-complete')?.outcome).toBe('inconclusive')
    expect(requestedPaths).toEqual(['/', '/sitemap.xml', '/safe.xml', '/robots.txt'])
  })

  it('marks resource-limit-dependent assertions inconclusive', async () => {
    let origin = ''
    const server = createServer((request, response) => {
      if (request.url === '/first.css') {
        response.writeHead(200, { 'content-type': 'text/css' })
        response.end('body { color: black; }')
        return
      }
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(htmlPage(origin, '/', {
        body: '<link rel="stylesheet" href="/first.css"><script src="/second.js"></script>',
        title: 'Startseite',
      }))
    })
    origin = await listen(server)

    const report = await runCrawlCheck([origin], {
      allowHttp: true,
      allowPrivate: true,
      maxResources: 1,
      strict: true,
    })
    const result = report.results[0] as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      issues: Array<{ code: string }>
    }

    expect(result.issues.map(issue => issue.code)).toContain('resource-limit-reached')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.media.get-observation-complete')?.outcome).toBe('inconclusive')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.resources.status-valid')?.outcome).toBe('inconclusive')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.resources.mime-valid')?.outcome).toBe('inconclusive')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.run.coverage-complete')?.outcome).toBe('inconclusive')
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
      if (path === '/missing.js') {
        response.writeHead(404, { 'content-type': 'text/plain' })
        response.end('fehlt')
        return
      }
      if (path === '/wrong.css') {
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end('<!doctype html><title>Kein CSS</title>')
        return
      }
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(htmlPage(origin, '/', {
        body: '<script src="/missing.js"></script><link rel="stylesheet" href="/wrong.css">',
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
    const result = report.results[0] as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      issues: Array<{ code: string }>
    }
    const issueCodes = result.issues.map(issue => issue.code)

    expect(report.summary.failed).toBe(true)
    expect(issueCodes).toEqual(expect.arrayContaining([
      'page-canonical-mismatch',
      'resource-content-type',
      'resource-http-status',
      'sitemap-location-duplicate',
      'sitemap-page-http-status',
      'sitemap-page-noindex',
      'sitemap-page-redirect',
    ]))
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.canonical.matches-final-url')?.outcome).toBe('fail')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.metadata.title-present')?.outcome).toBe('inconclusive')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.sitemap.file-valid')?.outcome).toBe('pass')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.sitemap.entries-valid')?.outcome).toBe('fail')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.navigation.internal-valid')?.outcome).toBe('fail')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.navigation.internal-direct')?.outcome).toBe('fail')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.resources.status-valid')?.outcome).toBe('fail')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.resources.mime-valid')?.outcome).toBe('fail')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.run.coverage-complete')?.outcome).toBe('pass')
  })

  it('marks malformed sitemap observations and dependent assertions conservatively', async () => {
    let origin = ''
    const server = createServer((request, response) => {
      if (request.url === '/sitemap.xml') {
        response.writeHead(200, { 'content-type': 'application/xml' })
        response.end('<urlset><url></urlset>')
        return
      }
      if (request.url === '/robots.txt') {
        response.writeHead(200, { 'content-type': 'text/plain' })
        response.end(`Sitemap: ${origin}sitemap.xml`)
        return
      }
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(htmlPage(origin, '/', { title: 'Startseite' }))
    })
    origin = await listen(server)

    const report = await runCrawlCheck([origin], {
      allowHttp: true,
      allowPrivate: true,
      sitemap: true,
      strict: true,
    })
    const result = report.results[0] as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      issues: Array<{ code: string }>
    }

    expect(result.issues.map(issue => issue.code)).toContain('sitemap-xml-invalid')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.sitemap.file-valid')?.outcome).toBe('fail')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.sitemap.entries-valid')?.outcome).toBe('inconclusive')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.sitemap.coverage-complete')?.outcome).toBe('inconclusive')
    expect(result.assertions.find(assertion => assertion.assertionId === 'crawl.run.coverage-complete')?.outcome).toBe('inconclusive')
  })

  it('rejects private targets unless explicitly allowed', async () => {
    await expect(runCrawlCheck(['http://127.0.0.1/'], { allowHttp: true })).rejects.toThrow(/privates Ziel/)
  })
})
