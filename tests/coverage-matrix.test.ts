import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryDirectory = join(import.meta.dirname, '..')
const matrix = JSON.parse(
  readFileSync(join(repositoryDirectory, 'planning', 'website-coverage-matrix.json'), 'utf8'),
)
const baseline = JSON.parse(
  readFileSync(join(repositoryDirectory, 'catalog', 'website-baseline.json'), 'utf8'),
)

const classifications = [
  'existing-baseline',
  'direct-get-candidate',
  'observation-candidate',
  'project-local-or-manifest',
  'manual-external-administrative',
  'unsafe-or-mutating',
]
const contexts = new Set([
  'url-get',
  'browser-passive',
  'project-manifest',
  'project-local',
  'infrastructure-access',
  'human-review',
  'external-platform',
  'mutating-test',
])
const priorities = ['high', 'medium', 'low', 'none']
const moduleBySource: Record<string, string> = {
  'docs/checklisten/website/kern.md': 'core',
  'docs/checklisten/website/module/auftrag-recht-uebergabe.md': 'auftrag-recht-uebergabe',
  'docs/checklisten/website/module/formulare-api-daten.md': 'formulare-api-daten',
  'docs/checklisten/website/module/medien-animationen.md': 'medien-animationen',
  'docs/checklisten/website/module/umgebungen-domainmigration.md': 'umgebungen-domainmigration',
  'docs/checklisten/website/module/container-deployment.md': 'container-deployment',
  'docs/checklisten/website/module/datenbetrieb-wiederherstellung.md':
    'datenbetrieb-wiederherstellung',
  'docs/checklisten/website/abschluss.md': 'abschluss',
}

function countBy(items: any[], property: string, values: string[]) {
  return Object.fromEntries(
    values.map(value => [value, items.filter(item => item[property] === value).length]),
  )
}

function checklistItems() {
  return matrix.scope.sources.flatMap((source: string) => {
    const text = readFileSync(join(repositoryDirectory, source), 'utf8')
    return [...text.matchAll(/^- \[[ xX-]\] `([A-Z]+(?:-[A-Z0-9]+)+-\d{2})` /gm)].map(
      match => ({ id: match[1], source, module: moduleBySource[source] }),
    )
  })
}

describe('website checklist coverage matrix', () => {
  it('classifies every checklist item exactly once and in source order', () => {
    const checklist = checklistItems()

    expect(matrix.scope.sources).toEqual(Object.keys(moduleBySource))
    expect(matrix.scope.itemCount).toBe(215)
    expect(checklist).toHaveLength(215)
    expect(new Set(checklist.map((item: any) => item.id)).size).toBe(215)
    expect(matrix.items).toHaveLength(215)
    expect(matrix.items.map((item: any) => item.id)).toEqual(
      checklist.map((item: any) => item.id),
    )

    for (const [index, item] of matrix.items.entries()) {
      expect(item.source).toBe(checklist[index].source)
      expect(item.module).toBe(checklist[index].module)
    }
  })

  it('uses only the documented classifications, contexts and priority rules', () => {
    for (const item of matrix.items) {
      expect(classifications).toContain(item.classification)
      expect(item.contextNeeds.length).toBeGreaterThan(0)
      expect(new Set(item.contextNeeds).size).toBe(item.contextNeeds.length)
      expect(item.contextNeeds.every((context: string) => contexts.has(context))).toBe(true)
      expect(priorities).toContain(item.v1_1Priority)
      expect(item.rationale.trim().length).toBeGreaterThan(20)

      const candidate = ['direct-get-candidate', 'observation-candidate'].includes(
        item.classification,
      )
      expect(item.v1_1Priority === 'none').toBe(!candidate)
    }
  })

  it('binds existing-catalog flags and automatic coverage to the stable baseline', () => {
    expect(matrix.catalogReference).toEqual({
      id: baseline.catalogId,
      version: baseline.catalogVersion,
    })
    const baselineItems = new Map<string, any>(
      baseline.items.map((item: any): [string, any] => [item.id, item]),
    )
    const flaggedIds = matrix.items
      .filter((item: any) => item.existingCatalog)
      .map((item: any) => item.id)

    expect(new Set(flaggedIds)).toEqual(new Set(baselineItems.keys()))
    expect(flaggedIds).toHaveLength(44)

    for (const item of matrix.items) {
      const baselineItem: any = baselineItems.get(item.id)
      const hasAutomaticCriterion = baselineItem?.criteria.some(
        (criterion: any) => criterion.verification.mode === 'automatic',
      )
      expect(item.classification === 'existing-baseline').toBe(hasAutomaticCriterion === true)
    }
  })

  it('keeps summary counts and the bounded v1.1 shortlist internally consistent', () => {
    expect(matrix.summary.total).toBe(matrix.items.length)
    expect(matrix.summary.existingCatalogItems).toBe(
      matrix.items.filter((item: any) => item.existingCatalog).length,
    )
    expect(matrix.summary.byClassification).toEqual(
      countBy(matrix.items, 'classification', classifications),
    )
    expect(matrix.summary.byCandidatePriority).toEqual(
      countBy(matrix.items, 'v1_1Priority', priorities),
    )

    expect(new Set(Object.keys(matrix.summary.byModule))).toEqual(
      new Set(matrix.items.map((item: any) => item.module)),
    )
    for (const [module, summary] of Object.entries(matrix.summary.byModule) as Array<
      [string, any]
    >) {
      const moduleItems = matrix.items.filter((item: any) => item.module === module)
      expect(summary.total).toBe(moduleItems.length)
      expect(summary.byClassification).toEqual(
        countBy(moduleItems, 'classification', classifications),
      )
    }

    const shortlistIds = matrix.v1_1Shortlist.map((candidate: any) => candidate.id)
    expect(shortlistIds).toHaveLength(6)
    expect(new Set(shortlistIds).size).toBe(shortlistIds.length)
    expect(matrix.v1_1Shortlist.filter(
      (candidate: any) => candidate.stage === 'v1.1-released',
    )).toHaveLength(3)
    for (const candidate of matrix.v1_1Shortlist) {
      const item = matrix.items.find((entry: any) => entry.id === candidate.id)
      expect(item).toBeDefined()
      if (candidate.stage === 'v1.1-released') {
        expect(item).toMatchObject({
          classification: 'existing-baseline',
          existingCatalog: true,
          v1_1Priority: 'none',
        })
      }
      else if (matrix.v1_2ReleaseSlice.some((entry: any) => entry.id === candidate.id)) {
        expect(item).toMatchObject({
          classification: 'existing-baseline',
          existingCatalog: true,
          v1_1Priority: 'none',
        })
      }
      else {
        expect(['direct-get-candidate', 'observation-candidate']).toContain(item.classification)
        expect(item.v1_1Priority).not.toBe('none')
      }
      expect(candidate.requestImpact).toMatch(/vorhanden|keine neuen/i)
      expect(candidate.manualRemainder.length).toBeGreaterThan(20)
    }

    const v1_2Ids = matrix.v1_2ReleaseSlice.map((candidate: any) => candidate.id)
    expect(v1_2Ids).toHaveLength(7)
    expect(new Set(v1_2Ids).size).toBe(7)
    for (const candidate of matrix.v1_2ReleaseSlice) {
      expect(matrix.items.find((item: any) => item.id === candidate.id)).toMatchObject({
        classification: 'existing-baseline',
        existingCatalog: true,
        v1_1Priority: 'none',
      })
      expect(candidate.stage).toBe('v1.2-unreleased')
      expect(candidate.requestImpact).toMatch(/keine neuen/i)
      expect(candidate.manualRemainder.length).toBeGreaterThan(20)
    }
  })
})
