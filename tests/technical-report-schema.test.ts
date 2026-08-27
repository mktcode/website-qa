import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { createJsonReport as createBrowserReport } from '../src/check-browser.mjs'
import { createJsonReport as createCrawlReport } from '../src/check-crawl.mjs'
import { createJsonReport as createHttpReport } from '../src/check-http.mjs'
import { createJsonReport as createSocialReport } from '../src/check-social-preview.mjs'

const catalogDirectory = join(import.meta.dirname, '..', 'catalog')
const tools = [
  { name: 'http', tool: 'http-check' },
  { name: 'crawl', tool: 'crawl-check' },
  { name: 'browser', tool: 'browser-check' },
  { name: 'social', tool: 'social-preview-check' },
]

function json(name: string) {
  return JSON.parse(readFileSync(join(catalogDirectory, name), 'utf8'))
}

function validators() {
  const ajv = new Ajv2020.Ajv2020({ allErrors: true, strict: true })
  addFormats.default(ajv)
  ajv.addSchema(json('technical-report.common.schema.json'))
  return new Map(tools.map(({ name }) => [name, ajv.compile(json(`${name}-report.schema.json`))]))
}

function validationMessage(errors: unknown) {
  return JSON.stringify(errors, null, 2)
}

describe('technical report schemas', () => {
  it('validate all four published success examples', () => {
    const schemas = validators()
    for (const { name } of tools) {
      const validate = schemas.get(name)!
      expect(validate(json(`${name}-report.example.json`)), validationMessage(validate.errors)).toBe(true)
    }
  })

  it('validate reports produced by all four JSON report creators', () => {
    const schemas = validators()
    const httpExample = json('http-report.example.json')
    const crawlExample = json('crawl-report.example.json')
    const browserExample = json('browser-report.example.json')
    const socialExample = json('social-report.example.json')
    const reports = {
      browser: createBrowserReport(browserExample.result, browserExample.options),
      crawl: createCrawlReport(crawlExample.results.map((result: Record<string, unknown>) => ({
        externalLinks: [],
        forms: [],
        skippedLinks: [],
        ...result,
      })), crawlExample.options),
      http: createHttpReport(httpExample.results, httpExample.options),
      social: createSocialReport(socialExample.results.map((result: Record<string, any>) => ({
        ...result,
        metadata: result.metadata
          ? {
              canonicals: result.metadata.canonical ? [result.metadata.canonical] : [],
              metadata: Object.fromEntries([...Object.entries(result.metadata.openGraph || {}), ...Object.entries(result.metadata.twitter || {})]
                .map(([key, value]) => [key, Array.isArray(value) ? value : [value]])),
            }
          : undefined,
      })), socialExample.options),
    }

    for (const { name } of tools) {
      const validate = schemas.get(name)!
      expect(validate(reports[name as keyof typeof reports]), validationMessage(validate.errors)).toBe(true)
    }
  })

  it('cover the redacted exit-code-2 error envelopes', () => {
    const schemas = validators()
    const reports = {
      browser: {
        error: 'Ungültige Eingabe.',
        schemaVersion: 1,
        tool: 'browser-check',
        toolPackage: { name: '@mktcode/website-qa', version: '0.6.2' },
      },
      crawl: {
        error: 'Ungültige Eingabe.',
        readOnlyGuarantees: {
          buttonsActivated: false,
          externalLinksFetched: false,
          formActionsFetched: false,
          formsSubmitted: false,
          methods: ['GET'],
        },
        schemaVersion: 1,
        summary: { errors: 1, failed: true, pages: 0, resources: 0, warnings: 0 },
        tool: 'crawl-check',
      },
      http: {
        error: 'Ungültige Eingabe.',
        schemaVersion: 1,
        summary: { errors: 1, failed: true, targets: 0, warnings: 0 },
        tool: 'http-check',
      },
      social: {
        error: 'Ungültige Eingabe.',
        readOnlyGuarantees: {
          browserInteractions: false,
          buttonsActivated: false,
          formActionsFetched: false,
          formsSubmitted: false,
          methods: ['GET'],
        },
        robotsPolicyReviewedAt: '2026-08-22',
        schemaVersion: 1,
        summary: { errors: 1, failed: true, pages: 0, warnings: 0 },
        tool: 'social-preview-check',
      },
    }

    for (const { name } of tools) {
      const validate = schemas.get(name)!
      expect(validate(reports[name as keyof typeof reports]), validationMessage(validate.errors)).toBe(true)
    }
  })

  it('rejects another tool and weakened read-only guarantees', () => {
    const schemas = validators()
    const report = structuredClone(json('browser-report.example.json'))
    report.tool = 'crawl-check'
    report.readOnlyGuarantees.externalRequestsAllowed = true
    expect(schemas.get('browser')!(report)).toBe(false)
  })
})
