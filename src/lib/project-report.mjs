import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { evaluatePilotChecklist, loadPilotCatalog } from './checklist-report.mjs'

const allowedItemStates = new Set(['acceptedDeviation', 'deferred', 'external', 'notApplicable'])
const projectStatusOrder = ['complete', 'failed', 'partial', 'open', 'inconclusive', 'notApplicable', 'external', 'deferred', 'acceptedDeviation']

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function validDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '')
    && !Number.isNaN(parsed.valueOf())
    && parsed.toISOString().slice(0, 10) === value
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} fehlt.`)
  }
}

function validateCatalogReference(reference, catalog, label) {
  if (reference?.id !== catalog.catalogId || reference?.version !== catalog.catalogVersion) {
    throw new Error(`${label} verwendet nicht ${catalog.catalogId} ${catalog.catalogVersion}.`)
  }
}

function validateProjectConfiguration(config, catalog) {
  if (config.schemaVersion !== 1) {
    throw new Error('Projektberichtskonfiguration verwendet kein unterstütztes Schema.')
  }
  validateCatalogReference(config.catalog, catalog, 'Projektberichtskonfiguration')
  requireText(config.project?.name, 'Projektname')
  requireText(config.project?.evaluationEnvironment, 'Auswertungsumgebung')
  if (!Array.isArray(config.selectedModules) || !config.selectedModules.includes('core')) {
    throw new Error('Der verpflichtende Katalogbestandteil core muss ausgewählt sein.')
  }
  if (!Array.isArray(config.technicalRuns)) {
    throw new TypeError('technicalRuns muss als Liste angegeben sein.')
  }

  const knownModules = new Set(catalog.items.map(item => item.module))
  for (const module of config.selectedModules) {
    if (!knownModules.has(module)) {
      throw new Error(`Der Pilotkatalog enthält das ausgewählte Modul ${module} nicht.`)
    }
  }

  const selectedItems = new Set(catalog.items
    .filter(item => config.selectedModules.includes(item.module))
    .map(item => item.id))
  const seenStates = new Set()
  for (const state of config.itemStates || []) {
    if (!selectedItems.has(state.itemId)) {
      throw new Error(`Projektstatus verweist auf den nicht ausgewählten Punkt ${state.itemId}.`)
    }
    if (seenStates.has(state.itemId)) {
      throw new Error(`Projektstatus für ${state.itemId} ist mehrfach angegeben.`)
    }
    seenStates.add(state.itemId)
    if (!allowedItemStates.has(state.status)) {
      throw new Error(`Projektstatus ${state.status} für ${state.itemId} ist unbekannt.`)
    }
    if (!validDate(state.recordedAt) || !state.recordedBy?.trim() || !state.note?.trim()) {
      throw new Error(`Projektstatus ${state.itemId} benötigt Datum, verantwortliche Stelle und Begründung.`)
    }
    if (['acceptedDeviation', 'deferred', 'external'].includes(state.status) && !state.responsible?.trim()) {
      throw new Error(`Projektstatus ${state.itemId} benötigt eine Verantwortlichkeit.`)
    }
    if (['acceptedDeviation', 'deferred'].includes(state.status) && !validDate(state.reviewAt)) {
      throw new Error(`Projektstatus ${state.itemId} benötigt eine Wiedervorlage.`)
    }
  }
  return [...selectedItems]
}

function validateEvidenceDocument(document, catalog) {
  if (!document) {
    return []
  }
  if (document.schemaVersion !== 1 || !Array.isArray(document.evidence)) {
    throw new Error('Projektnachweisdatei verwendet kein unterstütztes Schema.')
  }
  validateCatalogReference(document.catalog, catalog, 'Projektnachweisdatei')
  return document.evidence
}

function normalizeUrl(value, label) {
  try {
    return new URL(value).href
  }
  catch {
    throw new TypeError(`${label} ist keine gültige URL.`)
  }
}

function validateTechnicalRun(run, config, catalog) {
  requireText(run.environment, 'Umgebung eines technischen Laufs')
  requireText(run.command, 'Befehl eines technischen Laufs')
  requireText(run.targetUrl, 'Ziel-URL eines technischen Laufs')
  const targetUrl = normalizeUrl(run.targetUrl, 'Ziel-URL eines technischen Laufs')
  const report = run.report
  if (report?.schemaVersion !== 1 || !Array.isArray(report.results)) {
    throw new Error(`Technischer Bericht ${run.reportFile || run.command} verwendet kein unterstütztes Schema.`)
  }
  requireText(report.generatedAt, 'Erstellungszeit des technischen Berichts')
  requireText(report.tool, 'Werkzeugkennung des technischen Berichts')
  requireText(report.toolPackage?.version, 'Werkzeugversion des technischen Berichts')
  validateCatalogReference(report.checklistCoverage?.catalog, catalog, `Technischer Bericht ${run.reportFile || run.command}`)
  const reportedTargetUrls = report.results
    .map(result => result.requestedUrl)
    .filter(Boolean)
    .map(value => normalizeUrl(value, 'Ziel-URL im technischen Bericht'))
  if (!reportedTargetUrls.includes(targetUrl)) {
    throw new Error(`Technischer Bericht ${run.reportFile || run.command} weist die deklarierte Ziel-URL nicht aus.`)
  }

  for (const field of ['sourceRevision', 'deploymentId']) {
    const expected = config.project[field]
    if (expected && run[field] !== expected) {
      throw new Error(`Technischer Lauf ${run.reportFile || run.command} weist ${field} nicht passend zum Projektbericht aus.`)
    }
  }

  return {
    assertions: report.results.flatMap(result => result.assertions || []).map((assertion) => {
      const scopedAssertion = structuredClone(assertion)
      scopedAssertion.subject = Object.assign({}, scopedAssertion.subject, {
        deploymentId: run.deploymentId,
        environment: run.environment,
        sourceRevision: run.sourceRevision,
        tool: report.tool,
      })
      return scopedAssertion
    }),
    record: {
      assertionCount: report.results.reduce((sum, result) => sum + (result.assertions?.length || 0), 0),
      command: run.command,
      contextProvenance: {
        deploymentId: 'projectDeclared',
        sourceRevision: 'projectDeclared',
        targetUrl: 'verifiedFromTechnicalReport',
      },
      deploymentId: run.deploymentId,
      environment: run.environment,
      generatedAt: report.generatedAt,
      reportFile: run.reportFile,
      sourceRevision: run.sourceRevision,
      summary: report.summary,
      targetUrl,
      tool: report.tool,
      toolPackage: report.toolPackage,
      usedForEvaluation: run.environment === config.project.evaluationEnvironment,
    },
  }
}

function derivedProjectStatus(evidenceOutcome) {
  return {
    fail: 'failed',
    inconclusive: 'inconclusive',
    notApplicable: 'notApplicable',
    open: 'open',
    partial: 'partial',
    pass: 'complete',
  }[evidenceOutcome] || 'open'
}

function countProjectStatuses(items) {
  return Object.fromEntries(projectStatusOrder.map(status => [status, items.filter(item => item.projectStatus === status).length]))
}

export function createPilotProjectReport({ config, evidenceDocument, technicalRuns }) {
  const catalog = loadPilotCatalog()
  const selectedItemIds = validateProjectConfiguration(config, catalog)
  const evidence = validateEvidenceDocument(evidenceDocument, catalog)
  const runEvaluations = technicalRuns.map(run => validateTechnicalRun(run, config, catalog))
  const usedRuns = runEvaluations.filter(run => run.record.usedForEvaluation)
  const assertions = usedRuns.flatMap(run => run.assertions)
  const evaluated = evaluatePilotChecklist({ assertions, evidence, itemIds: selectedItemIds })
  const statesByItem = new Map((config.itemStates || []).map(state => [state.itemId, state]))
  const warnings = []

  if (usedRuns.length === 0) {
    warnings.push(`Kein technischer Lauf gehört zur Auswertungsumgebung ${config.project.evaluationEnvironment}.`)
  }

  const items = evaluated.items.map((item) => {
    const workflow = statesByItem.get(item.id)
    const projectStatus = workflow?.status || derivedProjectStatus(item.outcome)
    if (workflow && item.outcome === 'pass' && workflow.status !== 'notApplicable') {
      warnings.push(`${item.id} ist technisch beziehungsweise dokumentarisch vollständig belegt, besitzt aber weiterhin den Workflowstatus ${workflow.status}.`)
    }
    return {
      criteria: item.criteria,
      evidenceOutcome: item.outcome,
      id: item.id,
      module: item.module,
      projectStatus,
      statement: item.statement,
      workflow,
    }
  })

  return {
    catalog: evaluated.catalog,
    generatedAt: new Date().toISOString(),
    items,
    limitations: [
      'Der strukturierte Katalog ist ein Pilot und umfasst noch nicht die vollständige Website-Checkliste.',
      'Automatische Ergebnisse sind technische Teilnachweise und ersetzen keine manuellen, externen, rechtlichen oder organisatorischen Prüfungen.',
      'Nur technische Läufe der festgelegten Auswertungsumgebung fließen in die Checklistenbewertung ein.',
      'Quell- und Deploymentstand technischer Läufe sind projektseitig deklarierte Zuordnungen; das technische Werkzeug bestätigt sie nicht unabhängig.',
    ],
    project: structuredClone(config.project),
    provenance: {
      deploymentAndSourceContext: 'projectDeclared',
      targetUrlBinding: 'verifiedFromTechnicalReport',
    },
    schemaVersion: 1,
    scope: {
      selectedItemIds,
      selectedModules: [...config.selectedModules],
    },
    summary: {
      automaticCriteria: evaluated.summary.automaticCriteria,
      checklistItems: {
        ...countProjectStatuses(items),
        total: items.length,
      },
      nonAutomaticCriteria: evaluated.summary.nonAutomaticCriteria,
    },
    technicalRuns: runEvaluations.map(run => run.record),
    warnings,
  }
}

export function createPilotProjectReportFromFiles(configFile) {
  const absoluteConfigFile = resolve(configFile)
  const baseDirectory = dirname(absoluteConfigFile)
  const config = readJson(absoluteConfigFile)
  const evidenceDocument = config.evidenceFile ? readJson(resolve(baseDirectory, config.evidenceFile)) : undefined
  const technicalRuns = config.technicalRuns.map(run => ({
    ...run,
    report: readJson(resolve(baseDirectory, run.reportFile)),
  }))
  return createPilotProjectReport({ config, evidenceDocument, technicalRuns })
}

function markdownText(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim()
}

function statusLabel(status) {
  return {
    acceptedDeviation: 'Akzeptierte Abweichung (offen)',
    complete: 'Vollständig nachgewiesen',
    deferred: 'Zurückgestellt',
    external: 'Externer Nachweis offen',
    failed: 'Fehlgeschlagen',
    inconclusive: 'Unklar',
    notApplicable: 'Nicht zutreffend',
    open: 'Offen',
    partial: 'Teilweise nachgewiesen',
  }[status] || status
}

export function renderPilotProjectReportMarkdown(report) {
  const lines = [
    `# Website-QA-Prüfbericht: ${markdownText(report.project.name)}`,
    '',
    '> Strukturierter Pilotbericht. Er umfasst noch nicht die vollständige Website-Checkliste und ist kein vollständiger WCAG-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsfreigabenachweis.',
    '',
    '## Berichtsstand',
    '',
    '| Feld | Wert |',
    '|---|---|',
    `| Erstellt | ${markdownText(report.generatedAt)} |`,
    `| Katalog | ${markdownText(report.catalog.id)} ${markdownText(report.catalog.version)} (${markdownText(report.catalog.status)}) |`,
    `| Auswertungsumgebung | ${markdownText(report.project.evaluationEnvironment)} |`,
    `| Bevorzugte URL | ${markdownText(report.project.preferredUrl || 'nicht angegeben')} |`,
    `| Quellstand | ${markdownText(report.project.sourceRevision || 'nicht angegeben')} |`,
    `| Deployment | ${markdownText(report.project.deploymentId || 'nicht angegeben')} |`,
    '| Herkunft Quell-/Deploymentstand | projektseitig deklariert |',
    '',
    '## Zusammenfassung',
    '',
    '| Projektstatus | Anzahl |',
    '|---|---:|',
  ]

  for (const status of projectStatusOrder) {
    lines.push(`| ${statusLabel(status)} | ${report.summary.checklistItems[status]} |`)
  }
  lines.push(`| **Ausgewählte Pilotpunkte** | **${report.summary.checklistItems.total}** |`)
  lines.push(
    '',
    `Automatische Kriterien: ${report.summary.automaticCriteria.pass} bestanden, ${report.summary.automaticCriteria.fail} fehlgeschlagen, ${report.summary.automaticCriteria.inconclusive} unklar, ${report.summary.automaticCriteria.noEvidence} ohne Nachweis.`,
    '',
    `Nicht automatische Kriterien: ${report.summary.nonAutomaticCriteria.pass} belegt, ${report.summary.nonAutomaticCriteria.fail} fehlgeschlagen, ${report.summary.nonAutomaticCriteria.noEvidence} ohne Nachweis.`,
    '',
    '## Technische Läufe',
    '',
    '| Werkzeug | Ziel | Umgebung | Verwendet | Assertions | Befehl |',
    '|---|---|---|---:|---:|---|',
  )

  for (const run of report.technicalRuns) {
    lines.push(`| ${markdownText(run.tool)} ${markdownText(run.toolPackage?.version || '')} | ${markdownText(run.targetUrl)} | ${markdownText(run.environment)} | ${run.usedForEvaluation ? 'ja' : 'nein'} | ${run.assertionCount} | <code>${markdownText(run.command)}</code> |`)
  }
  if (report.technicalRuns.length === 0) {
    lines.push('| – | – | – | nein | 0 | Kein technischer Bericht eingebunden |')
  }

  lines.push(
    '',
    '## Checklistenpunkte',
    '',
    '| ID | Modul | Projektstatus | Automatisch | Nicht automatisch |',
    '|---|---|---|---:|---:|',
  )
  for (const item of report.items) {
    const automatic = item.criteria.filter(criterion => criterion.mode === 'automatic')
    const nonAutomatic = item.criteria.filter(criterion => criterion.mode !== 'automatic')
    lines.push(`| ${item.id} | ${markdownText(item.module)} | ${statusLabel(item.projectStatus)} | ${automatic.filter(criterion => criterion.outcome === 'pass').length}/${automatic.length} | ${nonAutomatic.filter(criterion => criterion.outcome === 'pass').length}/${nonAutomatic.length} |`)
  }

  for (const item of report.items) {
    lines.push('', `### ${item.id}: ${statusLabel(item.projectStatus)}`, '', item.statement, '')
    if (item.workflow) {
      lines.push(`Workflow: **${statusLabel(item.workflow.status)}** – ${markdownText(item.workflow.note)}`, '')
    }
    for (const criterion of item.criteria) {
      const checked = ['notApplicable', 'pass'].includes(criterion.outcome) || item.projectStatus === 'notApplicable'
      lines.push(`- [${checked ? 'x' : ' '}] \`${criterion.id}\` ${criterion.statement} — ${criterion.mode}, ${criterion.outcome}`)
      if (!checked && criterion.evidenceInstructions) {
        lines.push(`  - Erforderlicher Nachweis: ${criterion.evidenceInstructions}`)
      }
    }
  }

  if (report.warnings.length > 0) {
    lines.push('', '## Warnungen', '', ...report.warnings.map(warning => `- ${warning}`))
  }
  lines.push('', '## Grenzen', '', ...report.limitations.map(limitation => `- ${limitation}`), '')
  return lines.join('\n')
}
