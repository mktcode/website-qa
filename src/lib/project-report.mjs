import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { evaluatePilotChecklist, loadPilotCatalog } from './checklist-report.mjs'
import { redactReportData, redactText, reportUrl } from './http-client.mjs'
import { aggregateEvidenceOutcomes, aggregateItemOutcome } from './outcome-aggregation.mjs'
import { packageName, packageVersion } from './package-info.mjs'

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

function technicalReportResults(report) {
  if (Array.isArray(report?.results)) {
    return report.results
  }
  if (report?.result && typeof report.result === 'object') {
    return [report.result]
  }
  return undefined
}

function validateTechnicalRun(run, config, catalog) {
  requireText(run.environment, 'Umgebung eines technischen Laufs')
  requireText(run.command, 'Befehl eines technischen Laufs')
  requireText(run.targetUrl, 'Ziel-URL eines technischen Laufs')
  const targetUrl = normalizeUrl(run.targetUrl, 'Ziel-URL eines technischen Laufs')
  const report = run.report
  const privateTargetsRedacted = report?.options?.privateTargetsRedacted === true
  const reportedTargetUrl = reportUrl(targetUrl, { hideHosts: privateTargetsRedacted }).url
  const results = technicalReportResults(report)
  if (report?.schemaVersion !== 1 || !results) {
    throw new Error(`Technischer Bericht ${run.reportFile || run.command} verwendet kein unterstütztes Schema.`)
  }
  requireText(report.generatedAt, 'Erstellungszeit des technischen Berichts')
  requireText(report.tool, 'Werkzeugkennung des technischen Berichts')
  requireText(report.toolPackage?.version, 'Werkzeugversion des technischen Berichts')
  validateCatalogReference(report.checklistCoverage?.catalog, catalog, `Technischer Bericht ${run.reportFile || run.command}`)
  const expectedParameterNames = reportUrl(targetUrl).parameterNames
  const targetReported = results.some((result) => {
    if (!result.requestedUrl) {
      return false
    }
    const resultUrl = result.requestedUrl === '(privates/lokales Ziel)'
      ? result.requestedUrl
      : reportUrl(normalizeUrl(result.requestedUrl, 'Ziel-URL im technischen Bericht')).url
    const parameterNames = result.requestedUrlParameterNames || []
    return resultUrl === reportedTargetUrl
      && JSON.stringify(parameterNames) === JSON.stringify(expectedParameterNames)
  })
  if (!targetReported) {
    throw new Error(`Technischer Bericht ${run.reportFile || run.command} weist die deklarierte Ziel-URL nicht aus.`)
  }

  for (const field of ['sourceRevision', 'deploymentId']) {
    const expected = config.project[field]
    if (expected && run[field] !== expected) {
      throw new Error(`Technischer Lauf ${run.reportFile || run.command} weist ${field} nicht passend zum Projektbericht aus.`)
    }
  }

  return {
    assertions: results.flatMap(result => result.assertions || []).map((assertion) => {
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
      assertionCount: results.reduce((sum, result) => sum + (result.assertions?.length || 0), 0),
      command: redactText(run.command, 10_000),
      contextProvenance: {
        deploymentId: 'projectDeclared',
        sourceRevision: 'projectDeclared',
        targetUrl: 'matchedAgainstRedactedTechnicalReport',
      },
      deploymentId: run.deploymentId,
      environment: run.environment,
      generatedAt: report.generatedAt,
      reportFile: run.reportFile,
      sourceRevision: run.sourceRevision,
      summary: report.summary,
      targetUrl: reportedTargetUrl,
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

export function createPilotProjectReport({ config, evidenceDocument, generatedAt = new Date().toISOString(), technicalRuns }) {
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

  const reportGeneratedAt = generatedAt
  if (Number.isNaN(new Date(reportGeneratedAt).valueOf())) {
    throw new TypeError('Erstellungszeit des Projektberichts ist ungültig.')
  }

  return redactReportData({
    catalog: evaluated.catalog,
    generatedAt: reportGeneratedAt,
    items,
    limitations: [
      'Der strukturierte Katalog ist ein Pilot und umfasst noch nicht die vollständige Website-Checkliste.',
      'Automatische Ergebnisse sind technische Teilnachweise und ersetzen keine manuellen, externen, rechtlichen oder organisatorischen Prüfungen.',
      'Nur technische Läufe der festgelegten Auswertungsumgebung fließen in die Checklistenbewertung ein.',
      'Quell- und Deploymentstand technischer Läufe sind projektseitig deklarierte Zuordnungen; das technische Werkzeug bestätigt sie nicht unabhängig.',
      'Simulierte Social-Crawler-User-Agents ersetzen keine echte Plattformvorschau und keinen Nachweis des Plattformcaches.',
    ],
    project: structuredClone(config.project),
    provenance: {
      deploymentAndSourceContext: 'projectDeclared',
      targetUrlBinding: 'matchedAgainstRedactedTechnicalReport',
    },
    schemaVersion: 2,
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
  })
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

function canonicalValue(entry) {
  if (Array.isArray(entry)) {
    return entry.map(canonicalValue)
  }
  if (entry && typeof entry === 'object') {
    return Object.fromEntries(Object.keys(entry)
      .filter(key => entry[key] !== undefined)
      .toSorted()
      .map(key => [key, canonicalValue(entry[key])]))
  }
  return entry
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value))
}

function v3CriterionCounts(counts) {
  return Object.fromEntries(['pass', 'fail', 'inconclusive', 'notApplicable', 'noEvidence', 'total']
    .map(key => [key, counts[key]]))
}

function expectedCriterionOutcome(criterion, recordsById) {
  const records = criterion.recordRefs.map(reference => recordsById.get(reference)?.record)
  if (criterion.mode !== 'automatic') {
    return aggregateEvidenceOutcomes(records.map(record => record?.outcome || 'noEvidence'))
  }
  const assertionOutcomes = criterion.requiredAssertionIds.map((assertionId) => {
    const matching = records.filter(record => record?.assertionId === assertionId)
    return aggregateEvidenceOutcomes(matching.map(record => record.outcome))
  })
  return aggregateEvidenceOutcomes(assertionOutcomes)
}

function expectedCounts(entries, keys) {
  return Object.fromEntries([...keys.map(key => [key, entries.filter(entry => entry.outcome === key).length]), ['total', entries.length]])
}

function requireEqualCounts(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual?.[key] !== value) {
      throw new Error(`${label} ist bei ${key} nicht summengleich.`)
    }
  }
}

export function validatePilotProjectReportV3(report) {
  if (report?.schemaVersion !== 3 || !Array.isArray(report.records) || !Array.isArray(report.items)) {
    throw new Error('Projektbericht verwendet nicht das normalisierte Pilotschema 3.')
  }
  const recordsById = new Map()
  const canonicalRecords = new Set()
  for (const [index, entry] of report.records.entries()) {
    const expectedId = `R${String(index + 1).padStart(6, '0')}`
    if (entry?.id !== expectedId || !['assertion', 'evidence'].includes(entry.type) || !entry.record || typeof entry.record !== 'object') {
      throw new Error(`Normalisierter Record ${entry?.id || expectedId} ist unvollständig.`)
    }
    if (recordsById.has(entry.id)) {
      throw new Error(`Normalisierte Record-ID ist mehrfach vergeben: ${entry.id}`)
    }
    const canonical = `${entry.type}:${canonicalJson(entry.record)}`
    if (canonicalRecords.has(canonical)) {
      throw new Error(`Normalisierter Record ${entry.id} dupliziert einen vorhandenen Record.`)
    }
    canonicalRecords.add(canonical)
    recordsById.set(entry.id, entry)
  }

  const referencedRecords = new Set()
  for (const item of report.items) {
    for (const criterion of item.criteria || []) {
      if (!Array.isArray(criterion.recordRefs) || new Set(criterion.recordRefs).size !== criterion.recordRefs.length) {
        throw new Error(`Kriterium ${criterion.id} verwendet keine eindeutigen Recordreferenzen.`)
      }
      if (criterion.mode === 'automatic' && (!Array.isArray(criterion.requiredAssertionIds)
        || criterion.requiredAssertionIds.length === 0
        || new Set(criterion.requiredAssertionIds).size !== criterion.requiredAssertionIds.length)) {
        throw new Error(`Automatisches Kriterium ${criterion.id} nennt keine eindeutigen erforderlichen Assertions.`)
      }
      if (criterion.mode !== 'automatic' && criterion.requiredAssertionIds !== undefined) {
        throw new Error(`Nicht automatisches Kriterium ${criterion.id} nennt unerwartete Assertions.`)
      }
      for (const reference of criterion.recordRefs) {
        const entry = recordsById.get(reference)
        if (!entry) {
          throw new Error(`Kriterium ${criterion.id} verweist auf den unbekannten Record ${reference}.`)
        }
        if ((criterion.mode === 'automatic') !== (entry.type === 'assertion')) {
          throw new Error(`Kriterium ${criterion.id} verweist auf den ungeeigneten Record ${reference}.`)
        }
        if (entry.type === 'assertion' && !criterion.requiredAssertionIds.includes(entry.record.assertionId)) {
          throw new Error(`Kriterium ${criterion.id} verweist auf die nicht erforderliche Assertion ${entry.record.assertionId}.`)
        }
        if (entry.type === 'evidence' && entry.record.criterionId !== criterion.id) {
          throw new Error(`Kriterium ${criterion.id} verweist auf Evidence für ${entry.record.criterionId}.`)
        }
        referencedRecords.add(reference)
      }
      const expectedOutcome = expectedCriterionOutcome(criterion, recordsById)
      if (criterion.outcome !== expectedOutcome) {
        throw new Error(`Kriterium ${criterion.id} hat ${criterion.outcome} statt ${expectedOutcome}.`)
      }
    }
    const expectedOutcome = aggregateItemOutcome(item.criteria)
    if (item.evidenceOutcome !== expectedOutcome) {
      throw new Error(`Checklistenpunkt ${item.id} hat ${item.evidenceOutcome} statt ${expectedOutcome}.`)
    }
    const expectedProjectStatus = item.workflow?.status || derivedProjectStatus(expectedOutcome)
    if (item.projectStatus !== expectedProjectStatus) {
      throw new Error(`Checklistenpunkt ${item.id} hat den Projektstatus ${item.projectStatus} statt ${expectedProjectStatus}.`)
    }
  }
  if (referencedRecords.size !== report.records.length) {
    throw new Error('Normalisierter Projektbericht enthält nicht referenzierte Records.')
  }

  const criteria = report.items.flatMap(item => item.criteria)
  const criterionKeys = ['pass', 'fail', 'inconclusive', 'notApplicable', 'noEvidence']
  requireEqualCounts(report.summary?.automaticCriteria, expectedCounts(criteria.filter(criterion => criterion.mode === 'automatic'), criterionKeys), 'Zusammenfassung automatischer Kriterien')
  requireEqualCounts(report.summary?.nonAutomaticCriteria, expectedCounts(criteria.filter(criterion => criterion.mode !== 'automatic'), criterionKeys), 'Zusammenfassung nicht automatischer Kriterien')
  const statusEntries = report.items.map(item => ({ outcome: item.projectStatus }))
  requireEqualCounts(report.summary?.checklistItems, expectedCounts(statusEntries, projectStatusOrder), 'Zusammenfassung der Checklistenpunkte')
  return true
}

export function convertPilotProjectReportToV3(inputReport) {
  if (inputReport?.schemaVersion !== 2) {
    throw new Error('Nur Pilotprojektberichte des Ausgabeschemas 2 können normalisiert werden.')
  }
  const report = redactReportData(structuredClone(inputReport))
  const catalog = loadPilotCatalog()
  validateCatalogReference(report.catalog, catalog, 'Projektbericht')
  const criteriaById = new Map(catalog.items.flatMap(item => item.criteria).map(criterion => [criterion.id, criterion]))
  const records = []
  const referencesByRecord = new Map()

  function recordReference(type, record) {
    const key = `${type}:${canonicalJson(record)}`
    let reference = referencesByRecord.get(key)
    if (!reference) {
      reference = `R${String(records.length + 1).padStart(6, '0')}`
      referencesByRecord.set(key, reference)
      records.push({ id: reference, record: structuredClone(record), type })
    }
    return reference
  }

  const items = report.items.map(item => ({
    ...item,
    criteria: item.criteria.map((criterion) => {
      const catalogCriterion = criteriaById.get(criterion.id)
      if (!catalogCriterion || catalogCriterion.verification.mode !== criterion.mode) {
        throw new Error(`Kriterium ${criterion.id} passt nicht zum Pilotkatalog.`)
      }
      const normalized = {
        ...criterion,
        recordRefs: [...new Set(criterion.records.map(record => recordReference(criterion.mode === 'automatic' ? 'assertion' : 'evidence', record)))],
      }
      delete normalized.records
      if (criterion.mode === 'automatic') {
        normalized.requiredAssertionIds = [...catalogCriterion.verification.assertions]
      }
      return normalized
    }),
  }))

  const normalized = {
    ...report,
    items,
    records,
    technicalRuns: report.technicalRuns.map(run => ({
      ...run,
      contextProvenance: {
        ...run.contextProvenance,
        targetUrl: 'matchedAgainstRedactedTechnicalReport',
      },
    })),
    schemaVersion: 3,
    summary: {
      ...report.summary,
      automaticCriteria: v3CriterionCounts(report.summary.automaticCriteria),
      nonAutomaticCriteria: v3CriterionCounts(report.summary.nonAutomaticCriteria),
    },
  }
  validatePilotProjectReportV3(normalized)
  return normalized
}

export function createPilotProjectReportV3(options) {
  return convertPilotProjectReportToV3(createPilotProjectReport(options))
}

export function createPilotProjectReportV3FromFiles(configFile) {
  return convertPilotProjectReportToV3(createPilotProjectReportFromFiles(configFile))
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

function criterionSummary(label, counts, successfulLabel) {
  return `${label} (${counts.total} gesamt): ${counts.pass} ${successfulLabel}, ${counts.fail} fehlgeschlagen, ${counts.inconclusive} unklar, ${counts.notApplicable} nicht zutreffend, ${counts.noEvidence} ohne Nachweis.`
}

function resolvedCriterionCount(criteria) {
  return criteria.filter(criterion => ['notApplicable', 'pass'].includes(criterion.outcome)).length
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
    criterionSummary('Automatische Kriterien', report.summary.automaticCriteria, 'bestanden'),
    '',
    criterionSummary('Nicht automatische Kriterien', report.summary.nonAutomaticCriteria, 'belegt'),
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
    '| ID | Modul | Projektstatus | Automatisch geklärt | Nicht automatisch geklärt |',
    '|---|---|---|---:|---:|',
  )
  for (const item of report.items) {
    const automatic = item.criteria.filter(criterion => criterion.mode === 'automatic')
    const nonAutomatic = item.criteria.filter(criterion => criterion.mode !== 'automatic')
    lines.push(`| ${item.id} | ${markdownText(item.module)} | ${statusLabel(item.projectStatus)} | ${resolvedCriterionCount(automatic)}/${automatic.length} | ${resolvedCriterionCount(nonAutomatic)}/${nonAutomatic.length} |`)
  }

  for (const item of report.items) {
    lines.push('', `### ${item.id}: ${statusLabel(item.projectStatus)}`, '', item.statement, '')
    if (item.workflow) {
      lines.push(`Workflow: **${statusLabel(item.workflow.status)}** – ${markdownText(item.workflow.note)}`, '')
    }
    for (const criterion of item.criteria) {
      const checked = ['notApplicable', 'pass'].includes(criterion.outcome)
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

function publicLabelText(value) {
  return markdownText(redactText(value, 200))
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
}

function publicSummaryUrl(value) {
  let url
  try {
    url = new URL(value)
  }
  catch {
    throw new TypeError('Freigegebene öffentliche URL ist ungültig.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError('Freigegebene öffentliche URL muss HTTP oder HTTPS ohne Zugangsdaten verwenden.')
  }
  const reported = reportUrl(url.href).url
  if (['(privates/lokales Ziel)', '(ungültige URL)'].includes(reported)) {
    throw new TypeError('Freigegebene öffentliche URL ist keine berichtsfähige öffentliche URL.')
  }
  return reported
}

export function renderPilotProjectSummaryMarkdown(report, options = {}) {
  const publicLabel = options.publicProject?.label
    ? publicLabelText(options.publicProject.label)
    : undefined
  const publicUrl = options.publicProject?.url
    ? publicSummaryUrl(options.publicProject.url)
    : undefined
  const title = publicLabel
    ? `# Website-QA-Zusammenfassung: ${publicLabel}`
    : '# Website-QA-Zusammenfassung'
  const lines = [
    title,
    '',
    '> Automatisch erzeugte, bewusst datenarme Übersicht. Der vollständige technische Bericht und seine Rohdaten werden standardmäßig nur lokal aufbewahrt.',
    '',
    '## Stand',
    '',
    '| Feld | Wert |',
    '|---|---|',
    `| Erstellt | ${markdownText(report.generatedAt)} |`,
    `| Katalog | ${markdownText(report.catalog.id)} ${markdownText(report.catalog.version)} (${markdownText(report.catalog.status)}) |`,
  ]

  if (publicUrl) {
    lines.push(`| Öffentlich freigegebene URL | ${markdownText(publicUrl)} |`)
  }

  lines.push(
    '',
    '## Zusammenfassung',
    '',
    '| Status | Anzahl |',
    '|---|---:|',
  )
  for (const status of projectStatusOrder) {
    lines.push(`| ${statusLabel(status)} | ${report.summary.checklistItems[status]} |`)
  }
  lines.push(
    `| **Ausgewählte Pilotpunkte** | **${report.summary.checklistItems.total}** |`,
    '',
    criterionSummary('Automatische Kriterien', report.summary.automaticCriteria, 'bestanden'),
    '',
    criterionSummary('Nicht automatische Kriterien', report.summary.nonAutomaticCriteria, 'belegt'),
    '',
    '## Technische Läufe',
    '',
    '| Werkzeug | Version | Für Auswertung verwendet | Assertions |',
    '|---|---|---:|---:|',
  )

  for (const run of report.technicalRuns) {
    lines.push(`| ${markdownText(run.tool)} | ${markdownText(run.toolPackage?.version || 'nicht angegeben')} | ${run.usedForEvaluation ? 'ja' : 'nein'} | ${run.assertionCount} |`)
  }
  if (report.technicalRuns.length === 0) {
    lines.push('| – | – | nein | 0 |')
  }

  const unfinishedItems = report.items.filter(item => !['complete', 'notApplicable'].includes(item.projectStatus))
  lines.push(
    '',
    '## Noch nicht vollständig nachgewiesene Pilotpunkte',
    '',
    '| ID | Status | Allgemeine Aussage |',
    '|---|---|---|',
  )
  for (const item of unfinishedItems) {
    lines.push(`| ${item.id} | ${statusLabel(item.projectStatus)} | ${markdownText(item.statement)} |`)
  }
  if (unfinishedItems.length === 0) {
    lines.push('| – | Keine offenen Pilotpunkte | – |')
  }

  lines.push(
    '',
    '## Grenzen',
    '',
    '- Der strukturierte Katalog ist ein Pilot und umfasst noch nicht die vollständige Website-Checkliste.',
    '- Automatische Ergebnisse sind technische Teilnachweise und ersetzen keine manuellen, externen, rechtlichen oder organisatorischen Prüfungen.',
    '- Ein unauffälliger Axe-Lauf ist kein vollständiger WCAG-Nachweis.',
    '- Headless-Chromium-Profile sind keine Prüfung realer Geräte, Safari-Browser oder Screenreader.',
    '- Simulierte Social-Crawler-User-Agents sind keine echte Plattformvorschau und kein Nachweis des Plattformcaches.',
    '- Die Zusammenfassung enthält bewusst keine Rohbefunde, freien Nachweisnotizen, Personen, internen Umgebungskennungen oder lokalen Pfade.',
    '- Vor einem Commit oder einer Veröffentlichung ist die Datei trotzdem projektspezifisch zu prüfen.',
    '',
  )
  return lines.join('\n')
}

function bundleTimestamp(now) {
  const date = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(date.valueOf())) {
    throw new TypeError('Bundle-Zeitpunkt ist ungültig.')
  }
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replaceAll(':', '-')
}

function portablePath(value) {
  return value.split(sep).join('/')
}

function fileDigest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function manifestFile(path, baseDirectory, role) {
  return {
    bytes: statSync(path).size,
    path: portablePath(relative(baseDirectory, path)),
    role,
    sha256: fileDigest(path),
  }
}

function technicalFileStem(tool) {
  if (tool === 'social-preview-check') {
    return 'social'
  }
  const stem = String(tool || 'technical-report')
    .toLowerCase()
    .replace(/-check$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return stem || 'technical-report'
}

function jsonWithNewline(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function writePilotProjectReportBundle({
  bundleDirectory = './.website-qa/reports',
  configFile = '',
  now = new Date(),
  publicProject = {},
  summaryDirectory = './docs/website-qa/berichte',
} = {}) {
  requireText(configFile, 'Projektberichtskonfiguration')
  const absoluteConfigFile = resolve(configFile)
  const configDirectory = dirname(absoluteConfigFile)
  const config = readJson(absoluteConfigFile)
  const timestamp = bundleTimestamp(now)
  const absoluteBundleRoot = resolve(configDirectory, bundleDirectory)
  const absoluteSummaryRoot = resolve(configDirectory, summaryDirectory)
  const finalBundleDirectory = join(absoluteBundleRoot, timestamp)
  const finalSummaryFile = join(absoluteSummaryRoot, `${timestamp}.md`)

  if (existsSync(finalBundleDirectory) || existsSync(finalSummaryFile)) {
    throw new Error(`Für ${timestamp} existiert bereits ein Website-QA-Bericht.`)
  }

  mkdirSync(absoluteBundleRoot, { recursive: true })
  mkdirSync(absoluteSummaryRoot, { recursive: true })
  const temporaryBundleDirectory = mkdtempSync(join(absoluteBundleRoot, '.bundle-'))
  const temporarySummaryFile = `${finalSummaryFile}.${process.pid}.tmp`

  try {
    const technicalDirectory = join(temporaryBundleDirectory, 'technical')
    mkdirSync(technicalDirectory)
    const stemCounts = new Map()
    const archivedRuns = config.technicalRuns.map((run) => {
      const sourceFile = resolve(configDirectory, run.reportFile)
      const sourceReport = readJson(sourceFile)
      requireText(sourceReport.tool, `Werkzeugkennung in ${run.reportFile}`)
      const stem = technicalFileStem(sourceReport.tool)
      const count = (stemCounts.get(stem) || 0) + 1
      stemCounts.set(stem, count)
      const fileName = `${stem}${count > 1 ? `-${count}` : ''}.json`
      const archivedFile = join(technicalDirectory, fileName)
      copyFileSync(sourceFile, archivedFile)
      chmodSync(archivedFile, 0o600)
      return Object.assign({}, run, {
        archivedFile,
        report: readJson(archivedFile),
        reportFile: `./technical/${fileName}`,
      })
    })
    const evidenceDocument = config.evidenceFile
      ? readJson(resolve(configDirectory, config.evidenceFile))
      : undefined
    const generatedAt = (now instanceof Date ? now : new Date(now)).toISOString()
    const report = createPilotProjectReport({
      config,
      evidenceDocument,
      generatedAt,
      technicalRuns: archivedRuns,
    })
    const reportJsonFile = join(temporaryBundleDirectory, 'report.json')
    const reportMarkdownFile = join(temporaryBundleDirectory, 'report.md')
    writeFileSync(reportJsonFile, jsonWithNewline(report), { encoding: 'utf8', mode: 0o600 })
    writeFileSync(reportMarkdownFile, renderPilotProjectReportMarkdown(report), { encoding: 'utf8', mode: 0o600 })

    const summary = renderPilotProjectSummaryMarkdown(report, { publicProject })
    writeFileSync(temporarySummaryFile, summary, { encoding: 'utf8', flag: 'wx', mode: 0o600 })

    const technicalFiles = archivedRuns.map(run => manifestFile(run.archivedFile, temporaryBundleDirectory, 'technicalReport'))
    const manifest = {
      catalog: report.catalog,
      files: [
        ...technicalFiles,
        manifestFile(reportJsonFile, temporaryBundleDirectory, 'projectReportJson'),
        manifestFile(reportMarkdownFile, temporaryBundleDirectory, 'projectReportMarkdown'),
      ],
      generatedAt,
      package: { name: packageName, version: packageVersion },
      schemaVersion: 1,
      technicalRuns: report.technicalRuns.map(run => ({
        generatedAt: run.generatedAt,
        reportFile: run.reportFile,
        tool: run.tool,
        usedForEvaluation: run.usedForEvaluation,
      })),
    }
    writeFileSync(join(temporaryBundleDirectory, 'manifest.json'), jsonWithNewline(manifest), { encoding: 'utf8', mode: 0o600 })

    renameSync(temporaryBundleDirectory, finalBundleDirectory)
    try {
      renameSync(temporarySummaryFile, finalSummaryFile)
    }
    catch (error) {
      rmSync(finalBundleDirectory, { force: true, recursive: true })
      throw error
    }

    return {
      bundleDirectory: finalBundleDirectory,
      manifestFile: join(finalBundleDirectory, 'manifest.json'),
      reportFile: join(finalBundleDirectory, 'report.json'),
      reportMarkdownFile: join(finalBundleDirectory, 'report.md'),
      summaryFile: finalSummaryFile,
      timestamp,
    }
  }
  catch (error) {
    rmSync(temporaryBundleDirectory, { force: true, recursive: true })
    rmSync(temporarySummaryFile, { force: true })
    throw error
  }
}
