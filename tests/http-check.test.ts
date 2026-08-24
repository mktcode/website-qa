import type { AddressInfo } from 'node:net'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { createJsonReport, parseArguments, runHttpCheck } from '../src/check-http.mjs'

const servers = new Set<ReturnType<typeof createServer>>()

const securityHeaders = {
  'content-security-policy': 'base-uri \'self\'; frame-ancestors \'none\'; object-src \'none\'',
  'permissions-policy': 'camera=(), geolocation=(), microphone=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
}

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

function compressedResponse(body: Buffer, acceptEncoding: string | undefined) {
  if (acceptEncoding === 'gzip') {
    return { body: gzipSync(body), encoding: 'gzip' }
  }
  if (acceptEncoding === 'br') {
    return { body: brotliCompressSync(body), encoding: 'br' }
  }
  return { body, encoding: undefined }
}

describe('http checker', () => {
  it('parses URLs and safe CLI options', () => {
    const parsed = parseArguments([
      'https://example.com/',
      '--json-file=.website-qa/current/http.json',
      '--strict',
      '--timeout=5000',
      '--max-redirects=3',
      '--not-found-path=/missing?source=qa',
      '--skip-http-redirect',
    ])

    expect(parsed.urls).toEqual(['https://example.com/'])
    expect(parsed.options).toMatchObject({
      checkHttpRedirect: false,
      json: true,
      jsonFile: '.website-qa/current/http.json',
      maxRedirects: 3,
      notFoundPath: '/missing?source=qa',
      strict: true,
      timeoutMilliseconds: 5000,
    })
  })

  it('checks headers, 404 responses, MIME types, caches and compression', async () => {
    const html = Buffer.from(`<!doctype html><html lang="de"><head>
      <title>HTTP-Prüfung</title>
      <link rel="stylesheet" href="/style.12345678.css">
      <script src="/app.12345678.js"></script>
    </head><body>${'Qualität '.repeat(300)}</body></html>`)
    const css = Buffer.from(`body { color: #123456; }\n${'.test { display: block; }\n'.repeat(100)}`)
    const javascript = Buffer.from(`console.info('test');\n${'const value = true;\n'.repeat(100)}`)

    const server = createServer((request, response) => {
      const path = request.url?.split('?')[0]
      if (path === '/redirect') {
        response.writeHead(301, { location: `/?${request.url?.split('?')[1] || ''}` })
        response.end()
        return
      }
      if (path === '/.well-known/ops-http-check-not-found') {
        response.writeHead(404, {
          ...securityHeaders,
          'cache-control': 'no-store',
          'content-type': 'text/html; charset=utf-8',
        })
        response.end('<!doctype html><html><head><meta name="robots" content="noindex, follow"></head><body><h1>Nicht gefunden</h1></body></html>')
        return
      }

      const resources: Record<string, { body: Buffer, contentType: string }> = {
        '/': { body: html, contentType: 'text/html; charset=utf-8' },
        '/app.12345678.js': { body: javascript, contentType: 'application/javascript' },
        '/style.12345678.css': { body: css, contentType: 'text/css' },
      }
      const resource = resources[path || '/']
      if (!resource) {
        response.writeHead(404)
        response.end()
        return
      }

      const compressed = compressedResponse(resource.body, request.headers['accept-encoding'])
      response.writeHead(200, {
        ...securityHeaders,
        'cache-control': path === '/' ? 'no-cache' : 'public, max-age=31536000, immutable',
        'content-type': resource.contentType,
        'vary': 'Accept-Encoding',
        ...(compressed.encoding ? { 'content-encoding': compressed.encoding } : {}),
      })
      response.end(compressed.body)
    })
    const url = await listen(server)

    const report = await runHttpCheck([`${url}redirect?source=qa`], {
      allowHttp: true,
      allowPrivate: true,
    })

    const result = report.results[0] as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      notFound: { status: number }
      page: { finalUrl: string, redirects: unknown[] }
      resources: Array<{ variants: Record<string, unknown> }>
    }

    expect(report.summary).toEqual({ errors: 0, failed: false, targets: 1, warnings: 0 })
    expect(report.checklistCoverage.summary.checklistItems).toMatchObject({
      automaticallyPassed: 1,
      pass: 1,
      total: 7,
    })
    expect(result.notFound).toMatchObject({ status: 404 })
    expect(result.page).toMatchObject({
      finalUrl: `${url}?source=qa`,
      redirects: [expect.objectContaining({ status: 301 })],
    })
    expect(result.resources).toHaveLength(3)
    expect(result.resources[0]?.variants).toMatchObject({
      br: { contentEncoding: 'br', status: 200 },
      gzip: { contentEncoding: 'gzip', status: 200 },
      identity: { contentEncoding: 'identity', status: 200 },
    })
    expect(result.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({ assertionId: 'error.not-found.status-404', outcome: 'pass' }),
      expect.objectContaining({ assertionId: 'error.not-found.noindex', outcome: 'pass' }),
      expect.objectContaining({ assertionId: 'compression.gzip.effective', outcome: 'pass' }),
      expect.objectContaining({ assertionId: 'cache.versioned-asset.immutable', outcome: 'pass' }),
    ]))

    const json = createJsonReport(report.results, report.options)
    expect(json).toMatchObject({
      checklistCoverage: { catalog: { status: 'pilot' } },
      readOnlyGuarantees: { methods: ['GET'], mutatingActionsInvoked: false },
      results: [{ requestedUrl: '(privates/lokales Ziel)', requestedUrlParameterNames: ['source'] }],
      schemaVersion: 1,
    })
    expect(JSON.stringify(json)).not.toContain('source=qa')
  })

  it('reports missing protections, compression and a soft 404', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html><head><title>Fehlerfall</title></head><body>${'Inhalt '.repeat(300)}</body></html>`)
    })
    const url = await listen(server)

    const report = await runHttpCheck([url], {
      allowHttp: true,
      allowPrivate: true,
      strict: true,
    })
    const result = report.results[0] as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      issues: Array<{ code: string }>
    }
    const issueCodes = result.issues.map(issue => issue.code)

    expect(report.summary.failed).toBe(true)
    expect(issueCodes).toEqual(expect.arrayContaining([
      'compression-missing',
      'csp-missing',
      'not-found-noindex-missing',
      'not-found-status',
      'nosniff-missing',
    ]))
    expect(result.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({ assertionId: 'error.not-found.status-404', outcome: 'fail' }),
      expect.objectContaining({ assertionId: 'compression.gzip.effective', outcome: 'fail' }),
    ]))
  })

  it('rejects private targets unless explicitly allowed', async () => {
    await expect(runHttpCheck(['http://127.0.0.1/'], { allowHttp: true })).rejects.toThrow(/privates Ziel/)
  })
})
