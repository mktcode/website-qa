import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { compactLighthouseResult, parseArguments, runLighthouseCheck, withResourceTimeout } from '../src/check-lighthouse.mjs'

const openServers: Server[] = []

async function listen(server: Server) {
  openServers.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(openServers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })))
})

describe('lighthouse check', () => {
  it('parses its fixed bounded CLI contract', () => {
    expect(parseArguments([
      'https://example.com/',
      '--max-requests=20',
      '--timeout=30000',
      '--strict',
      '--json-file=.website-qa/lighthouse.json',
    ])).toMatchObject({
      options: {
        json: true,
        jsonFile: '.website-qa/lighthouse.json',
        maxRequests: 20,
        strict: true,
        timeoutMilliseconds: 30_000,
      },
      urls: ['https://example.com/'],
    })
  })

  it('rejects empty JSON output paths', () => {
    expect(() => parseArguments(['https://example.com/', '--json-file='])).toThrow(/benötigt einen Pfad/)
  })

  it('rejects partial and unsafe numeric options without truncating valid numbers', () => {
    for (const argument of [
      '--timeout=100abc',
      '--max-requests=1.5',
      `--max-requests=${Number.MAX_SAFE_INTEGER + 1}`,
    ]) {
      expect(() => parseArguments(['https://example.com/', argument])).toThrow(/positive Ganzzahl/)
    }
    expect(parseArguments(['https://example.com/', '--max-requests=1e3']).options.maxRequests).toBe(1000)
  })

  it('closes startup resources that resolve only after their timeout', async () => {
    let closeCalls = 0
    let resolveResource!: (resource: { close: () => Promise<void> }) => void
    const resource = new Promise<{ close: () => Promise<void> }>((resolve) => {
      resolveResource = resolve
    })
    const timed = withResourceTimeout(resource, 1, (lateResource: { close: () => Promise<void> }) => lateResource.close())

    await expect(timed).rejects.toThrow(/überschritt/)
    resolveResource({
      close: async () => {
        closeCalls += 1
      },
    })
    await resource
    await new Promise(resolve => setImmediate(resolve))

    expect(closeCalls).toBe(1)
  })

  it('compacts Lighthouse details at every published boundary', () => {
    const auditRefs = Array.from({ length: 260 }, (_, index) => ({ id: `audit-${index}` }))
    const metricIds = ['first-contentful-paint', 'largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'speed-index', 'interactive', 'total-byte-weight']
    const audits: Record<string, Record<string, unknown>> = Object.fromEntries(auditRefs.map(({ id }) => [id, {
      score: 1,
      scoreDisplayMode: 'binary',
      title: id,
      warnings: Array.from({ length: 12 }, (_, index) => `warning-${index}-${'x'.repeat(400)}`),
    }]))
    for (const id of metricIds) {
      audits[id] = { displayValue: `${id} display`, numericUnit: 'millisecond', numericValue: 42, score: 1 }
    }
    audits['lcp-breakdown-insight'] = {
      details: {
        items: [
          { items: Array.from({ length: 5 }, (_, index) => ({ duration: index, label: `phase-${index}`, subpart: `part-${index}` })), type: 'table' },
          { nodeLabel: 'Hero', selector: '#hero', type: 'node' },
        ],
      },
    }
    const categories = Object.fromEntries(['performance', 'accessibility', 'best-practices', 'seo'].map(id => [id, {
      auditRefs: id === 'performance' ? [...auditRefs, ...metricIds.map(metricId => ({ id: metricId }))] : [{ id: 'audit-0' }],
      score: 0.91,
      title: id,
    }]))

    const compact = compactLighthouseResult({ audits, categories })

    expect(Object.keys(compact.categories)).toEqual(['performance', 'accessibility', 'best-practices', 'seo'])
    expect(Object.keys(compact.metrics)).toEqual(metricIds)
    expect(compact.audits).toHaveLength(250)
    expect(compact.audits[0].warnings).toHaveLength(10)
    expect(compact.audits[0].warnings[0].length).toBe(300)
    expect(compact.lcp.breakdown).toHaveLength(4)
    expect(compact.lcp.candidate).toEqual({ label: 'Hero', selector: '#hero' })
  })

  it('blocks preflight redirects to another origin before contacting it', async () => {
    const attackerRequests: string[] = []
    const attacker = await listen(createServer((request, response) => {
      attackerRequests.push(request.url || '')
      response.writeHead(204)
      response.end()
    }))
    const target = await listen(createServer((_request, response) => {
      response.writeHead(302, { location: `${attacker}/redirect-target` })
      response.end()
    }))

    await expect(runLighthouseCheck(target, {
      allowHttp: true,
      allowPrivate: true,
    })).rejects.toThrow(/außerhalb der erlaubten Origins/)
    expect(attackerRequests).toEqual([])
  })

  it('enforces the configured deadline during preflight', async () => {
    const target = await listen(createServer((_request, response) => {
      setTimeout(() => {
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end('<!doctype html><title>zu spät</title>')
      }, 1000)
    }))
    const startedAt = Date.now()

    await expect(runLighthouseCheck(target, {
      allowHttp: true,
      allowPrivate: true,
      timeoutMilliseconds: 100,
    })).rejects.toThrow(/Laufzeitlimit/)
    expect(Date.now() - startedAt).toBeLessThan(700)
  })

  const chromiumPath = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync)
  if (!chromiumPath && process.env.WEBSITE_QA_REQUIRE_CHROMIUM === '1') {
    throw new Error('Chromium-Sicherheitsintegration ist erforderlich, aber kein unterstütztes Browser-Binary wurde gefunden.')
  }
  const chromiumIt = chromiumPath ? it : it.skip

  chromiumIt('runs through a caller-owned guarded page without destination side effects', async () => {
    const targetRequests: Array<{ method: string, url: string }> = []
    const attackerRequests: Array<{ method: string, url: string }> = []
    const attacker = await listen(createServer((request, response) => {
      attackerRequests.push({ method: request.method || '', url: request.url || '' })
      response.writeHead(204)
      response.end()
    }))
    const target = await listen(createServer((request, response) => {
      targetRequests.push({ method: request.method || '', url: request.url || '' })
      if (request.url === '/service-worker.js') {
        response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
        response.end(`self.addEventListener('install', () => { fetch('/service-worker-post', { method: 'POST', body: 'x' }); fetch('${attacker}/service-worker-external') })`)
        return
      }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html lang="de"><head><title>Read-only Lighthouse</title><meta name="description" content="Read-only Lighthouse test"></head><body><main><h1>Test</h1></main>
<script>
try { fetch('/mutate', { method: 'POST', body: 'x' }).catch(() => {}) } catch {}
try { const xhr = new XMLHttpRequest(); xhr.open('POST', '/xhr'); xhr.send('x') } catch {}
try { const form = document.createElement('form'); form.method = 'post'; form.action = '/form'; document.body.append(form); form.submit() } catch {}
try { navigator.sendBeacon('/beacon', 'x') } catch {}
try { fetch('${attacker}/external').catch(() => {}) } catch {}
try { open('${attacker}/popup') } catch {}
try { const popupLink = document.createElement('a'); popupLink.href = '${attacker}/declarative-popup'; popupLink.target = '_blank'; document.body.append(popupLink); popupLink.click() } catch {}
try { navigator.serviceWorker.register('/service-worker.js').catch(() => {}) } catch {}
try { new Worker('data:text/javascript,postMessage("INLINE_SECRET")') } catch {}
try { new SharedWorker('data:text/javascript,onconnect=()=>{}') } catch {}
try { new EventSource('${attacker}/events') } catch {}
try { new WebSocket('${attacker.replace('http:', 'ws:')}/socket') } catch {}
try { new WebTransport('${attacker.replace('http:', 'https:')}/transport') } catch {}
try { new RTCPeerConnection() } catch {}
</script></body></html>`)
    }))

    const report = await runLighthouseCheck(target, {
      allowHttp: true,
      allowPrivate: true,
      chromiumPath,
      maxRequests: 50,
      timeoutMilliseconds: 30_000,
    })

    expect(report.schemaVersion).toBe(2)
    expect(report.coverage).toMatchObject({
      categories: ['performance', 'accessibility', 'best-practices', 'seo'],
      constrainedBySafetyControls: true,
      guardsInstalledBeforeNavigation: true,
      hostnameResolutionPinned: true,
      interceptionInstalledBeforeNavigation: true,
      representative: false,
    })
    expect(report.signals).toHaveLength(5)
    expect(report.lighthouse.metrics['total-byte-weight']?.value).toBeGreaterThan(0)
    expect(report.lighthouse.lcp.breakdown.length).toBeGreaterThan(0)
    expect(report.lighthouse.audits.every(audit => Array.isArray(audit.warnings))).toBe(true)
    expect(report.signals[0]).toMatchObject({ id: 'lighthouse.run.completed', status: 'inconclusive' })
    expect(report.blockedActions.map(action => action.kind)).toEqual(expect.arrayContaining([
      'beacon',
      'eventsource',
      'form-submit',
      'popup',
      'service-worker',
      'shared-worker',
      'webrtc',
      'websocket',
      'webtransport',
      'worker',
    ]))
    expect(report.blockedRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'external-request-blocked', method: 'GET' }),
      expect.objectContaining({ code: 'non-get-blocked', method: 'POST' }),
    ]))
    expect(attackerRequests).toEqual([])
    expect(targetRequests.every(request => request.method === 'GET')).toBe(true)
    expect(targetRequests.some(request => ['/mutate', '/xhr', '/form', '/beacon', '/service-worker.js', '/service-worker-post'].includes(request.url))).toBe(false)
    expect(JSON.stringify(report)).not.toContain('INLINE_SECRET')
    expect(JSON.stringify(report)).not.toContain('assertions')
    expect(JSON.stringify(report)).not.toContain('checklistCoverage')
  }, 45_000)
})
