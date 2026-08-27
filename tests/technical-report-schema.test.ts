import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'

const catalogDirectory = join(import.meta.dirname, '..', 'catalog')
const tools = [
  { name: 'http', source: 'check-http.mjs', tool: 'http-check' },
  { name: 'crawl', source: 'check-crawl.mjs', tool: 'crawl-check' },
  { name: 'browser', source: 'check-browser.mjs', tool: 'browser-check' },
  { name: 'social', source: 'check-social-preview.mjs', tool: 'social-preview-check' },
  { name: 'lighthouse', source: 'check-lighthouse.mjs', tool: 'lighthouse-check' },
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

function allReportsValidator() {
  const ajv = new Ajv2020.Ajv2020({ allErrors: true, strict: true })
  addFormats.default(ajv)
  ajv.addSchema(json('technical-report.common.schema.json'))
  for (const { name } of tools) {
    ajv.addSchema(json(`${name}-report.schema.json`))
  }
  return ajv.compile(json('technical-report.schema.json'))
}

function validationMessage(errors: unknown) {
  return JSON.stringify(errors, null, 2)
}

describe('technical report schemas', () => {
  it('validates all five published static examples', () => {
    const schemas = validators()
    for (const { name } of tools) {
      const validate = schemas.get(name)!
      expect(validate(json(`${name}-report.example.json`)), validationMessage(validate.errors)).toBe(true)
    }
  })

  it('dispatches generic report validation and rejects arbitrary JSON', () => {
    const validate = allReportsValidator()
    for (const { name } of tools) {
      expect(validate(json(`${name}-report.example.json`)), validationMessage(validate.errors)).toBe(true)
    }
    expect(validate({ arbitrary: true })).toBe(false)
  })

  it('contains only technical signals and informational checklist references', () => {
    for (const { name } of tools) {
      const serialized = JSON.stringify(json(`${name}-report.example.json`))
      expect(serialized).not.toContain('checklistCoverage')
      expect(serialized).not.toContain('checklistIds')
      expect(serialized).not.toContain('"assertions"')
      expect(serialized).not.toContain('projectStatus')
      expect(serialized).not.toContain('evidenceOutcome')
      expect(serialized).not.toContain('noEvidence')
      expect(serialized).not.toContain('workflow')
    }
  })

  it('validates the real exit-code-2 CLI error envelopes', () => {
    const schemas = validators()
    for (const { name, source, tool } of tools) {
      const child = spawnSync(process.execPath, [join(import.meta.dirname, '..', 'src', source), 'not-a-url', '--json'], {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      })
      expect(child.status, child.stderr).toBe(2)
      const report = JSON.parse(child.stdout)
      expect(report.tool).toBe(tool)
      const validate = schemas.get(name)!
      expect(validate(report), validationMessage(validate.errors)).toBe(true)
    }
  })

  it('preserves schema-valid JSON output for real CLI parser failures', () => {
    const schemas = validators()
    for (const { name, source } of tools) {
      const child = spawnSync(process.execPath, [join(import.meta.dirname, '..', 'src', source), '--json', '--unknown-option'], {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      })
      expect(child.status, child.stderr).toBe(2)
      const report = JSON.parse(child.stdout)
      const validate = schemas.get(name)!
      expect(validate(report), validationMessage(validate.errors)).toBe(true)
    }
  })

  it('requires package provenance in error envelopes', () => {
    const schemas = validators()
    for (const { name, tool } of tools) {
      const report = {
        error: 'Ungültige Eingabe.',
        schemaVersion: 2,
        tool,
      }
      expect(schemas.get(name)!(report)).toBe(false)
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
  })

  it('rejects removed top-level reporting surfaces for every tool', () => {
    const schemas = validators()
    for (const { name } of tools) {
      const report = structuredClone(json(`${name}-report.example.json`))
      report.projectStatus = 'complete'
      report.checklistCoverage = { complete: 215 }
      expect(schemas.get(name)!(report)).toBe(false)
    }
  })

  it('keeps additive Social options compatible within schema version 2', () => {
    const validate = validators().get('social')!
    const previousReport = structuredClone(json('social-report.example.json'))
    delete previousReport.options.maxSitemaps
    expect(validate(previousReport), validationMessage(validate.errors)).toBe(true)
  })

  it('requires bounded Social policy source verification', () => {
    const validate = validators().get('social')!
    const missingSummary = structuredClone(json('social-report.example.json'))
    delete missingSummary.robotsPolicySourceSummary
    expect(validate(missingSummary)).toBe(false)

    const missingPolicyStatus = structuredClone(json('social-report.example.json'))
    delete missingPolicyStatus.results[0].robots.policies[0].sourceVerification
    expect(validate(missingPolicyStatus)).toBe(false)

    const unknownPolicyStatus = structuredClone(json('social-report.example.json'))
    unknownPolicyStatus.results[0].robots.policies[0].sourceVerification = 'assumedCurrent'
    expect(validate(unknownPolicyStatus)).toBe(false)
  })

  it('rejects weakened or incomplete Lighthouse contracts and oversized URLs', () => {
    const validate = validators().get('lighthouse')!
    const weakened = structuredClone(json('lighthouse-report.example.json'))
    weakened.readOnlyGuarantees.externalRequestsAllowed = true
    weakened.coverage.interceptionInstalledBeforeNavigation = false
    expect(validate(weakened)).toBe(false)

    const missingOptions = structuredClone(json('lighthouse-report.example.json'))
    missingOptions.options = {}
    expect(validate(missingOptions)).toBe(false)

    const oversizedUrl = structuredClone(json('lighthouse-report.example.json'))
    oversizedUrl.blockedActions = [{ kind: 'worker', url: `https://example.com/${'x'.repeat(2048)}` }]
    expect(validate(oversizedUrl)).toBe(false)
  })
})
