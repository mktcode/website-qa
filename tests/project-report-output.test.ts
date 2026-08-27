import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import * as reportApi from '../src/lib/project-report.mjs'
import {
  createProjectReportFromFiles,
  renderProjectReportMarkdown,
  renderProjectSummaryMarkdown,
  validateProjectReport,
} from '../src/lib/project-report.mjs'

const catalogDirectory = join(import.meta.dirname, '..', 'catalog')
const configFile = join(catalogDirectory, 'project-report.config.example.json')

function json(name: string) {
  return JSON.parse(readFileSync(join(catalogDirectory, name), 'utf8'))
}

function report() {
  const result = createProjectReportFromFiles(configFile)
  result.generatedAt = '2026-08-24T12:30:00.000Z'
  return result
}

describe('normalized project report schema 3', () => {
  it('exposes only stable report APIs and creates normalized output directly', () => {
    expect(Object.keys(reportApi)).toEqual([
      'createProjectReport',
      'createProjectReportFromFiles',
      'validateProjectReport',
      'renderProjectReportMarkdown',
      'renderProjectSummaryMarkdown',
      'writeProjectReportBundle',
    ])
    const first = report()
    const second = report()
    const references = first.items.flatMap((item: { criteria: Array<{ recordRefs: string[] }> }) => item.criteria)
      .flatMap((criterion: { recordRefs: string[] }) => criterion.recordRefs)

    expect(first).toEqual(second)
    expect(first.schemaVersion).toBe(3)
    expect(first.records).toHaveLength(46)
    expect(references).toHaveLength(81)
    expect(new Set(references).size).toBe(first.records.length)
    expect(first.records.map((entry: { id: string }) => entry.id)).toEqual(
      first.records.map((_: unknown, index: number) => `R${String(index + 1).padStart(6, '0')}`),
    )
    expect(first.items.flatMap((item: { criteria: unknown[] }) => item.criteria).every((criterion: object) => !('records' in criterion))).toBe(true)
    expect(first.records.filter((entry: { type: string }) => entry.type === 'assertion')
      .every((entry: { record: { tool?: string } }) => typeof entry.record.tool === 'string')).toBe(true)
    expect(validateProjectReport(first)).toBe(true)
  })

  it('validates the deterministic example against the sole report JSON Schema', () => {
    const ajv = new Ajv2020.Ajv2020({ allErrors: true, strict: true })
    addFormats.default(ajv)
    const validator = ajv.compile(json('project-report.schema.json'))
    const example = json('project-report.example.json')

    expect(example).toEqual(report())
    expect(validator(example), JSON.stringify(validator.errors, null, 2)).toBe(true)

    const invalidTargetProvenance = report()
    invalidTargetProvenance.technicalRuns[0].contextProvenance.targetUrl = '(ungültige URL)'
    expect(validator(invalidTargetProvenance), JSON.stringify(validator.errors, null, 2)).toBe(false)
  })

  it('rejects schema 2, unknown fields and catalog or scope mutations', () => {
    const schemaTwo = report()
    schemaTwo.schemaVersion = 2
    expect(() => validateProjectReport(schemaTwo)).toThrow(/JSON-Schema/)
    expect(() => renderProjectReportMarkdown(schemaTwo)).toThrow(/JSON-Schema/)
    expect(() => renderProjectSummaryMarkdown(schemaTwo)).toThrow(/JSON-Schema/)

    const unknownField = Object.assign(report(), { legacy: true })
    expect(() => validateProjectReport(unknownField)).toThrow(/JSON-Schema/)

    const wrongCatalog = report()
    wrongCatalog.catalog.version = 'unexpected-version'
    expect(() => validateProjectReport(wrongCatalog)).toThrow(/JSON-Schema/)

    const wrongCatalogStatus = report()
    wrongCatalogStatus.catalog.status = 'experimental'
    expect(() => validateProjectReport(wrongCatalogStatus)).toThrow(/JSON-Schema/)

    const withoutCore = report()
    withoutCore.scope.selectedModules = withoutCore.scope.selectedModules.filter((module: string) => module !== 'core')
    expect(() => validateProjectReport(withoutCore)).toThrow(/Katalogmodul core/)
  })

  it('rejects catalog-foreign criteria, modes and assertion requirements', () => {
    const unknownCriterion = report()
    unknownCriterion.items[0].criteria[0].id = 'CORE-TEST-99/C1'
    expect(() => validateProjectReport(unknownCriterion)).toThrow(/Kriterienzuordnung/)

    const wrongModule = report()
    wrongModule.items[0].module = 'auftrag-recht-uebergabe'
    expect(() => validateProjectReport(wrongModule)).toThrow(/verwendet das Modul/)

    const changedStatement = report()
    changedStatement.items[0].criteria[0].statement = 'Andere Aussage.'
    expect(() => validateProjectReport(changedStatement)).toThrow(/Nachweisdefinition/)

    const wrongAssertionVersion = report()
    wrongAssertionVersion.records.find((entry: { type: string }) => entry.type === 'assertion')!.record.assertionVersion += 1
    expect(() => validateProjectReport(wrongAssertionVersion)).toThrow(/Werkzeug-Assertion/)

    const requirements = report()
    const automatic = requirements.items.flatMap((item: { criteria: Array<{ mode: string, requiredAssertionIds?: string[] }> }) => item.criteria)
      .find((criterion: { mode: string }) => criterion.mode === 'automatic')!
    automatic.requiredAssertionIds = ['unexpected.assertion']
    expect(() => validateProjectReport(requirements)).toThrow(/Erforderliche Assertions/)
  })

  it('rejects broken, duplicate, mistyped and orphaned references', () => {
    const unknown = report()
    const criterionWithRecord = unknown.items.flatMap((item: { criteria: Array<{ recordRefs: string[] }> }) => item.criteria)
      .find((criterion: { recordRefs: string[] }) => criterion.recordRefs.length > 0)!
    criterionWithRecord.recordRefs = ['R999999']
    expect(() => validateProjectReport(unknown)).toThrow(/unbekannten Record/)

    const duplicate = report()
    const duplicatedRefs = duplicate.items.flatMap((item: { criteria: Array<{ recordRefs: string[] }> }) => item.criteria)
      .find((criterion: { recordRefs: string[] }) => criterion.recordRefs.length > 0)!
    duplicatedRefs.recordRefs.push(duplicatedRefs.recordRefs[0])
    expect(() => validateProjectReport(duplicate)).toThrow(/JSON-Schema/)

    const mistyped = report()
    mistyped.records[0].type = 'evidence'
    expect(() => validateProjectReport(mistyped)).toThrow(/JSON-Schema/)

    const orphaned = report()
    orphaned.records.push({
      ...structuredClone(orphaned.records.at(-1)),
      id: `R${String(orphaned.records.length + 1).padStart(6, '0')}`,
      record: { ...structuredClone(orphaned.records.at(-1).record), note: 'Zusätzlicher Record.' },
    })
    expect(() => validateProjectReport(orphaned)).toThrow(/nicht referenzierte Records/)
  })

  it('rejects schema-invalid project fields and inconsistent workflow or tool bindings', () => {
    const invalidPreferredUrl = report()
    invalidPreferredUrl.project.preferredUrl = 'not a URL'
    expect(() => validateProjectReport(invalidPreferredUrl)).toThrow(/JSON-Schema/)

    const invalidEvidenceDate = report()
    invalidEvidenceDate.records.find((entry: { type: string }) => entry.type === 'evidence')!.record.checkedAt = '2026-02-30'
    expect(() => validateProjectReport(invalidEvidenceDate)).toThrow(/JSON-Schema/)

    const invalidWorkflowDate = report()
    invalidWorkflowDate.items.find((item: { workflow?: unknown }) => item.workflow)!.workflow.recordedAt = '2026-02-30'
    expect(() => validateProjectReport(invalidWorkflowDate)).toThrow(/JSON-Schema/)

    const wrongWorkflowItem = report()
    const workflowItem = wrongWorkflowItem.items.find((item: { workflow?: unknown }) => item.workflow)!
    workflowItem.workflow.itemId = 'CORE-ERR-01'
    expect(() => validateProjectReport(wrongWorkflowItem)).toThrow(/anderen Checklistenpunkt/)

    const missingResponsible = report()
    delete missingResponsible.items.find((item: { workflow?: unknown }) => item.workflow)!.workflow.responsible
    expect(() => validateProjectReport(missingResponsible)).toThrow(/JSON-Schema/)

    const missingReview = report()
    const deferredWorkflow = missingReview.items.find((item: { workflow?: unknown }) => item.workflow)!.workflow
    deferredWorkflow.status = 'deferred'
    delete deferredWorkflow.reviewAt
    expect(() => validateProjectReport(missingReview)).toThrow(/JSON-Schema/)

    const wrongTool = report()
    const assertionRecord = wrongTool.records.find((entry: { type: string }) => entry.type === 'assertion')!.record
    assertionRecord.tool = assertionRecord.tool === 'http-check' ? 'crawl-check' : 'http-check'
    expect(() => validateProjectReport(wrongTool)).toThrow(/Werkzeug-Assertion/)

    const withoutUsedRun = report()
    withoutUsedRun.technicalRuns.forEach((run: { usedForEvaluation: boolean }) => {
      run.usedForEvaluation = false
    })
    expect(() => validateProjectReport(withoutUsedRun)).toThrow(/Werkzeug-Assertion/)
  })

  it('rejects changed outcomes and non-summable counts', () => {
    const outcome = report()
    outcome.items[0].criteria[0].outcome = 'fail'
    expect(() => validateProjectReport(outcome)).toThrow(/hat fail statt/)

    const status = report()
    status.items.find((item: { workflow?: unknown }) => !item.workflow)!.projectStatus = 'failed'
    expect(() => validateProjectReport(status)).toThrow(/Projektstatus/)

    const counts = report()
    counts.summary.automaticCriteria.pass += 1
    expect(() => validateProjectReport(counts)).toThrow(/nicht summengleich/)
  })
})
