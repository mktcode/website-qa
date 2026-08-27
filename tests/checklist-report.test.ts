import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  checklistItemIdsForTool,
  evaluateChecklist,
  loadAssertionRegistry,
  loadWebsiteCatalog,
  validateChecklistCatalog,
} from '../src/lib/checklist-report.mjs'

function assertion(assertionId: string, outcome: 'fail' | 'inconclusive' | 'notApplicable' | 'pass' = 'pass') {
  return {
    assertionId,
    assertionVersion: 1,
    outcome,
    subject: { url: 'https://example.com/' },
  }
}

function evidenceRecord(outcome: 'fail' | 'inconclusive' | 'notApplicable' | 'pass', checkedAt: string) {
  return {
    checkedAt,
    checkedBy: 'verantwortliche Stelle',
    criterionId: 'GOV-RGT-02/C1',
    note: `Aktiver Nachweis mit Ergebnis ${outcome}.`,
    outcome,
  }
}

describe('structured baseline checklist', () => {
  it('validates unique checklist criteria and registered assertions', () => {
    const catalog = loadWebsiteCatalog()
    const registry = loadAssertionRegistry()

    expect(validateChecklistCatalog(catalog, registry)).toBe(true)
    expect(catalog).toMatchObject({ catalogVersion: '1.2.0' })
    expect(catalog.items).toHaveLength(44)
    expect(catalog.items.flatMap((item: { criteria: unknown[] }) => item.criteria)).toHaveLength(118)
    expect(registry.assertions).toHaveLength(64)
    expect(checklistItemIdsForTool('http-check', catalog, registry)).toEqual([
      'CORE-DOM-02',
      'CORE-DOM-07',
      'CORE-DOM-08',
      'CORE-ERR-01',
      'CORE-ERR-02',
      'CORE-ERR-04',
      'CORE-PERF-01',
      'CORE-PERF-05',
      'CORE-SEC-04',
      'CORE-SEC-05',
      'CORE-SEC-07',
    ])
    expect(checklistItemIdsForTool('crawl-check', catalog, registry)).toEqual([
      'CORE-DOM-05',
      'CORE-DOM-06',
      'CORE-ERR-03',
      'CORE-SEO-01',
      'CORE-SEO-02',
      'CORE-MAP-01',
      'CORE-MAP-02',
      'CORE-SEO-04',
      'CORE-QA-05',
      'CORE-QA-08',
      'MEDIA-PERF-04',
    ])
    expect(checklistItemIdsForTool('browser-check', catalog, registry)).toEqual([
      'CORE-A11Y-01',
      'CORE-A11Y-03',
      'CORE-A11Y-04',
      'CORE-A11Y-06',
      'CORE-A11Y-08',
      'CORE-A11Y-09',
      'CORE-A11Y-10',
      'CORE-A11Y-13',
      'CORE-QA-02',
      'CORE-QA-07',
      'CORE-PRIV-02',
      'CORE-PRIV-04',
      'CORE-SEC-07',
      'FORM-TEST-04',
    ])
    expect(checklistItemIdsForTool('social-preview-check', catalog, registry)).toEqual([
      'CORE-DOM-06',
      'CORE-SOC-01',
      'CORE-SOC-02',
      'CORE-ROB-01',
      'CORE-ROB-02',
      'CORE-ROB-03',
      'CORE-ROB-04',
    ])
    expect(() => evaluateChecklist({ assertions: [assertion('unknown.assertion')] })).toThrow(/unbekannte Assertion/)
  })

  it('keeps automatic, manual and external evidence separate', () => {
    const automaticOnly = evaluateChecklist({
      assertions: [
        assertion('error.not-found.status-404'),
        assertion('error.not-found.no-technical-details'),
      ],
      itemIds: ['CORE-ERR-01'],
    })

    expect(automaticOnly.items[0]).toMatchObject({
      id: 'CORE-ERR-01',
      outcome: 'partial',
    })
    expect(automaticOnly.summary).toMatchObject({
      automaticCriteria: { pass: 2, total: 2 },
      checklistItems: { pass: 0, partial: 1, total: 1 },
      nonAutomaticCriteria: { noEvidence: 1, total: 1 },
    })

    const withEditorialReview = evaluateChecklist({
      assertions: automaticOnly.items[0]?.criteria.flatMap((criterion: { records: ReturnType<typeof assertion>[] }) => criterion.records) || [],
      evidence: [{
        checkedAt: '2026-08-24',
        checkedBy: 'Prüfperson',
        criterionId: 'CORE-ERR-01/C3',
        note: 'Fehlerseite redaktionell und visuell geprüft.',
        outcome: 'pass',
      }],
      itemIds: ['CORE-ERR-01'],
    })

    expect(withEditorialReview.items[0]?.outcome).toBe('pass')
    expect(withEditorialReview.summary.checklistItems).toMatchObject({
      automaticallyPassed: 0,
      pass: 1,
    })
  })

  it('aggregates every active manual or external evidence record conservatively', () => {
    const evaluate = (outcomes: Array<'fail' | 'inconclusive' | 'notApplicable' | 'pass'>) => evaluateChecklist({
      evidence: outcomes.map((outcome, index) => evidenceRecord(outcome, `2026-08-${String(index + 20).padStart(2, '0')}`)),
      itemIds: ['GOV-RGT-02'],
    })

    expect(evaluate(['pass', 'fail']).items[0]?.criteria[0]).toMatchObject({ outcome: 'fail', records: expect.arrayContaining([
      expect.objectContaining({ outcome: 'pass' }),
      expect.objectContaining({ outcome: 'fail' }),
    ]) })
    expect(evaluate(['pass', 'inconclusive']).items[0]?.criteria[0]?.outcome).toBe('inconclusive')
    expect(evaluate(['pass', 'notApplicable']).items[0]?.criteria[0]?.outcome).toBe('pass')
    expect(evaluate(['notApplicable', 'notApplicable']).items[0]?.criteria[0]?.outcome).toBe('notApplicable')
  })

  it('does not complete communication or infrastructure points without explicit evidence', () => {
    const open = evaluateChecklist({ itemIds: ['CORE-DOM-04', 'GOV-RGT-02'] })
    expect(open.items.map((item: { id: string, outcome: string }) => [item.id, item.outcome])).toEqual([
      ['CORE-DOM-04', 'open'],
      ['GOV-RGT-02', 'open'],
    ])
    expect(open.summary.nonAutomaticCriteria).toMatchObject({ noEvidence: 3, total: 3 })
    expect(() => evaluateChecklist({
      evidence: [{ criterionId: 'GOV-RGT-02/C1', outcome: 'pass' }],
      itemIds: ['GOV-RGT-02'],
    })).toThrow(/gültiges Datum/)

    const evidenceExample = JSON.parse(readFileSync(new URL('../catalog/project-evidence.example.json', import.meta.url), 'utf8'))
    expect(evidenceExample.catalog).toEqual({ id: 'website-qa-baseline', version: '1.2.0' })
    const evidencedRights = evaluateChecklist({
      evidence: evidenceExample.evidence,
      itemIds: ['GOV-RGT-02'],
    })
    expect(evidencedRights.items[0]?.outcome).toBe('pass')
    expect(evidencedRights.summary.checklistItems.automaticallyPassed).toBe(0)
  })

  it('keeps editorial accessibility review open after bounded Axe assertions pass', () => {
    const report = evaluateChecklist({
      assertions: [
        'browser.accessibility.control-names-no-detected-violations',
        'browser.accessibility.links-not-color-only-no-detected-violations',
        'browser.accessibility.image-alternatives-no-detected-violations',
        'browser.accessibility.text-contrast-no-detected-violations',
      ].map(assertionId => assertion(assertionId)),
      itemIds: ['CORE-A11Y-03', 'CORE-A11Y-08', 'CORE-A11Y-09'],
    })

    expect(report.items.every((item: { outcome: string }) => item.outcome === 'partial')).toBe(true)
    expect(report.summary).toMatchObject({
      automaticCriteria: { pass: 4, total: 4 },
      checklistItems: { pass: 0, partial: 3, total: 3 },
      nonAutomaticCriteria: { noEvidence: 5, total: 5 },
    })
  })

  it('keeps project scope, APIs, external links and dynamic resources open after a complete crawl', () => {
    const crawlAssertions = [
      'crawl.sitemap.file-valid',
      'crawl.sitemap.robots-reference-present',
      'crawl.sitemap.entries-valid',
      'crawl.sitemap.coverage-complete',
      'crawl.navigation.internal-valid',
      'crawl.navigation.internal-direct',
      'crawl.resources.status-valid',
      'crawl.resources.mime-valid',
      'crawl.run.coverage-complete',
    ].map(assertionId => assertion(assertionId))
    const report = evaluateChecklist({
      assertions: crawlAssertions,
      itemIds: ['CORE-ERR-03', 'CORE-MAP-01', 'CORE-MAP-02', 'CORE-SEO-04', 'CORE-QA-05', 'CORE-QA-08'],
    })

    expect(report.items.every((item: { outcome: string }) => item.outcome === 'partial')).toBe(true)
    expect(report.summary).toMatchObject({
      automaticCriteria: { pass: 10, total: 10 },
      checklistItems: { pass: 0, partial: 6, total: 6 },
      nonAutomaticCriteria: { noEvidence: 6, total: 6 },
    })
  })

  it('keeps policy suitability and proxy boundaries open after complete public header observations', () => {
    const securityAssertions = [
      'http.hsts.present',
      'http.hsts.max-age-adequate',
      'http.security.csp-declared',
      'http.security.framing-protection-present',
      'http.security.nosniff-valid',
      'http.security.referrer-policy-declared',
      'http.security.permissions-policy-declared',
      'http.security.document-response-coverage-complete',
      'http.security.selected-response-coverage-complete',
      'error.not-found.noindex',
      'cache.not-found.not-publicly-cacheable',
    ].map(assertionId => assertion(assertionId))
    const report = evaluateChecklist({
      assertions: securityAssertions,
      itemIds: ['CORE-ERR-04', 'CORE-SEC-04', 'CORE-SEC-05'],
    })

    expect(report.items.every((item: { outcome: string }) => item.outcome === 'partial')).toBe(true)
    expect(report.summary).toMatchObject({
      automaticCriteria: { pass: 8, total: 8 },
      checklistItems: { pass: 0, partial: 3, total: 3 },
      nonAutomaticCriteria: { noEvidence: 3, total: 3 },
    })
  })

  it('keeps privacy interpretation and consent review open after complete passive observations', () => {
    const report = evaluateChecklist({
      assertions: [
        assertion('browser.privacy.external-request-observation-complete'),
        assertion('browser.privacy.initial-storage-observation-complete'),
      ],
      itemIds: ['CORE-PRIV-02', 'CORE-PRIV-04'],
    })

    expect(report.items.every((item: { outcome: string }) => item.outcome === 'partial')).toBe(true)
    expect(report.summary).toMatchObject({
      automaticCriteria: { pass: 2, total: 2 },
      checklistItems: { pass: 0, partial: 2, total: 2 },
      nonAutomaticCriteria: { noEvidence: 3, total: 3 },
    })
  })

  it('keeps the seven passive slice items partial while manual remainders are open', () => {
    const report = evaluateChecklist({
      assertions: [
        'crawl.canonical.matches-final-url',
        'social.metadata.canonical-open-graph-consistent',
        'social.robots.training-access-blocked-or-declared',
        'browser.accessibility.visually-hidden-focusable-controls-no-detected-violations',
        'browser.accessibility.form-control-labels-no-detected-violations',
        'browser.runtime.no-observed-errors',
        'error.not-found.status-404',
        'error.not-found.no-technical-details',
        'browser.run.read-only-boundaries-enforced',
        'crawl.media.get-observation-complete',
      ].map(assertionId => assertion(assertionId)),
      itemIds: ['CORE-DOM-06', 'CORE-ROB-03', 'CORE-A11Y-04', 'CORE-A11Y-06', 'CORE-SEC-07', 'FORM-TEST-04', 'MEDIA-PERF-04'],
    })

    expect(report.items.every((item: { outcome: string }) => item.outcome === 'partial')).toBe(true)
    expect(report.summary).toMatchObject({
      automaticCriteria: { pass: 9, total: 9 },
      checklistItems: { pass: 0, partial: 7, total: 7 },
      nonAutomaticCriteria: { noEvidence: 7, total: 7 },
    })
  })

  it('can fully substantiate a point whose required criteria are automatic', () => {
    const report = evaluateChecklist({
      assertions: [
        assertion('error.not-found.noindex'),
        assertion('error.not-found.no-url-metadata'),
      ],
      itemIds: ['CORE-ERR-02'],
    })

    expect(report.items[0]?.outcome).toBe('pass')
    expect(report.summary.checklistItems).toMatchObject({ automaticallyPassed: 1, pass: 1, total: 1 })
  })

  it('keeps baseline statements synchronized with their Markdown source points', () => {
    const markdown = [
      readFileSync(new URL('../docs/checklisten/website/kern.md', import.meta.url), 'utf8'),
      readFileSync(new URL('../docs/checklisten/website/module/auftrag-recht-uebergabe.md', import.meta.url), 'utf8'),
      readFileSync(new URL('../docs/checklisten/website/module/formulare-api-daten.md', import.meta.url), 'utf8'),
      readFileSync(new URL('../docs/checklisten/website/module/medien-animationen.md', import.meta.url), 'utf8'),
    ].join('\n')

    for (const item of loadWebsiteCatalog().items) {
      const sourceStatement = markdown.match(new RegExp(`^- \\[ \\] \`${item.id}\` (.+)$`, 'm'))?.[1]
      expect(sourceStatement, `Markdown-Quelle für ${item.id}`).toBe(item.statement)
    }
  })
})
