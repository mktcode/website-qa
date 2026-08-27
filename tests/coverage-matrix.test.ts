import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateSignalCatalog } from '../src/lib/signal-report.mjs'

const repositoryDirectory = join(import.meta.dirname, '..')
const index = JSON.parse(readFileSync(join(repositoryDirectory, 'catalog', 'checklist-index.json'), 'utf8'))
const signals = JSON.parse(readFileSync(join(repositoryDirectory, 'catalog', 'signals.json'), 'utf8'))
const sources = [
  'docs/checklisten/website/kern.md',
  'docs/checklisten/website/module/auftrag-recht-uebergabe.md',
  'docs/checklisten/website/module/formulare-api-daten.md',
  'docs/checklisten/website/module/medien-animationen.md',
  'docs/checklisten/website/module/umgebungen-domainmigration.md',
  'docs/checklisten/website/module/container-deployment.md',
  'docs/checklisten/website/module/datenbetrieb-wiederherstellung.md',
  'docs/checklisten/website/abschluss.md',
]

function objectKeys(value: unknown): string[] {
  return value && typeof value === 'object'
    ? Object.entries(value).flatMap(([key, child]) => [key].concat(objectKeys(child)))
    : []
}

function checklistItems() {
  return sources.flatMap((source) => {
    const text = readFileSync(join(repositoryDirectory, source), 'utf8')
    return [...text.matchAll(/^- \[[ xX-]\] `([A-Z]+(?:-[A-Z0-9]+)+-\d{2})` (.+)$/gm)]
      .map(match => ({ id: match[1], source, statement: match[2] }))
  })
}

describe('central website checklist and technical signal references', () => {
  it('indexes all 215 manually worked checklist items exactly once and in source order', () => {
    const checklist = checklistItems()

    expect(checklist).toHaveLength(215)
    expect(new Set(checklist.map(item => item.id)).size).toBe(215)
    expect(index.items).toHaveLength(215)
    expect(index.items.map((item: { id: string }) => item.id)).toEqual(checklist.map(item => item.id))
    expect(index.items.map((item: { source: string }) => item.source)).toEqual(checklist.map(item => item.source))
    expect(index.items.map((item: { statement: string }) => item.statement)).toEqual(checklist.map(item => item.statement))
  })

  it('validates only references and never checklist outcomes', () => {
    expect(validateSignalCatalog(index, signals)).toBe(true)
    expect(objectKeys(index)).not.toEqual(expect.arrayContaining(['outcome', 'complete', 'partial', 'noEvidence', 'workflow', 'evidenceOutcome', 'projectStatus']))
    expect(objectKeys(signals)).not.toEqual(expect.arrayContaining(['outcome', 'complete', 'partial', 'noEvidence', 'workflow', 'evidenceOutcome', 'projectStatus']))
  })

  it('keeps signal and source issue references resolvable', () => {
    const checklistIds = new Set(index.items.map((item: { id: string }) => item.id))
    const signalIds = signals.signals.map((signal: { id: string }) => signal.id)

    expect(new Set(signalIds).size).toBe(signalIds.length)
    expect(signals.signals).toHaveLength(67)
    for (const signal of signals.signals) {
      expect(signal.checklistRefs.every((reference: string) => checklistIds.has(reference))).toBe(true)
    }

    const sourceReferences = ['check-http.mjs', 'check-crawl.mjs', 'check-browser.mjs', 'check-social-preview.mjs', 'check-lighthouse.mjs']
      .flatMap(file => Array.from(readFileSync(join(repositoryDirectory, 'src', file), 'utf8').matchAll(/'([A-Z]+(?:-[A-Z0-9]+)+-\d{2})'/g)))
      .map(match => match[1])
    expect(sourceReferences.length).toBeGreaterThan(0)
    expect(sourceReferences.every(reference => checklistIds.has(reference))).toBe(true)
  })
})
