import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  checklistItemIdsForTool,
  evaluatePilotChecklist,
  loadAssertionRegistry,
  loadPilotCatalog,
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

describe('structured checklist pilot', () => {
  it('validates unique checklist criteria and registered assertions', () => {
    const catalog = loadPilotCatalog()
    const registry = loadAssertionRegistry()

    expect(validateChecklistCatalog(catalog, registry)).toBe(true)
    expect(checklistItemIdsForTool('http-check', catalog, registry)).toEqual([
      'CORE-DOM-02',
      'CORE-DOM-07',
      'CORE-DOM-08',
      'CORE-ERR-01',
      'CORE-ERR-02',
      'CORE-PERF-01',
      'CORE-PERF-05',
    ])
    expect(checklistItemIdsForTool('crawl-check', catalog, registry)).toEqual([
      'CORE-DOM-05',
      'CORE-SEO-01',
      'CORE-SEO-02',
    ])
    expect(() => evaluatePilotChecklist({ assertions: [assertion('unknown.assertion')] })).toThrow(/unbekannte Assertion/)
  })

  it('keeps automatic, manual and external evidence separate', () => {
    const automaticOnly = evaluatePilotChecklist({
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

    const withEditorialReview = evaluatePilotChecklist({
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

  it('does not complete communication or infrastructure points without explicit evidence', () => {
    const open = evaluatePilotChecklist({ itemIds: ['CORE-DOM-04', 'GOV-RGT-02'] })
    expect(open.items.map((item: { id: string, outcome: string }) => [item.id, item.outcome])).toEqual([
      ['CORE-DOM-04', 'open'],
      ['GOV-RGT-02', 'open'],
    ])
    expect(open.summary.nonAutomaticCriteria).toMatchObject({ noEvidence: 3, total: 3 })
    expect(() => evaluatePilotChecklist({
      evidence: [{ criterionId: 'GOV-RGT-02/C1', outcome: 'pass' }],
      itemIds: ['GOV-RGT-02'],
    })).toThrow(/gültiges Datum/)

    const evidenceExample = JSON.parse(readFileSync(new URL('../catalog/project-evidence.example.json', import.meta.url), 'utf8'))
    expect(evidenceExample.catalog).toEqual({ id: 'website-qa-pilot', version: '1.0.0-pilot.2' })
    const evidencedRights = evaluatePilotChecklist({
      evidence: evidenceExample.evidence,
      itemIds: ['GOV-RGT-02'],
    })
    expect(evidencedRights.items[0]?.outcome).toBe('pass')
    expect(evidencedRights.summary.checklistItems.automaticallyPassed).toBe(0)
  })

  it('can fully substantiate a point whose required criteria are automatic', () => {
    const report = evaluatePilotChecklist({
      assertions: [
        assertion('error.not-found.noindex'),
        assertion('error.not-found.no-url-metadata'),
      ],
      itemIds: ['CORE-ERR-02'],
    })

    expect(report.items[0]?.outcome).toBe('pass')
    expect(report.summary.checklistItems).toMatchObject({ automaticallyPassed: 1, pass: 1, total: 1 })
  })

  it('keeps pilot statements synchronized with their Markdown source points', () => {
    const markdown = [
      readFileSync(new URL('../docs/checklisten/website/kern.md', import.meta.url), 'utf8'),
      readFileSync(new URL('../docs/checklisten/website/module/auftrag-recht-uebergabe.md', import.meta.url), 'utf8'),
    ].join('\n')

    for (const item of loadPilotCatalog().items) {
      const sourceStatement = markdown.match(new RegExp(`^- \\[ \\] \`${item.id}\` (.+)$`, 'm'))?.[1]
      expect(sourceStatement, `Markdown-Quelle für ${item.id}`).toBe(item.statement)
    }
  })
})
