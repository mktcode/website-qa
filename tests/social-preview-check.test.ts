import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createJsonReport,
  extractHtmlMetadata,
  parseArguments,
  robotsPolicies,
  runSocialPreviewCheck,
} from '../src/check-social-preview.mjs'

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

describe('social preview checker', () => {
  it('parses URLs and reusable CLI options', () => {
    const parsed = parseArguments([
      'https://example.com/',
      '--json-file=.website-qa/current/social.json',
      '--strict',
      '--sitemap',
      '--max-pages=12',
      '--timeout=5000',
    ])

    expect(parsed.urls).toEqual(['https://example.com/'])
    expect(parsed.options).toMatchObject({
      json: true,
      jsonFile: '.website-qa/current/social.json',
      maxPages: 12,
      sitemap: true,
      strict: true,
      timeoutMilliseconds: 5000,
    })
  })

  it('extracts server-rendered social metadata without a browser', () => {
    const metadata = extractHtmlMetadata(`<!doctype html>
      <html lang="de"><head>
        <title>Beispiel</title>
        <link rel="canonical" href="https://example.com/">
        <meta property="og:title" content="OpenGraph-Titel">
        <meta name="twitter:card" content="summary_large_image">
      </head></html>`)

    expect(metadata.canonicals).toEqual(['https://example.com/'])
    expect(metadata.documentTitle).toBe('Beispiel')
    expect(metadata.htmlLanguage).toBe('de')
    expect(metadata.metadata['og:title']).toEqual(['OpenGraph-Titel'])
    expect(metadata.metadata['twitter:card']).toEqual(['summary_large_image'])
  })

  it('contains verified policies for major AI providers', () => {
    const tokens = robotsPolicies.map(policy => policy.token)

    expect(tokens).toEqual(expect.arrayContaining([
      'OAI-SearchBot',
      'ChatGPT-User',
      'GPTBot',
      'Claude-SearchBot',
      'Claude-User',
      'ClaudeBot',
      'Googlebot',
      'Google-CloudVertexBot',
      'Google-Extended',
      'bingbot',
      'MistralAI-Index',
      'MistralAI-User',
      'MistralAI-Training',
      'PerplexityBot',
      'Perplexity-User',
      'meta-externalagent',
      'meta-externalfetcher',
      'Applebot',
      'Applebot-Extended',
    ]))
    expect(robotsPolicies.every(policy => policy.documentation.startsWith('https://'))).toBe(true)
  })

  it('marks assertions inconclusive when crawler, image, or robots observations are unavailable', async () => {
    const server = createServer((request, response) => {
      const origin = `http://${request.headers.host}`
      if (request.url === '/robots.txt' || request.url === '/social.webp'
        || request.headers['user-agent']?.includes('LinkedInBot')) {
        response.destroy()
        return
      }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html><head>
        <link rel="canonical" href="${origin}/">
        <meta property="og:title" content="Technischer Social-Test">
        <meta property="og:description" content="Eine ausreichend lange Beschreibung für den technischen Social-Testlauf.">
        <meta property="og:type" content="website">
        <meta property="og:url" content="${origin}/">
        <meta property="og:image" content="${origin}/social.webp">
        <meta property="og:image:alt" content="Testbild">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:image:alt" content="Testbild">
      </head></html>`)
    })
    servers.add(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    const report = await runSocialPreviewCheck([`http://127.0.0.1:${address.port}/`], {
      allowHttp: true,
      allowPrivate: true,
      strict: true,
    })
    const assertions = (report.results[0] as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
    }).assertions
    const outcomes = Object.fromEntries(assertions.map(assertion => [assertion.assertionId, assertion.outcome]))

    expect(outcomes).toMatchObject({
      'social.crawlers.html-metadata-consistent': 'inconclusive',
      'social.images.preview-technically-valid': 'inconclusive',
      'social.robots.file-retrievable': 'inconclusive',
      'social.robots.policy-matrix-recorded': 'inconclusive',
      'social.robots.social-crawlers-allowed': 'inconclusive',
    })
  })

  it('checks crawler parity, robots policies and the real image', async () => {
    const image = await sharp({
      create: {
        background: '#123456',
        channels: 3,
        height: 630,
        width: 1200,
      },
    }).webp().toBuffer()
    const seenMethods = new Set<string>()
    const seenUserAgents = new Set<string>()

    const server = createServer((request, response) => {
      seenMethods.add(request.method || '')
      seenUserAgents.add(request.headers['user-agent'] || '')
      const origin = `http://${request.headers.host}`

      if (request.url === '/robots.txt') {
        response.writeHead(200, { 'content-type': 'text/plain' })
        response.end('User-agent: *\nAllow: /\n')
        return
      }
      if (request.url === '/social.webp') {
        response.writeHead(200, {
          'cache-control': 'public, max-age=3600',
          'content-type': 'image/webp',
        })
        response.end(image)
        return
      }

      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html lang="de"><head>
        <title>Automatisierter Social-Test</title>
        <link rel="canonical" href="${origin}/">
        <meta property="og:title" content="Automatisierter Social-Test">
        <meta property="og:description" content="Eine ausreichend lange Beschreibung für den automatisierten Social-Metadaten-Test.">
        <meta property="og:type" content="website">
        <meta property="og:url" content="${origin}/">
        <meta property="og:image" content="${origin}/social.webp">
        <meta property="og:image:type" content="image/webp">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:image:alt" content="Testbild">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="Automatisierter Social-Test">
        <meta name="twitter:description" content="Eine ausreichend lange Beschreibung für den automatisierten Social-Metadaten-Test.">
        <meta name="twitter:image" content="${origin}/social.webp">
        <meta name="twitter:image:alt" content="Testbild">
      </head><body></body></html>`)
    })
    servers.add(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    const url = `http://127.0.0.1:${address.port}/`

    const report = await runSocialPreviewCheck([url], {
      allowHttp: true,
      allowPrivate: true,
    })
    const result = report.results[0] as unknown as {
      agents: unknown[]
      assertions: Array<{ assertionId: string, outcome: string }>
      images: Array<{ height?: number, width?: number }>
      robots: { policies: unknown[] }
    }

    expect(report.summary).toMatchObject({ errors: 0, failed: false, pages: 1, warnings: 0 })
    expect(result.agents).toHaveLength(4)
    expect(result.images[0]).toMatchObject({ height: 630, width: 1200 })
    expect(result.robots.policies).toHaveLength(robotsPolicies.length)
    expect(result.assertions).toHaveLength(8)
    expect(result.assertions.find(assertion => assertion.assertionId === 'social.crawlers.html-metadata-consistent')?.outcome).toBe('pass')
    expect(result.assertions.find(assertion => assertion.assertionId === 'social.robots.policy-matrix-recorded')).toMatchObject({
      outcome: 'pass',
      subject: { allowedTrainingTokens: 6, blockedTrainingTokens: 0 },
    })
    const limitedReport = await runSocialPreviewCheck([url, `${url}second`], {
      allowHttp: true,
      allowPrivate: true,
      maxPages: 1,
    })
    const limitedResult = limitedReport.results[0] as unknown as {
      assertions: Array<{ assertionId: string, outcome: string }>
      coverage: { discoveredPages: number, selectedPages: number, truncated: boolean }
    }
    expect(limitedResult.coverage).toMatchObject({ discoveredPages: 2, selectedPages: 1, truncated: true })
    expect(limitedResult.assertions.find(assertion => assertion.assertionId === 'social.metadata.canonical-open-graph-consistent')?.outcome).toBe('inconclusive')

    const jsonReport = createJsonReport(report.results, report.options)
    expect(jsonReport).toMatchObject({
      checklist: { id: 'website-qa-checklist', version: '2.0.0' },
      readOnlyGuarantees: {
        browserInteractions: false,
        formsSubmitted: false,
        methods: ['GET'],
      },
      schemaVersion: 2,
    })
    expect(jsonReport.results[0].signals).toHaveLength(8)
    expect(JSON.stringify(jsonReport)).not.toContain('assertions')
    expect(JSON.stringify(jsonReport)).not.toContain('127.0.0.1')
    expect(JSON.stringify(jsonReport)).toContain('(privates/lokales Ziel)')
    expect([...seenMethods]).toEqual(['GET'])
    expect([...seenUserAgents]).toEqual(expect.arrayContaining([
      expect.stringContaining('SocialPreviewCheck'),
      expect.stringContaining('facebookexternalhit'),
      expect.stringContaining('Twitterbot'),
      expect.stringContaining('LinkedInBot'),
    ]))
  })
})
