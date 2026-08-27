import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import {
  convertPilotProjectReportToV3,
  createPilotProjectReportFromFiles,
  createPilotProjectReportV3FromFiles,
  validatePilotProjectReportV3,
} from '../src/lib/project-report.mjs'

const catalogDirectory = join(import.meta.dirname, '..', 'catalog')
const configFile = join(catalogDirectory, 'project-report.example.json')

function json(name: string) {
  return JSON.parse(readFileSync(join(catalogDirectory, name), 'utf8'))
}

function versionTwoReport() {
  const report = createPilotProjectReportFromFiles(configFile)
  report.generatedAt = '2026-08-24T12:30:00.000Z'
  return report
}

function versionThreeReport() {
  return convertPilotProjectReportToV3(versionTwoReport())
}

function schemaValidators() {
  const ajv = new Ajv2020.Ajv2020({ allErrors: true, strict: true })
  addFormats.default(ajv)
  const versionTwo = ajv.compile(json('project-report.output.schema.json'))
  const versionThree = ajv.compile(json('project-report.v3.schema.json'))
  return { versionThree, versionTwo }
}

describe('normalized pilot project report schema 3', () => {
  it('normalizes records without changing criteria, item states or totals', () => {
    const versionTwo = versionTwoReport()
    const versionThree = convertPilotProjectReportToV3(versionTwo)
    const criteriaV2 = versionTwo.items.flatMap((item: { criteria: unknown[] }) => item.criteria)
    const criteriaV3 = versionThree.items.flatMap((item: { criteria: Array<{ recordRefs: string[] }> }) => item.criteria)
    const references = criteriaV3.flatMap((criterion: { recordRefs: string[] }) => criterion.recordRefs)

    expect(validatePilotProjectReportV3(versionThree)).toBe(true)
    expect(versionThree.schemaVersion).toBe(3)
    expect(versionThree.records).toHaveLength(46)
    expect(references).toHaveLength(81)
    expect(new Set(references).size).toBe(versionThree.records.length)
    expect(versionThree.records.map((entry: { id: string }) => entry.id)).toEqual(
      versionThree.records.map((_: unknown, index: number) => `R${String(index + 1).padStart(6, '0')}`),
    )
    expect(versionThree.summary.checklistItems).toEqual(versionTwo.summary.checklistItems)
    expect(versionThree.summary.automaticCriteria).toEqual({
      fail: versionTwo.summary.automaticCriteria.fail,
      inconclusive: versionTwo.summary.automaticCriteria.inconclusive,
      noEvidence: versionTwo.summary.automaticCriteria.noEvidence,
      notApplicable: versionTwo.summary.automaticCriteria.notApplicable,
      pass: versionTwo.summary.automaticCriteria.pass,
      total: versionTwo.summary.automaticCriteria.total,
    })
    expect(versionThree.summary.nonAutomaticCriteria).not.toHaveProperty('partial')
    expect(versionThree.summary.nonAutomaticCriteria).not.toHaveProperty('open')

    for (let index = 0; index < criteriaV2.length; index += 1) {
      expect(criteriaV3[index]).toMatchObject({
        id: (criteriaV2[index] as { id: string }).id,
        mode: (criteriaV2[index] as { mode: string }).mode,
        outcome: (criteriaV2[index] as { outcome: string }).outcome,
        statement: (criteriaV2[index] as { statement: string }).statement,
      })
      expect(criteriaV3[index]).not.toHaveProperty('records')
    }
    expect(convertPilotProjectReportToV3(versionTwo)).toEqual(versionThree)

    const repeated = structuredClone(versionTwo)
    const repeatedCriterion = repeated.items
      .flatMap((item: { criteria: Array<{ records: unknown[] }> }) => item.criteria)
      .find((criterion: { records: unknown[] }) => criterion.records.length > 0)!
    repeatedCriterion.records.push(structuredClone(repeatedCriterion.records[0]))
    expect(convertPilotProjectReportToV3(repeated)).toEqual(versionThree)
  })

  it('validates the checked-in example and direct file API against the JSON Schema', () => {
    const { versionThree, versionTwo } = schemaValidators()
    const example = json('project-report.v3.example.json')
    const fromFiles = createPilotProjectReportV3FromFiles(configFile)
    const embedded = versionTwoReport()

    expect(example).toEqual(versionThreeReport())
    expect(versionTwo(embedded), JSON.stringify(versionTwo.errors, null, 2)).toBe(true)
    expect(versionThree(example), JSON.stringify(versionThree.errors, null, 2)).toBe(true)
    expect(versionThree(fromFiles), JSON.stringify(versionThree.errors, null, 2)).toBe(true)
    expect(validatePilotProjectReportV3(example)).toBe(true)

    const legacy = versionTwoReport()
    legacy.technicalRuns[0].contextProvenance.targetUrl = '(ungültige URL)'
    expect(versionTwo(legacy), JSON.stringify(versionTwo.errors, null, 2)).toBe(true)
    const convertedLegacy = convertPilotProjectReportToV3(legacy)
    expect(convertedLegacy.technicalRuns[0].contextProvenance.targetUrl).toBe('matchedAgainstRedactedTechnicalReport')
    expect(versionThree(convertedLegacy), JSON.stringify(versionThree.errors, null, 2)).toBe(true)

    const assertionAsEvidence = versionThreeReport()
    assertionAsEvidence.records.find((entry: { type: string }) => entry.type === 'assertion')!.type = 'evidence'
    expect(versionThree(assertionAsEvidence), JSON.stringify(versionThree.errors, null, 2)).toBe(false)

    const evidenceAsAssertion = versionThreeReport()
    evidenceAsAssertion.records.find((entry: { type: string }) => entry.type === 'evidence')!.type = 'assertion'
    expect(versionThree(evidenceAsAssertion), JSON.stringify(versionThree.errors, null, 2)).toBe(false)
  })

  it('redacts sensitive record details before assigning references', () => {
    const versionTwo = versionTwoReport()
    const criterion = versionTwo.items
      .flatMap((item: { criteria: Array<{ records: Array<{ message?: string, subject?: { url?: string } }> }> }) => item.criteria)
      .find((entry: { records: unknown[] }) => entry.records.length > 0)!
    criterion.records[0].message = 'Bearer secret-token'
    criterion.records[0].subject = { url: 'https://example.com/?token=secret-value' }

    const report = convertPilotProjectReportToV3(versionTwo)
    const serialized = JSON.stringify(report)
    expect(serialized).not.toContain('secret-token')
    expect(serialized).not.toContain('secret-value')
    expect(serialized).toContain('[REDACTED]')
  })

  it('rejects catalog and scope mutations', () => {
    const wrongCatalog = versionThreeReport()
    wrongCatalog.catalog.version = 'unexpected-version'
    expect(() => validatePilotProjectReportV3(wrongCatalog)).toThrow(/verwendet nicht/)

    const withoutCore = versionThreeReport()
    withoutCore.scope.selectedModules = withoutCore.scope.selectedModules.filter((module: string) => module !== 'core')
    expect(() => validatePilotProjectReportV3(withoutCore)).toThrow(/Katalogmodul core/)

    const duplicateModule = versionThreeReport()
    duplicateModule.scope.selectedModules.push(duplicateModule.scope.selectedModules[0])
    expect(() => validatePilotProjectReportV3(duplicateModule)).toThrow(/mehrfach ausgewählte Scope-Einträge/)

    const duplicateItem = versionThreeReport()
    duplicateItem.scope.selectedItemIds.push(duplicateItem.scope.selectedItemIds[0])
    expect(() => validatePilotProjectReportV3(duplicateItem)).toThrow(/mehrfach ausgewählte Scope-Einträge/)
  })

  it('rejects catalog-foreign criteria, item assignments, modes and assertion requirements', () => {
    const unknownCriterion = versionThreeReport()
    unknownCriterion.items[0].criteria[0].id = 'CORE-TEST-99/C1'
    expect(() => validatePilotProjectReportV3(unknownCriterion)).toThrow(/Kriterienzuordnung/)

    const wrongItem = versionThreeReport()
    wrongItem.items[0].criteria[0] = structuredClone(wrongItem.items[1].criteria[0])
    expect(() => validatePilotProjectReportV3(wrongItem)).toThrow(/Kriterienzuordnung/)

    const wrongModule = versionThreeReport()
    wrongModule.items[0].module = 'auftrag-recht-uebergabe'
    expect(() => validatePilotProjectReportV3(wrongModule)).toThrow(/verwendet das Modul/)

    const wrongVersionTwoItem = versionTwoReport()
    wrongVersionTwoItem.items[0].criteria[0] = structuredClone(wrongVersionTwoItem.items[1].criteria[0])
    expect(() => convertPilotProjectReportToV3(wrongVersionTwoItem)).toThrow(/Kriterienzuordnung/)

    const assertionRequirements = versionThreeReport()
    const automaticCriterion = assertionRequirements.items
      .flatMap((item: { criteria: Array<{ mode: string, requiredAssertionIds?: string[] }> }) => item.criteria)
      .find((criterion: { mode: string }) => criterion.mode === 'automatic')!
    automaticCriterion.requiredAssertionIds = ['unexpected.assertion']
    expect(() => validatePilotProjectReportV3(assertionRequirements)).toThrow(/Erforderliche Assertions/)

    const wrongMode = versionThreeReport()
    const criterionWithWrongMode = wrongMode.items
      .flatMap((item: { criteria: Array<{ mode: string }> }) => item.criteria)
      .find((criterion: { mode: string }) => criterion.mode === 'automatic')!
    criterionWithWrongMode.mode = 'manual'
    expect(() => validatePilotProjectReportV3(wrongMode)).toThrow(/Katalogmodus/)

    const unexpectedAssertion = versionThreeReport()
    const automaticWithRecord = unexpectedAssertion.items
      .flatMap((item: { criteria: Array<{ mode: string, recordRefs: string[] }> }) => item.criteria)
      .find((criterion: { mode: string, recordRefs: string[] }) => criterion.mode === 'automatic' && criterion.recordRefs.length > 0)!
    const assertionRecord = unexpectedAssertion.records.find((entry: { id: string }) => entry.id === automaticWithRecord.recordRefs[0])!
    assertionRecord.record.assertionId = 'unexpected.assertion'
    expect(() => validatePilotProjectReportV3(unexpectedAssertion)).toThrow(/nicht erforderliche Assertion/)

    const foreignEvidence = versionThreeReport()
    const recordedWithEvidence = foreignEvidence.items
      .flatMap((item: { criteria: Array<{ mode: string, recordRefs: string[] }> }) => item.criteria)
      .find((criterion: { mode: string, recordRefs: string[] }) => criterion.mode !== 'automatic' && criterion.recordRefs.length > 0)!
    const evidenceRecord = foreignEvidence.records.find((entry: { id: string }) => entry.id === recordedWithEvidence.recordRefs[0])!
    evidenceRecord.record.criterionId = 'CORE-TEST-99/C1'
    expect(() => validatePilotProjectReportV3(foreignEvidence)).toThrow(/verweist auf Evidence/)
  })

  it('rejects broken, duplicate, mistyped and orphaned references', () => {
    const unknown = versionThreeReport()
    unknown.items[0].criteria[0].recordRefs = ['R999999']
    expect(() => validatePilotProjectReportV3(unknown)).toThrow(/unbekannten Record/)

    const duplicate = versionThreeReport()
    const criterionWithRecord = duplicate.items.flatMap((item: { criteria: Array<{ recordRefs: string[] }> }) => item.criteria)
      .find((criterion: { recordRefs: string[] }) => criterion.recordRefs.length > 0)!
    criterionWithRecord.recordRefs.push(criterionWithRecord.recordRefs[0])
    expect(() => validatePilotProjectReportV3(duplicate)).toThrow(/eindeutigen Recordreferenzen/)

    const mistyped = versionThreeReport()
    mistyped.records[0].type = 'evidence'
    expect(() => validatePilotProjectReportV3(mistyped)).toThrow(/ungeeigneten Record/)

    const orphaned = versionThreeReport()
    orphaned.records.push({
      ...structuredClone(orphaned.records.at(-1)),
      id: `R${String(orphaned.records.length + 1).padStart(6, '0')}`,
      record: {
        ...structuredClone(orphaned.records.at(-1).record),
        note: 'Nicht referenzierter zusätzlicher Record.',
      },
    })
    expect(() => validatePilotProjectReportV3(orphaned)).toThrow(/nicht referenzierte Records/)
  })

  it('rejects changed outcomes and non-summable criterion counts', () => {
    const outcome = versionThreeReport()
    outcome.items[0].criteria[0].outcome = 'fail'
    expect(() => validatePilotProjectReportV3(outcome)).toThrow(/hat fail statt/)

    const status = versionThreeReport()
    status.items.find((item: { workflow?: unknown }) => !item.workflow)!.projectStatus = 'failed'
    expect(() => validatePilotProjectReportV3(status)).toThrow(/Projektstatus/)

    const counts = versionThreeReport()
    counts.summary.automaticCriteria.pass += 1
    expect(() => validatePilotProjectReportV3(counts)).toThrow(/nicht summengleich/)
  })
})
