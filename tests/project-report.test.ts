import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPilotProjectReport,
  createPilotProjectReportFromFiles,
  renderPilotProjectReportMarkdown,
} from '../src/lib/project-report.mjs'

const temporaryDirectories = new Set<string>()
const catalogDirectory = fileURLToPath(new URL('../catalog/', import.meta.url))

function assertion(assertionId: string, outcome: 'fail' | 'inconclusive' | 'notApplicable' | 'pass' = 'pass') {
  return {
    assertionId,
    assertionVersion: 1,
    message: `Ergebnis für ${assertionId}`,
    outcome,
    subject: { url: 'https://example.com/' },
  }
}

function technicalReport(assertions: ReturnType<typeof assertion>[]) {
  return {
    checklistCoverage: {
      catalog: { id: 'website-qa-pilot', status: 'pilot', version: '1.0.0-pilot.2' },
    },
    generatedAt: '2026-08-24T12:00:00.000Z',
    results: [{ assertions, requestedUrl: 'https://example.com/' }],
    schemaVersion: 1,
    summary: { errors: 0, failed: false, targets: 1, warnings: 0 },
    tool: 'http-check',
    toolPackage: { name: '@mktcode/website-qa', version: '0.1.0' },
  }
}

function projectConfig() {
  return {
    catalog: { id: 'website-qa-pilot', version: '1.0.0-pilot.2' },
    itemStates: [],
    project: {
      deploymentId: 'deployment-1',
      evaluationEnvironment: 'production',
      name: 'Beispielwebsite',
      preferredUrl: 'https://example.com/',
      sourceRevision: 'commit-1',
    },
    schemaVersion: 1,
    selectedModules: ['core'],
    technicalRuns: [{
      command: 'website-qa-http https://example.com/ --strict --json',
      deploymentId: 'deployment-1',
      environment: 'production',
      reportFile: './http.json',
      sourceRevision: 'commit-1',
      targetUrl: 'https://example.com/',
    }],
  }
}

function technicalRun(report = technicalReport([
  assertion('error.not-found.noindex'),
  assertion('error.not-found.no-url-metadata'),
])) {
  return {
    ...projectConfig().technicalRuns[0],
    report,
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { force: true, recursive: true })
  }
  temporaryDirectories.clear()
})

describe('project report pilot', () => {
  it('combines selected modules and technical assertions without completing open manual points', () => {
    const report = createPilotProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [technicalRun()],
    })

    expect(report.summary.checklistItems).toMatchObject({
      complete: 1,
      open: 10,
      total: 11,
    })
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-ERR-02')).toMatchObject({
      evidenceOutcome: 'pass',
      projectStatus: 'complete',
    })
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-DOM-04')).toMatchObject({
      evidenceOutcome: 'open',
      projectStatus: 'open',
    })
    expect(report.technicalRuns[0]).toMatchObject({ assertionCount: 2, usedForEvaluation: true })
  })

  it('includes communication evidence and explicit external workflow states', () => {
    const config = projectConfig()
    config.selectedModules.push('auftrag-recht-uebergabe')
    config.itemStates.push({
      itemId: 'CORE-DOM-04',
      note: 'Zertifikatserneuerung wird durch den Hostinganbieter bestätigt.',
      recordedAt: '2026-08-24',
      recordedBy: 'technisch verantwortliche Stelle',
      responsible: 'Hostinganbieter',
      status: 'external',
    } as never)
    const report = createPilotProjectReport({
      config,
      evidenceDocument: {
        catalog: { id: 'website-qa-pilot', version: '1.0.0-pilot.2' },
        evidence: [{
          checkedAt: '2026-08-24',
          checkedBy: 'inhaltlich verantwortliche Stelle',
          criterionId: 'GOV-RGT-02/C1',
          note: 'Rechtefreigabe liegt in der Projektakte.',
          outcome: 'pass',
        }],
        schemaVersion: 1,
      },
      technicalRuns: [technicalRun()],
    })

    expect(report.items.find((item: { id: string }) => item.id === 'GOV-RGT-02')).toMatchObject({
      projectStatus: 'complete',
    })
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-DOM-04')).toMatchObject({
      projectStatus: 'external',
    })
    expect(report.summary.checklistItems).toMatchObject({ complete: 2, external: 1, open: 9, total: 12 })
  })

  it('uses only matching environments and rejects deployment mismatches', () => {
    const localRun = {
      ...technicalRun(),
      environment: 'local',
    }
    const report = createPilotProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [localRun],
    })

    expect((report.summary.checklistItems as Record<string, number>).complete).toBe(0)
    expect(report.technicalRuns[0]?.usedForEvaluation).toBe(false)
    expect(report.warnings).toContain('Kein technischer Lauf gehört zur Auswertungsumgebung production.')

    expect(() => createPilotProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [{ ...technicalRun(), deploymentId: 'other-deployment' }],
    })).toThrow(/deploymentId/)

    expect(() => createPilotProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [{ ...technicalRun(), targetUrl: 'https://other.example/' }],
    })).toThrow(/Ziel-URL/)
  })

  it('keeps the checked-in Markdown example synchronized with its structured inputs', () => {
    const report = createPilotProjectReportFromFiles(join(catalogDirectory, 'project-report.example.json'))
    report.generatedAt = '2026-08-24T12:30:00.000Z'
    const expectedMarkdown = readFileSync(join(catalogDirectory, 'project-report.example.md'), 'utf8')
    const outputSchema = JSON.parse(readFileSync(join(catalogDirectory, 'project-report.output.schema.json'), 'utf8'))

    expect(renderPilotProjectReportMarkdown(report)).toBe(expectedMarkdown)
    expect(new Set(Object.keys(JSON.parse(JSON.stringify(report))))).toEqual(new Set(outputSchema.required))
    expect(report.provenance).toEqual({
      deploymentAndSourceContext: 'projectDeclared',
      targetUrlBinding: 'verifiedFromTechnicalReport',
    })
  })

  it('loads project files and renders a readable Markdown report', () => {
    const directory = mkdtempSync(join(tmpdir(), 'website-qa-report-'))
    temporaryDirectories.add(directory)
    const config = projectConfig()
    writeFileSync(join(directory, 'project.json'), JSON.stringify(config))
    writeFileSync(join(directory, 'http.json'), JSON.stringify(technicalReport([
      assertion('error.not-found.noindex'),
      assertion('error.not-found.no-url-metadata'),
    ])))

    const report = createPilotProjectReportFromFiles(join(directory, 'project.json'))
    const markdown = renderPilotProjectReportMarkdown(report)

    expect(markdown).toContain('# Website-QA-Prüfbericht: Beispielwebsite')
    expect(markdown).toContain('| Vollständig nachgewiesen | 1 |')
    expect(markdown).toContain('### CORE-ERR-01: Offen')
    expect(markdown).toContain('Erforderlicher Nachweis: Fehlerseite visuell und redaktionell prüfen')
    expect(markdown).toContain('Der strukturierte Katalog ist ein Pilot')
  })
})
