import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPilotProjectReport,
  createPilotProjectReportFromFiles,
  renderPilotProjectReportMarkdown,
  renderPilotProjectSummaryMarkdown,
  writePilotProjectReportBundle,
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
      catalog: { id: 'website-qa-pilot', status: 'pilot', version: '1.0.0-pilot.6' },
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
    catalog: { id: 'website-qa-pilot', version: '1.0.0-pilot.6' },
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

function technicalRun(report: Record<string, unknown> = technicalReport([
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
      open: 29,
      total: 31,
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

  it('accepts the singular browser result and evaluates its structured assertions', () => {
    const browserAssertions = [
      'browser.document.main-landmark-single',
      'browser.viewport.narrow-zoom-no-horizontal-overflow',
      'browser.accessibility.axe-no-detected-violations',
      'browser.context.chromium-headless-recorded',
      'browser.runtime.no-observed-errors',
    ].map(assertionId => assertion(assertionId))
    const browserReport = {
      checklistCoverage: {
        catalog: { id: 'website-qa-pilot', status: 'pilot', version: '1.0.0-pilot.6' },
      },
      generatedAt: '2026-08-24T12:05:00.000Z',
      result: { assertions: browserAssertions, requestedUrl: 'https://example.com/' },
      schemaVersion: 1,
      summary: { errors: 0, failed: false, pages: 1, warnings: 0 },
      tool: 'browser-check',
      toolPackage: { name: '@mktcode/website-qa', version: '0.1.0' },
    }
    const report = createPilotProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [{
        ...technicalRun(browserReport),
        command: 'website-qa-browser https://example.com/ --strict --json',
      }],
    })

    expect(report.summary.checklistItems).toMatchObject({ open: 26, partial: 5, total: 31 })
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-A11Y-13')).toMatchObject({
      evidenceOutcome: 'partial',
      projectStatus: 'partial',
    })
    expect(report.technicalRuns[0]).toMatchObject({ assertionCount: 5, tool: 'browser-check', usedForEvaluation: true })
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
        catalog: { id: 'website-qa-pilot', version: '1.0.0-pilot.6' },
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
    expect(report.summary.checklistItems).toMatchObject({ complete: 2, external: 1, open: 28, total: 32 })
  })

  it('binds query targets without retaining their values', () => {
    const config = projectConfig()
    config.technicalRuns[0].targetUrl = 'https://example.com/?token=configuration-secret'
    const sourceReport = technicalReport([assertion('error.not-found.noindex')])
    ;(sourceReport.results[0] as typeof sourceReport.results[0] & { requestedUrlParameterNames: string[] }).requestedUrlParameterNames = ['token']
    const report = createPilotProjectReport({
      config,
      evidenceDocument: undefined,
      technicalRuns: [{
        ...technicalRun(sourceReport),
        targetUrl: 'https://example.com/?token=configuration-secret',
      }],
    })

    expect(report.schemaVersion).toBe(2)
    expect(report.technicalRuns[0].targetUrl).toBe('https://example.com/')
    expect(report.provenance.targetUrlBinding).toBe('matchedAgainstRedactedTechnicalReport')
    expect(JSON.stringify(report)).not.toContain('configuration-secret')

    ;(sourceReport.results[0] as typeof sourceReport.results[0] & { requestedUrlParameterNames: string[] }).requestedUrlParameterNames = ['other']
    expect(() => createPilotProjectReport({
      config,
      evidenceDocument: undefined,
      technicalRuns: [{
        ...technicalRun(sourceReport),
        targetUrl: 'https://example.com/?token=configuration-secret',
      }],
    })).toThrow(/Ziel-URL/)
  })

  it('accepts explicitly redacted private technical targets without exposing the host', () => {
    const config = projectConfig()
    config.technicalRuns[0].targetUrl = 'http://127.0.0.1:3000/'
    const sourceReport = technicalReport([assertion('error.not-found.noindex')]) as ReturnType<typeof technicalReport> & {
      options: { privateTargetsRedacted: boolean }
    }
    sourceReport.options = { privateTargetsRedacted: true }
    sourceReport.results[0].requestedUrl = '(privates/lokales Ziel)'
    const report = createPilotProjectReport({
      config,
      evidenceDocument: undefined,
      technicalRuns: [{
        ...technicalRun(sourceReport),
        targetUrl: 'http://127.0.0.1:3000/',
      }],
    })

    expect(report.technicalRuns[0].targetUrl).toBe('(privates/lokales Ziel)')
    expect(JSON.stringify(report)).not.toContain('127.0.0.1')
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
    expect(report.schemaVersion).toBe(outputSchema.properties.schemaVersion.const)
    expect(report.provenance).toEqual({
      deploymentAndSourceContext: 'projectDeclared',
      targetUrlBinding: 'matchedAgainstRedactedTechnicalReport',
    })
  })

  it('renders a data-minimized public summary without project evidence details', () => {
    const config = projectConfig()
    config.project.name = 'Vertraulicher Kundenname'
    config.project.preferredUrl = 'https://example.com/?token=top-secret'
    config.technicalRuns[0].command = 'website-qa-http https://example.com/?token=top-secret --json'
    const report = createPilotProjectReport({
      config,
      evidenceDocument: undefined,
      generatedAt: '2026-08-24T18:04:17.000Z',
      technicalRuns: [technicalRun()],
    })
    const markdown = renderPilotProjectSummaryMarkdown(report, {
      publicProject: { label: '<script>[Projekt]</script>', url: 'https://example.com/?token=secret' },
    })

    expect(markdown).toContain('# Website-QA-Zusammenfassung: &lt;script&gt;\\[Projekt\\]&lt;/script&gt;')
    expect(markdown).toContain('| Öffentlich freigegebene URL | https://example.com/ |')
    expect(markdown).toContain('| http-check | 0.1.0 | ja | 2 |')
    expect(markdown).toContain('CORE-DOM-04')
    expect(markdown).not.toContain('Vertraulicher Kundenname')
    expect(markdown).not.toContain('top-secret')
    expect(markdown).not.toContain('commit-1')
    expect(markdown).not.toContain('deployment-1')
    expect(markdown).not.toContain('website-qa-http')
    expect(() => renderPilotProjectSummaryMarkdown(report, {
      publicProject: { url: 'http://127.0.0.1/internal' },
    })).toThrow(/öffentliche URL/)
  })

  it('writes a timestamped bundle with byte-identical raw reports and a separate summary', () => {
    const directory = mkdtempSync(join(tmpdir(), 'website-qa-bundle-'))
    temporaryDirectories.add(directory)
    const config = projectConfig()
    config.project.name = 'Nicht öffentliche Projektbezeichnung'
    config.technicalRuns.push({
      command: 'website-qa-social https://example.com/ --strict --json',
      deploymentId: 'deployment-1',
      environment: 'production',
      reportFile: './social.json',
      sourceRevision: 'commit-1',
      targetUrl: 'https://example.com/',
    })
    const rawReport = `${JSON.stringify(technicalReport([
      assertion('error.not-found.noindex'),
      assertion('error.not-found.no-url-metadata'),
    ]), null, 4)}\n`
    const rawSocialReport = readFileSync(join(catalogDirectory, 'social-report.example.json'), 'utf8')
    writeFileSync(join(directory, 'project.json'), JSON.stringify(config))
    writeFileSync(join(directory, 'http.json'), rawReport)
    writeFileSync(join(directory, 'social.json'), rawSocialReport)

    const result = writePilotProjectReportBundle({
      configFile: join(directory, 'project.json'),
      now: new Date('2026-08-24T18:04:17.123Z'),
    })

    expect(result.timestamp).toBe('2026-08-24T18-04-17Z')
    expect(readFileSync(join(result.bundleDirectory, 'technical/http.json'), 'utf8')).toBe(rawReport)
    expect(readFileSync(join(result.bundleDirectory, 'technical/social.json'), 'utf8')).toBe(rawSocialReport)
    expect(existsSync(result.manifestFile)).toBe(true)
    expect(existsSync(result.reportFile)).toBe(true)
    expect(existsSync(result.reportMarkdownFile)).toBe(true)
    expect(result.summaryFile).toBe(join(directory, 'docs/website-qa/berichte/2026-08-24T18-04-17Z.md'))
    const summary = readFileSync(result.summaryFile, 'utf8')
    expect(summary).not.toContain('Nicht öffentliche Projektbezeichnung')
    expect(summary).not.toContain('deployment-1')
    const report = JSON.parse(readFileSync(result.reportFile, 'utf8'))
    expect(report.generatedAt).toBe('2026-08-24T18:04:17.123Z')
    expect(report.technicalRuns[0].reportFile).toBe('./technical/http.json')
    const manifest = JSON.parse(readFileSync(result.manifestFile, 'utf8'))
    const manifestSchema = JSON.parse(readFileSync(join(catalogDirectory, 'project-report.bundle-manifest.schema.json'), 'utf8'))
    expect(new Set(Object.keys(manifest))).toEqual(new Set(manifestSchema.required))
    expect(manifest.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'technical/http.json', role: 'technicalReport', sha256: expect.stringMatching(/^[a-f\d]{64}$/) }),
      expect.objectContaining({ path: 'technical/social.json', role: 'technicalReport', sha256: expect.stringMatching(/^[a-f\d]{64}$/) }),
    ]))

    expect(() => writePilotProjectReportBundle({
      configFile: join(directory, 'project.json'),
      now: new Date('2026-08-24T18:04:17.999Z'),
    })).toThrow(/existiert bereits/)
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
