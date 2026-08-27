import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createProjectReport,
  createProjectReportFromFiles,
  renderProjectReportMarkdown,
  renderProjectSummaryMarkdown,
  writeProjectReportBundle,
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

function technicalReportForTool(tool: 'browser' | 'crawl' | 'http' | 'social', assertions: ReturnType<typeof assertion>[]) {
  const report = JSON.parse(readFileSync(join(catalogDirectory, `${tool}-report.example.json`), 'utf8'))
  const result = tool === 'browser' ? report.result : report.results[0]
  result.assertions = assertions
  result.requestedUrl = 'https://example.com/'
  return report
}

function technicalReport(assertions: ReturnType<typeof assertion>[]) {
  return technicalReportForTool('http', assertions)
}

function projectConfig() {
  return {
    catalog: { id: 'website-qa-baseline', version: '1.0.0' },
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

describe('project report', () => {
  it('combines selected modules and technical assertions without completing open manual points', () => {
    const report = createProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [technicalRun()],
    })

    expect(report.summary.checklistItems).toMatchObject({
      complete: 1,
      open: 31,
      total: 33,
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
      'browser.privacy.external-request-observation-complete',
      'browser.privacy.initial-storage-observation-complete',
    ].map(assertionId => assertion(assertionId))
    const browserReport = technicalReportForTool('browser', browserAssertions)
    const report = createProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [{
        ...technicalRun(browserReport),
        command: 'website-qa-browser https://example.com/ --strict --json',
      }],
    })

    expect(report.summary.checklistItems).toMatchObject({ open: 26, partial: 7, total: 33 })
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-A11Y-13')).toMatchObject({
      evidenceOutcome: 'partial',
      projectStatus: 'partial',
    })
    expect(report.technicalRuns[0]).toMatchObject({ assertionCount: 7, tool: 'browser-check', usedForEvaluation: true })
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
    const report = createProjectReport({
      config,
      evidenceDocument: {
        catalog: { id: 'website-qa-baseline', version: '1.0.0' },
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
    expect(report.summary.checklistItems).toMatchObject({ complete: 2, external: 1, open: 30, total: 34 })
  })

  it('binds query targets without retaining their values', () => {
    const config = projectConfig()
    config.technicalRuns[0].targetUrl = 'https://example.com/?token=configuration-secret'
    const sourceReport = technicalReport([assertion('error.not-found.noindex')])
    ;(sourceReport.results[0] as typeof sourceReport.results[0] & { requestedUrlParameterNames: string[] }).requestedUrlParameterNames = ['token']
    const report = createProjectReport({
      config,
      evidenceDocument: undefined,
      technicalRuns: [{
        ...technicalRun(sourceReport),
        targetUrl: 'https://example.com/?token=configuration-secret',
      }],
    })

    expect(report.schemaVersion).toBe(3)
    expect(report.technicalRuns[0].targetUrl).toBe('https://example.com/')
    expect(report.provenance.targetUrlBinding).toBe('matchedAgainstRedactedTechnicalReport')
    expect(JSON.stringify(report)).not.toContain('configuration-secret')

    ;(sourceReport.results[0] as typeof sourceReport.results[0] & { requestedUrlParameterNames: string[] }).requestedUrlParameterNames = ['other']
    expect(() => createProjectReport({
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
    sourceReport.options.privateTargetsRedacted = true
    sourceReport.results[0].requestedUrl = '(privates/lokales Ziel)'
    const report = createProjectReport({
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
    const report = createProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [localRun],
    })

    expect((report.summary.checklistItems as Record<string, number>).complete).toBe(0)
    expect(report.technicalRuns[0]?.usedForEvaluation).toBe(false)
    expect(report.warnings).toContain('Kein technischer Lauf gehört zur Auswertungsumgebung production.')

    expect(() => createProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [{ ...technicalRun(), deploymentId: 'other-deployment' }],
    })).toThrow(/deploymentId/)

    expect(() => createProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [{ ...technicalRun(), targetUrl: 'https://other.example/' }],
    })).toThrow(/Ziel-URL/)
  })

  it('keeps the checked-in Markdown example synchronized with its structured inputs', () => {
    const report = createProjectReportFromFiles(join(catalogDirectory, 'project-report.config.example.json'))
    report.generatedAt = '2026-08-24T12:30:00.000Z'
    const expectedMarkdown = readFileSync(join(catalogDirectory, 'project-report.example.md'), 'utf8')
    const outputSchema = JSON.parse(readFileSync(join(catalogDirectory, 'project-report.schema.json'), 'utf8'))

    expect(renderProjectReportMarkdown(report)).toBe(expectedMarkdown)
    expect(new Set(Object.keys(JSON.parse(JSON.stringify(report))))).toEqual(new Set(outputSchema.required))
    expect(report.schemaVersion).toBe(outputSchema.properties.schemaVersion.const)
    expect(report.provenance).toEqual({
      deploymentAndSourceContext: 'projectDeclared',
      targetUrlBinding: 'matchedAgainstRedactedTechnicalReport',
    })
    expect(report.technicalRuns.every((run: { contextProvenance: { targetUrl: string } }) => run.contextProvenance.targetUrl === 'matchedAgainstRedactedTechnicalReport')).toBe(true)
  })

  it('renders a data-minimized public summary without project evidence details', () => {
    const config = projectConfig()
    config.project.name = 'Vertraulicher Kundenname'
    config.project.preferredUrl = 'https://example.com/?token=top-secret'
    config.technicalRuns[0].command = 'website-qa-http https://example.com/?token=top-secret --json'
    const report = createProjectReport({
      config,
      evidenceDocument: undefined,
      generatedAt: '2026-08-24T18:04:17.000Z',
      technicalRuns: [technicalRun()],
    })
    const markdown = renderProjectSummaryMarkdown(report, {
      publicProject: { label: '<script>[Projekt]</script>', url: 'https://example.com/?token=secret' },
    })

    expect(markdown).toContain('# Website-QA-Zusammenfassung: &lt;script&gt;\\[Projekt\\]&lt;/script&gt;')
    expect(markdown).toContain('| Öffentlich freigegebene URL | https://example.com/ |')
    expect(markdown).toContain('| http-check | 1.0.0 | ja | 2 |')
    expect(markdown).toContain('CORE-DOM-04')
    expect(markdown).not.toContain('Vertraulicher Kundenname')
    expect(markdown).not.toContain('top-secret')
    expect(markdown).not.toContain('commit-1')
    expect(markdown).not.toContain('deployment-1')
    expect(markdown).not.toContain('website-qa-http')
    expect(() => renderProjectSummaryMarkdown(report, {
      publicProject: { url: 'http://127.0.0.1/internal' },
    })).toThrow(/öffentliche URL/)
  })

  it('rejects schema-invalid, unknown and cross-tool technical inputs', () => {
    const withoutReadOnlyGuarantees = technicalReport([assertion('error.not-found.noindex')])
    delete withoutReadOnlyGuarantees.readOnlyGuarantees
    expect(() => createProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [technicalRun(withoutReadOnlyGuarantees)],
    })).toThrow(/JSON-Schema/)

    const unknownTool = technicalReport([assertion('error.not-found.noindex')])
    unknownTool.tool = 'unknown-check'
    expect(() => createProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [technicalRun(unknownTool)],
    })).toThrow(/unbekanntes Werkzeug/)

    const crossTool = technicalReport([assertion('crawl.canonical.single-absolute')])
    expect(() => createProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [technicalRun(crossTool)],
    })).toThrow(/nicht zum Werkzeug passende Assertion/)

    const errorEnvelope = {
      error: 'Ungültige Eingabe.',
      schemaVersion: 1,
      tool: 'http-check',
    }
    expect(() => createProjectReport({
      config: projectConfig(),
      evidenceDocument: undefined,
      technicalRuns: [technicalRun(errorEnvelope)],
    })).toThrow(/Fehlerhülle/)
  })

  it('validates configuration, evidence and workflow conditions before generation', () => {
    const invalidUrl = projectConfig()
    invalidUrl.project.preferredUrl = 'not a URL'
    expect(() => createProjectReport({
      config: invalidUrl,
      evidenceDocument: undefined,
      technicalRuns: [technicalRun()],
    })).toThrow(/JSON-Schema/)

    const missingResponsible = projectConfig()
    missingResponsible.itemStates.push({
      itemId: 'CORE-DOM-04',
      note: 'Externer Nachweis.',
      recordedAt: '2026-08-24',
      recordedBy: 'Prüfstelle',
      status: 'external',
    } as never)
    expect(() => createProjectReport({
      config: missingResponsible,
      evidenceDocument: undefined,
      technicalRuns: [technicalRun()],
    })).toThrow(/JSON-Schema/)

    const missingReview = projectConfig()
    missingReview.itemStates.push({
      itemId: 'CORE-ERR-01',
      note: 'Zurückgestellt.',
      recordedAt: '2026-08-24',
      recordedBy: 'Prüfstelle',
      responsible: 'Projekt',
      status: 'deferred',
    } as never)
    expect(() => createProjectReport({
      config: missingReview,
      evidenceDocument: undefined,
      technicalRuns: [technicalRun()],
    })).toThrow(/JSON-Schema/)

    expect(() => createProjectReport({
      config: projectConfig(),
      evidenceDocument: {
        catalog: { id: 'website-qa-baseline', version: '1.0.0' },
        evidence: [{
          checkedAt: '2026-02-30',
          checkedBy: 'Prüfstelle',
          criterionId: 'CORE-DOM-04/C1',
          note: 'Ungültiges Datum.',
          outcome: 'pass',
        }],
        schemaVersion: 1,
      },
      technicalRuns: [technicalRun()],
    })).toThrow(/JSON-Schema/)
  })

  it('escapes HTML and Markdown payloads in every variable renderer context', () => {
    const payload = '<img src=x onerror=alert(1)> A&B ![x](javascript:alert(1)) [x](javascript:alert(1)) `code` *em* __strong__ ~~strike~~ A|B \\ end'
    const config = projectConfig()
    config.project.name = payload
    config.technicalRuns[0].command = `website-qa-http ${payload}`
    config.itemStates.push({
      itemId: 'CORE-DOM-04',
      note: payload,
      recordedAt: '2026-08-24',
      recordedBy: 'Prüfstelle',
      responsible: 'Hoster',
      status: 'external',
    } as never)
    const sourceReport = technicalReport([{ ...assertion('http.redirect.permanent', 'fail'), message: payload }])
    sourceReport.toolPackage.version = payload
    const report = createProjectReport({
      config,
      evidenceDocument: undefined,
      technicalRuns: [technicalRun(sourceReport)],
    })
    report.warnings.push(payload)
    report.limitations.push(payload)

    const markdown = renderProjectReportMarkdown(report)
    const summary = renderProjectSummaryMarkdown(report, { publicProject: { label: payload } })
    for (const rendered of [markdown, summary]) {
      expect(rendered).not.toContain('<img')
      expect(rendered).not.toContain('![x]')
      expect(rendered).not.toContain('[x](javascript:')
      expect(rendered).not.toContain('`code`')
      expect(rendered).not.toContain('*em*')
      expect(rendered).not.toContain('__strong__')
      expect(rendered).not.toContain('~~strike~~')
      expect(rendered).not.toContain(' A|B ')
      expect(rendered).toContain('&lt;img src=x onerror=alert(1)&gt;')
      expect(rendered).toContain('A&amp;B')
      expect(rendered).toContain('!\\[x\\](javascript:alert(1))')
      expect(rendered).toContain('\\`code\\`')
      expect(rendered).toContain('\\*em\\*')
      expect(rendered).toContain('\\_\\_strong\\_\\_')
      expect(rendered).toContain('\\~\\~strike\\~\\~')
      expect(rendered).toContain('A\\|B')
      expect(rendered).toContain('\\\\ end')
      expect(rendered).not.toContain('&amp;lt;')
    }
  })

  it('renders only short redacted automatic causes with record references', () => {
    const failedAssertion = {
      ...assertion('http.redirect.permanent', 'fail'),
      message: 'Bearer cause-secret',
      subject: { selector: 'PRIVATE-SUBJECT', url: 'https://example.com/?token=subject-secret' },
    }
    const report = createProjectReport({
      config: projectConfig(),
      evidenceDocument: {
        catalog: { id: 'website-qa-baseline', version: '1.0.0' },
        evidence: [{
          checkedAt: '2026-08-26',
          checkedBy: 'PRIVATE-PERSON',
          criterionId: 'CORE-DOM-04/C1',
          note: 'PRIVATE-EVIDENCE',
          outcome: 'fail',
          reference: 'PRIVATE-REFERENCE',
        }],
        schemaVersion: 1,
      },
      technicalRuns: [technicalRun(technicalReport([failedAssertion]))],
    })
    const markdown = renderProjectReportMarkdown(report)

    expect(markdown).toMatch(/Ursache \[R\d{6}\]: Bearer \\\[REDACTED\\\]/)
    expect(markdown).not.toContain('cause-secret')
    expect(markdown).not.toContain('subject-secret')
    expect(markdown).not.toContain('PRIVATE-SUBJECT')
    expect(markdown).not.toContain('PRIVATE-EVIDENCE')
    expect(markdown).not.toContain('PRIVATE-REFERENCE')
    expect(markdown).not.toContain('PRIVATE-PERSON')
  })

  it('renders criterion totals and not-applicable evidence consistently', () => {
    const report = createProjectReport({
      config: projectConfig(),
      evidenceDocument: {
        catalog: { id: 'website-qa-baseline', version: '1.0.0' },
        evidence: [{
          checkedAt: '2026-08-26',
          checkedBy: 'technisch verantwortliche Stelle',
          criterionId: 'CORE-PRIV-04/C2',
          note: 'Initialinventar und Dokumentation stimmen überein.',
          outcome: 'pass',
        }, {
          checkedAt: '2026-08-26',
          checkedBy: 'technisch verantwortliche Stelle',
          criterionId: 'CORE-PRIV-04/C3',
          note: 'Es werden keine Cookies gesetzt.',
          outcome: 'notApplicable',
        }],
        schemaVersion: 1,
      },
      technicalRuns: [{
        ...technicalRun(technicalReportForTool('browser', [
          assertion('browser.privacy.initial-storage-observation-complete'),
        ])),
        command: 'website-qa-browser https://example.com/ --strict --json',
      }],
    })
    const fullMarkdown = renderProjectReportMarkdown(report)
    const summaryMarkdown = renderProjectSummaryMarkdown(report)

    const automaticSummary = 'Automatische Kriterien (57 gesamt): 1 bestanden, 0 fehlgeschlagen, 0 unklar, 0 nicht zutreffend, 56 ohne Nachweis.'
    const nonAutomaticSummary = 'Nicht automatische Kriterien (35 gesamt): 1 belegt, 0 fehlgeschlagen, 0 unklar, 1 nicht zutreffend, 33 ohne Nachweis.'
    expect(fullMarkdown).toContain(automaticSummary)
    expect(fullMarkdown).toContain(nonAutomaticSummary)
    expect(summaryMarkdown).toContain(automaticSummary)
    expect(summaryMarkdown).toContain(nonAutomaticSummary)
    expect(fullMarkdown).toContain('| ID | Modul | Projektstatus | Automatisch geklärt | Nicht automatisch geklärt |')
    expect(fullMarkdown).toContain('| CORE-PRIV-04 | core | Vollständig nachgewiesen | 1/1 | 2/2 |')
  })

  it('renders every evidence and workflow status without conflating item and criterion outcomes', () => {
    const config = projectConfig()
    config.itemStates.push({
      itemId: 'CORE-DOM-04',
      note: 'Vertrauliche externe Zuordnung',
      recordedAt: '2026-08-26',
      recordedBy: 'verantwortliche Stelle',
      responsible: 'externe Stelle',
      status: 'external',
    } as never, {
      itemId: 'CORE-ERR-01',
      note: 'Vertrauliche Zurückstellungsbegründung',
      recordedAt: '2026-08-26',
      recordedBy: 'verantwortliche Stelle',
      responsible: 'Projektverantwortung',
      reviewAt: '2026-09-26',
      status: 'deferred',
    } as never, {
      itemId: 'CORE-ERR-03',
      note: 'Vertrauliche Abweichungsbegründung',
      recordedAt: '2026-08-26',
      recordedBy: 'verantwortliche Stelle',
      responsible: 'Projektverantwortung',
      reviewAt: '2026-09-26',
      status: 'acceptedDeviation',
    } as never, {
      itemId: 'CORE-SEO-01',
      note: 'Vertrauliche Nichtanwendbarkeitsbegründung',
      recordedAt: '2026-08-26',
      recordedBy: 'verantwortliche Stelle',
      status: 'notApplicable',
    } as never)
    const report = createProjectReport({
      config,
      evidenceDocument: {
        catalog: { id: 'website-qa-baseline', version: '1.0.0' },
        evidence: [{
          checkedAt: '2026-08-26',
          checkedBy: 'verantwortliche Stelle',
          criterionId: 'CORE-SOC-03/C1',
          note: 'Für diesen Projektumfang nicht zutreffend.',
          outcome: 'notApplicable',
        }],
        schemaVersion: 1,
      },
      technicalRuns: [
        technicalRun(technicalReport([
          assertion('http.redirect.permanent', 'fail'),
          assertion('http.redirect.path-query-preserved'),
          assertion('error.not-found.noindex', 'inconclusive'),
          assertion('error.not-found.no-url-metadata', 'inconclusive'),
        ])),
        {
          ...technicalRun(technicalReportForTool('crawl', [
            assertion('crawl.canonical.single-absolute'),
            assertion('crawl.canonical.matches-final-url'),
          ])),
          command: 'website-qa-crawl https://example.com/ --strict --json',
        },
        {
          ...technicalRun(technicalReportForTool('social', [
            assertion('social.crawlers.html-metadata-consistent'),
            assertion('social.metadata.canonical-open-graph-consistent'),
            assertion('social.images.preview-technically-valid'),
            assertion('social.run.strict-mode-recorded'),
          ])),
          command: 'website-qa-social https://example.com/ --strict --json',
        },
      ],
    })
    const checklistStatusLabels = {
      acceptedDeviation: 'Akzeptierte Abweichung (offen)',
      complete: 'Vollständig nachgewiesen',
      deferred: 'Zurückgestellt',
      external: 'Externer Nachweis offen',
      failed: 'Fehlgeschlagen',
      inconclusive: 'Unklar',
      notApplicable: 'Nicht zutreffend',
      open: 'Offen',
      partial: 'Teilweise nachgewiesen',
    }
    const criterionOutcomeKeys = ['pass', 'fail', 'inconclusive', 'notApplicable', 'noEvidence'] as const
    const checklistStatusKeys = Object.keys(checklistStatusLabels) as Array<keyof typeof checklistStatusLabels>

    expect(report.items.find((item: { id: string }) => item.id === 'CORE-SOC-02')?.projectStatus).toBe('complete')
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-DOM-02')?.projectStatus).toBe('failed')
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-DOM-05')?.projectStatus).toBe('partial')
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-ERR-02')?.projectStatus).toBe('inconclusive')
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-SOC-03')?.projectStatus).toBe('notApplicable')
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-DOM-04')?.projectStatus).toBe('external')
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-ERR-01')?.projectStatus).toBe('deferred')
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-ERR-03')?.projectStatus).toBe('acceptedDeviation')
    expect(report.items.find((item: { id: string }) => item.id === 'CORE-DOM-07')?.projectStatus).toBe('open')

    expect(checklistStatusKeys.reduce((sum, status) => sum + report.summary.checklistItems[status], 0)).toBe(report.summary.checklistItems.total)
    for (const counts of [report.summary.automaticCriteria, report.summary.nonAutomaticCriteria]) {
      expect(criterionOutcomeKeys.reduce((sum, outcome) => sum + counts[outcome], 0)).toBe(counts.total)
      expect(counts).not.toHaveProperty('partial')
      expect(counts).not.toHaveProperty('open')
    }

    const fullMarkdown = renderProjectReportMarkdown(report)
    const summaryMarkdown = renderProjectSummaryMarkdown(report)
    for (const [label, counts, successfulLabel] of [
      ['Automatische Kriterien', report.summary.automaticCriteria, 'bestanden'],
      ['Nicht automatische Kriterien', report.summary.nonAutomaticCriteria, 'belegt'],
    ] as const) {
      const expected = `${label} (${counts.total} gesamt): ${counts.pass} ${successfulLabel}, ${counts.fail} fehlgeschlagen, ${counts.inconclusive} unklar, ${counts.notApplicable} nicht zutreffend, ${counts.noEvidence} ohne Nachweis.`
      expect(fullMarkdown).toContain(expected)
      expect(summaryMarkdown).toContain(expected)
    }
    for (const [status, label] of Object.entries(checklistStatusLabels)) {
      const count = report.summary.checklistItems[status as keyof typeof checklistStatusLabels]
      expect(fullMarkdown).toContain(`| ${label} | ${count} |`)
      expect(summaryMarkdown).toContain(`| ${label} | ${count} |`)
    }
    expect(fullMarkdown).toContain(`| **Ausgewählte Basiskatalogpunkte** | **${report.summary.checklistItems.total}** |`)
    expect(summaryMarkdown).toContain(`| **Ausgewählte Basiskatalogpunkte** | **${report.summary.checklistItems.total}** |`)
    expect(fullMarkdown).toContain('- [x] `CORE-SOC-03/C1`')
    expect(fullMarkdown).toContain('- [ ] `CORE-SEO-01/C1`')
    expect(fullMarkdown).toContain('| CORE-SEO-01 | core | Nicht zutreffend | 0/3 | 0/1 |')
    expect(fullMarkdown).toContain('Vertrauliche Nichtanwendbarkeitsbegründung')
    expect(summaryMarkdown).not.toContain('Vertrauliche')
    expect(summaryMarkdown).toContain('| CORE-DOM-02 | Fehlgeschlagen |')
    expect(summaryMarkdown).toContain('| CORE-DOM-04 | Externer Nachweis offen |')
    expect(summaryMarkdown).toContain('| CORE-ERR-01 | Zurückgestellt |')
    expect(summaryMarkdown).toContain('| CORE-ERR-03 | Akzeptierte Abweichung (offen) |')
    expect(summaryMarkdown).not.toContain('| CORE-SOC-02 |')
    expect(summaryMarkdown).not.toContain('| CORE-SOC-03 |')
    expect(summaryMarkdown).not.toContain('| CORE-SEO-01 |')
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

    const result = writeProjectReportBundle({
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
    expect(report.schemaVersion).toBe(3)
    expect(report.generatedAt).toBe('2026-08-24T18:04:17.123Z')
    expect(report.technicalRuns[0].reportFile).toBe('./technical/http.json')
    const manifest = JSON.parse(readFileSync(result.manifestFile, 'utf8'))
    const manifestSchema = JSON.parse(readFileSync(join(catalogDirectory, 'project-report.bundle-manifest.schema.json'), 'utf8'))
    const ajv = new Ajv2020.Ajv2020({ allErrors: true, strict: true })
    addFormats.default(ajv)
    const validateManifest = ajv.compile(manifestSchema)
    expect(validateManifest(manifest), JSON.stringify(validateManifest.errors, null, 2)).toBe(true)
    expect(new Set(Object.keys(manifest))).toEqual(new Set(manifestSchema.required))
    expect(manifest.files).toHaveLength(4)
    expect(manifest.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'technical/http.json', role: 'technicalReport', sha256: expect.stringMatching(/^[a-f\d]{64}$/) }),
      expect.objectContaining({ path: 'technical/social.json', role: 'technicalReport', sha256: expect.stringMatching(/^[a-f\d]{64}$/) }),
    ]))
    for (const file of manifest.files) {
      const absoluteFile = join(result.bundleDirectory, file.path)
      expect(file.bytes).toBe(statSync(absoluteFile).size)
      expect(file.sha256).toBe(createHash('sha256').update(readFileSync(absoluteFile)).digest('hex'))
      expect(statSync(absoluteFile).mode & 0o777).toBe(0o600)
    }
    expect(statSync(result.manifestFile).mode & 0o777).toBe(0o600)
    expect(statSync(result.summaryFile).mode & 0o777).toBe(0o600)

    expect(() => writeProjectReportBundle({
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

    const report = createProjectReportFromFiles(join(directory, 'project.json'))
    const markdown = renderProjectReportMarkdown(report)

    expect(markdown).toContain('# Website-QA-Prüfbericht: Beispielwebsite')
    expect(markdown).toContain('| Vollständig nachgewiesen | 1 |')
    expect(markdown).toContain('### CORE-ERR-01: Offen')
    expect(markdown).toContain('Erforderlicher Nachweis: Fehlerseite visuell und redaktionell prüfen')
    expect(markdown).toContain('Der stabile Basiskatalog ist bewusst begrenzt')
  })
})
