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

  it('regenerates all published reports byte for byte without trusting assertions changed in this slice', () => {
    const schemas = validators()
    const examples = Object.fromEntries(tools.map(({ name }) => [name, json(`${name}-report.example.json`)]))
    const browserInput = structuredClone(examples.browser.result)
    delete browserInput.assertions
    const crawlInput = structuredClone(examples.crawl.results)
    for (const result of crawlInput) {
      result.assertions = result.assertions.filter((assertion: { assertionId: string }) => assertion.assertionId !== 'crawl.media.get-observation-complete')
    }
    const reports = {
      browser: createBrowserReport(browserInput, examples.browser.options),
      crawl: createCrawlReport(crawlInput, examples.crawl.options),
      http: createHttpReport(examples.http.results, examples.http.options),
      social: createSocialReport(examples.social.results.map((result: Record<string, any>) => ({
        ...result,
        assertions: undefined,
        metadata: result.metadata
          ? {
              canonicals: result.metadata.canonical ? [result.metadata.canonical] : [],
              metadata: Object.fromEntries([...Object.entries(result.metadata.openGraph || {}), ...Object.entries(result.metadata.twitter || {})]
                .map(([key, value]) => [key, Array.isArray(value) ? value : [value]])),
            }
          : undefined,
      })), examples.social.options),
    }

    expect(reports.crawl.results[0].assertions.find((assertion: { assertionId: string }) => assertion.assertionId === 'crawl.media.get-observation-complete')?.outcome).toBe('notApplicable')
    for (const { name } of tools) {
      const report = reports[name as keyof typeof reports]
      report.generatedAt = examples[name].generatedAt
      const validate = schemas.get(name)!
      expect(validate(report), validationMessage(validate.errors)).toBe(true)
      expect(`${JSON.stringify(report, null, 2)}\n`).toBe(readFileSync(join(catalogDirectory, `${name}-report.example.json`), 'utf8'))
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

  it('rejects missing or overstated browser read-only execution evidence', () => {
    const validate = validators().get('browser')!
    const missing = structuredClone(json('browser-report.example.json'))
    delete missing.result.readOnlyExecutionEvidence
    expect(validate(missing)).toBe(false)

    const overstated = structuredClone(json('browser-report.example.json'))
    overstated.result.readOnlyExecutionEvidence.destinationSideEffectsVerified = true
    expect(validate(overstated)).toBe(false)

    const malformed = structuredClone(json('browser-report.example.json'))
    malformed.result.readOnlyExecutionEvidence.profileRuns[0].interceptedRequests = -1
    expect(validate(malformed)).toBe(false)
  })

  it('rejects another tool and weakened read-only guarantees', () => {
    const schemas = validators()
    const report = structuredClone(json('browser-report.example.json'))
    report.tool = 'crawl-check'
    report.readOnlyGuarantees.externalRequestsAllowed = true
    expect(schemas.get('browser')!(report)).toBe(false)
  })
})
