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
import { evaluateChecklist, loadAssertionRegistry, loadWebsiteCatalog } from './checklist-report.mjs'
import { redactReportData, redactText, reportUrl } from './http-client.mjs'
import { aggregateEvidenceOutcomes, aggregateItemOutcome } from './outcome-aggregation.mjs'
import { packageName, packageVersion } from './package-info.mjs'
import {
  validateProjectConfigurationSchema,
  validateProjectEvidenceSchema,
  validateProjectReportSchema,
  validateTechnicalReportSchema,
} from './schema-validation.mjs'

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
  if (reference?.id !== catalog.catalogId
    || reference?.version !== catalog.catalogVersion
    || (reference.status !== undefined && reference.status !== catalog.status)) {
    throw new Error(`${label} verwendet nicht ${catalog.catalogId} ${catalog.catalogVersion}.`)
  }
}

function validateProjectConfiguration(config, catalog) {
  validateProjectConfigurationSchema(config)
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
      throw new Error(`Der Basiskatalog enthält das ausgewählte Modul ${module} nicht.`)
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
  validateProjectEvidenceSchema(document)
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
  const reportLabel = 'Technischer Bericht'
  validateTechnicalReportSchema(report, reportLabel)
  const privateTargetsRedacted = report.options.privateTargetsRedacted === true
  const reportedTargetUrl = reportUrl(targetUrl, { hideHosts: privateTargetsRedacted }).url
  const results = technicalReportResults(report)
  if (report?.schemaVersion !== 1 || !results) {
    throw new Error(`Technischer Bericht ${run.reportFile || run.command} verwendet kein unterstütztes Schema.`)
  }
  requireText(report.generatedAt, 'Erstellungszeit des technischen Berichts')
  requireText(report.tool, 'Werkzeugkennung des technischen Berichts')
  requireText(report.toolPackage?.version, 'Werkzeugversion des technischen Berichts')
  validateCatalogReference(report.checklistCoverage?.catalog, catalog, reportLabel)
  const assertionsById = new Map(loadAssertionRegistry().assertions.map(assertion => [assertion.id, assertion]))
  for (const assertion of results.flatMap(result => result.assertions || [])) {
    const registeredAssertion = assertionsById.get(assertion.assertionId)
    if (!registeredAssertion
      || assertion.assertionVersion !== registeredAssertion.version
      || registeredAssertion.tool !== report.tool) {
      throw new Error(`${reportLabel} enthält eine nicht zum Werkzeug passende Assertion.`)
    }
  }
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
      scopedAssertion.tool = report.tool
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

export function createProjectReport({ config, evidenceDocument, generatedAt = new Date().toISOString(), technicalRuns }) {
  const catalog = loadWebsiteCatalog()
  const selectedItemIds = validateProjectConfiguration(config, catalog)
  const evidence = validateEvidenceDocument(evidenceDocument, catalog)
  const runEvaluations = technicalRuns.map(run => validateTechnicalRun(run, config, catalog))
  const usedRuns = runEvaluations.filter(run => run.record.usedForEvaluation)
  const assertions = usedRuns.flatMap(run => run.assertions)
  const evaluated = evaluateChecklist({ assertions, evidence, itemIds: selectedItemIds })
  const statesByItem = new Map((config.itemStates || []).map(state => [state.itemId, state]))
  const warnings = []
  const records = []
  const referencesByRecord = new Map()

  function recordReference(type, record) {
    const safeRecord = redactReportData(structuredClone(record))
    const key = `${type}:${canonicalJson(safeRecord)}`
    let reference = referencesByRecord.get(key)
    if (!reference) {
      reference = `R${String(records.length + 1).padStart(6, '0')}`
      referencesByRecord.set(key, reference)
      records.push({ id: reference, record: safeRecord, type })
    }
    return reference
  }

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
      criteria: item.criteria.map((criterion) => {
        const normalized = {
          evidenceClass: criterion.evidenceClass,
          evidenceInstructions: criterion.evidenceInstructions,
          id: criterion.id,
          mode: criterion.mode,
          outcome: criterion.outcome,
          recordRefs: [...new Set(criterion.records.map(record => recordReference(criterion.mode === 'automatic' ? 'assertion' : 'evidence', record)))],
          statement: criterion.statement,
        }
        if (criterion.mode === 'automatic') {
          const catalogItem = catalog.items.find(entry => entry.id === item.id)
          const catalogCriterion = catalogItem.criteria.find(entry => entry.id === criterion.id)
          normalized.requiredAssertionIds = [...catalogCriterion.verification.assertions]
        }
        return normalized
      }),
      evidenceOutcome: item.outcome,
      id: item.id,
      module: item.module,
      projectStatus,
      statement: item.statement,
      workflow,
    }
  })

  if (Number.isNaN(new Date(generatedAt).valueOf())) {
    throw new TypeError('Erstellungszeit des Projektberichts ist ungültig.')
  }

  const report = redactReportData({
    catalog: evaluated.catalog,
    generatedAt,
    items,
    limitations: [
      'Der stabile Basiskatalog ist bewusst begrenzt und weder vollständige Website-Checkliste noch WCAG-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsfreigabe.',
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
    records,
    schemaVersion: 3,
    scope: {
      selectedItemIds,
      selectedModules: [...config.selectedModules],
    },
    summary: {
      automaticCriteria: normalizedCriterionCounts(evaluated.summary.automaticCriteria),
      checklistItems: {
        ...countProjectStatuses(items),
        total: items.length,
      },
      nonAutomaticCriteria: normalizedCriterionCounts(evaluated.summary.nonAutomaticCriteria),
    },
    technicalRuns: runEvaluations.map(run => run.record),
    warnings,
  })
  validateProjectReport(report)
  return report
}

export function createProjectReportFromFiles(configFile) {
  const absoluteConfigFile = resolve(configFile)
  const baseDirectory = dirname(absoluteConfigFile)
  const config = readJson(absoluteConfigFile)
  validateProjectConfigurationSchema(config)
  const evidenceDocument = config.evidenceFile ? readJson(resolve(baseDirectory, config.evidenceFile)) : undefined
  const technicalRuns = config.technicalRuns.map(run => ({
    ...run,
    report: readJson(resolve(baseDirectory, run.reportFile)),
  }))
  return createProjectReport({ config, evidenceDocument, technicalRuns })
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

function normalizedCriterionCounts(counts) {
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

function requireSameSequence(actual, expected, label) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${label} passt nicht zum Basiskatalog.`)
  }
}

function catalogCriteriaForItem(item, catalogItemsById) {
  const catalogItem = catalogItemsById.get(item.id)
  if (!catalogItem) {
    throw new Error(`Checklistenpunkt ${item.id} ist im Basiskatalog unbekannt.`)
  }
  if (item.module !== catalogItem.module) {
    throw new Error(`Checklistenpunkt ${item.id} verwendet das Modul ${item.module} statt ${catalogItem.module}.`)
  }
  if (item.statement !== catalogItem.statement) {
    throw new Error(`Checklistenpunkt ${item.id} verwendet nicht die Aussage des Basiskatalogs.`)
  }
  requireSameSequence(item.criteria?.map(criterion => criterion.id), catalogItem.criteria.map(criterion => criterion.id), `Kriterienzuordnung für ${item.id}`)
  return catalogItem.criteria
}

function requireObjectShape(value, required, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} ist kein Objekt.`)
  }
  const keys = Object.keys(value).filter(key => value[key] !== undefined)
  const unknown = keys.find(key => !allowed.includes(key))
  if (unknown) {
    throw new Error(`${label} enthält das unbekannte Feld ${unknown}.`)
  }
  const missing = required.find(key => value[key] === undefined)
  if (missing) {
    throw new Error(`${label} enthält das Pflichtfeld ${missing} nicht.`)
  }
}

function requireStringArray(value, label, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0) || value.some(entry => typeof entry !== 'string' || !entry.trim())) {
    throw new TypeError(`${label} ist keine gültige Textliste.`)
  }
}

function requireCountObject(value, keys, label) {
  requireObjectShape(value, keys, keys, label)
  for (const key of keys) {
    if (!Number.isInteger(value[key]) || value[key] < 0) {
      throw new TypeError(`${label}.${key} ist keine nichtnegative Ganzzahl.`)
    }
  }
}

function validateProjectReportStructure(report) {
  const rootKeys = ['schemaVersion', 'generatedAt', 'catalog', 'project', 'provenance', 'scope', 'technicalRuns', 'records', 'items', 'summary', 'warnings', 'limitations']
  requireObjectShape(report, rootKeys, rootKeys, 'Projektbericht')
  if (report.schemaVersion !== 3 || Number.isNaN(new Date(report.generatedAt).valueOf())) {
    throw new Error('Projektbericht verwendet nicht das normalisierte Schema 3.')
  }
  requireObjectShape(report.catalog, ['id', 'version', 'status'], ['id', 'version', 'status'], 'Katalogreferenz')
  requireText(report.catalog.id, 'Katalogkennung')
  requireText(report.catalog.version, 'Katalogversion')
  requireText(report.catalog.status, 'Katalogstatus')
  requireObjectShape(report.project, ['name', 'evaluationEnvironment'], ['name', 'preferredUrl', 'evaluationEnvironment', 'sourceRevision', 'deploymentId'], 'Projekt')
  requireText(report.project.name, 'Projektname')
  requireText(report.project.evaluationEnvironment, 'Auswertungsumgebung')
  for (const key of ['preferredUrl', 'sourceRevision', 'deploymentId']) {
    if (report.project[key] !== undefined) {
      requireText(report.project[key], `Projekt.${key}`)
    }
  }
  requireObjectShape(report.provenance, ['deploymentAndSourceContext', 'targetUrlBinding'], ['deploymentAndSourceContext', 'targetUrlBinding'], 'Provenienz')
  if (report.provenance.deploymentAndSourceContext !== 'projectDeclared'
    || report.provenance.targetUrlBinding !== 'matchedAgainstRedactedTechnicalReport') {
    throw new Error('Projektbericht enthält keine unterstützte Provenienz.')
  }
  requireObjectShape(report.scope, ['selectedModules', 'selectedItemIds'], ['selectedModules', 'selectedItemIds'], 'Katalogumfang')
  requireStringArray(report.scope.selectedModules, 'Ausgewählte Module', { nonEmpty: true })
  requireStringArray(report.scope.selectedItemIds, 'Ausgewählte Checklistenpunkte')
  if (!Array.isArray(report.technicalRuns)) {
    throw new TypeError('Technische Läufe sind keine Liste.')
  }
  for (const run of report.technicalRuns) {
    const required = ['tool', 'toolPackage', 'generatedAt', 'targetUrl', 'environment', 'command', 'contextProvenance', 'assertionCount', 'usedForEvaluation', 'summary']
    const allowed = [...required, 'reportFile', 'sourceRevision', 'deploymentId']
    requireObjectShape(run, required, allowed, 'Technischer Lauf')
    for (const key of ['tool', 'generatedAt', 'targetUrl', 'environment', 'command']) {
      requireText(run[key], `Technischer Lauf.${key}`)
    }
    if (Number.isNaN(new Date(run.generatedAt).valueOf()) || !Number.isInteger(run.assertionCount) || run.assertionCount < 0 || typeof run.usedForEvaluation !== 'boolean') {
      throw new TypeError('Technischer Lauf enthält ungültige Zeit-, Zähler- oder Verwendungsdaten.')
    }
    requireObjectShape(run.toolPackage, ['version'], ['name', 'version'], 'Werkzeugpaket')
    requireText(run.toolPackage.version, 'Werkzeugversion')
    requireObjectShape(run.contextProvenance, ['targetUrl', 'sourceRevision', 'deploymentId'], ['targetUrl', 'sourceRevision', 'deploymentId'], 'Laufprovenienz')
    if (run.contextProvenance.targetUrl !== 'matchedAgainstRedactedTechnicalReport'
      || run.contextProvenance.sourceRevision !== 'projectDeclared'
      || run.contextProvenance.deploymentId !== 'projectDeclared') {
      throw new Error('Technischer Lauf enthält keine unterstützte Provenienz.')
    }
    requireObjectShape(run.summary, [], Object.keys(run.summary), 'Technische Zusammenfassung')
  }
  if (!Array.isArray(report.records) || !Array.isArray(report.items)) {
    throw new TypeError('Records oder Checklistenpunkte sind keine Liste.')
  }
  for (const entry of report.records) {
    requireObjectShape(entry, ['id', 'type', 'record'], ['id', 'type', 'record'], 'Normalisierter Record')
    requireObjectShape(entry.record, [], Object.keys(entry.record), `Record ${entry.id}`)
    if (entry.type === 'assertion') {
      for (const key of ['assertionId', 'message']) {
        requireText(entry.record[key], `Assertion ${entry.id}.${key}`)
      }
      if (!Number.isInteger(entry.record.assertionVersion) || entry.record.assertionVersion < 1
        || !['pass', 'fail', 'inconclusive', 'notApplicable'].includes(entry.record.outcome)
        || !entry.record.subject || typeof entry.record.subject !== 'object' || Array.isArray(entry.record.subject)) {
        throw new TypeError(`Assertion ${entry.id} ist unvollständig.`)
      }
    }
    else if (entry.type === 'evidence') {
      const evidenceKeys = ['criterionId', 'outcome', 'checkedAt', 'checkedBy', 'note', 'reference', 'environment', 'sourceRevision']
      requireObjectShape(entry.record, ['criterionId', 'outcome', 'checkedAt', 'checkedBy', 'note'], evidenceKeys, `Evidence ${entry.id}`)
      for (const key of ['criterionId', 'checkedAt', 'checkedBy', 'note']) {
        requireText(entry.record[key], `Evidence ${entry.id}.${key}`)
      }
      if (!validDate(entry.record.checkedAt) || !['pass', 'fail', 'inconclusive', 'notApplicable'].includes(entry.record.outcome)) {
        throw new TypeError(`Evidence ${entry.id} ist unvollständig.`)
      }
    }
    else {
      throw new Error(`Normalisierter Record ${entry.id} verwendet den unbekannten Typ ${entry.type}.`)
    }
  }
  for (const item of report.items) {
    requireObjectShape(item, ['id', 'module', 'statement', 'evidenceOutcome', 'projectStatus', 'criteria'], ['id', 'module', 'statement', 'evidenceOutcome', 'projectStatus', 'workflow', 'criteria'], `Checklistenpunkt ${item.id || ''}`)
    if (!Array.isArray(item.criteria) || item.criteria.length === 0) {
      throw new TypeError(`Checklistenpunkt ${item.id} enthält keine Kriterien.`)
    }
    if (item.workflow !== undefined) {
      const workflowKeys = ['itemId', 'status', 'recordedAt', 'recordedBy', 'note', 'responsible', 'reviewAt']
      requireObjectShape(item.workflow, ['itemId', 'status', 'recordedAt', 'recordedBy', 'note'], workflowKeys, `Workflow ${item.id}`)
      if (item.workflow.itemId !== item.id) {
        throw new Error(`Workflow für ${item.id} verweist auf einen anderen Checklistenpunkt.`)
      }
      if (['acceptedDeviation', 'deferred', 'external'].includes(item.workflow.status) && !item.workflow.responsible?.trim()) {
        throw new Error(`Workflow für ${item.id} benötigt eine Verantwortlichkeit.`)
      }
      if (['acceptedDeviation', 'deferred'].includes(item.workflow.status) && !validDate(item.workflow.reviewAt)) {
        throw new Error(`Workflow für ${item.id} benötigt eine Wiedervorlage.`)
      }
    }
    for (const criterion of item.criteria) {
      const common = ['id', 'statement', 'mode', 'outcome', 'evidenceClass', 'evidenceInstructions', 'recordRefs']
      const allowed = [...common, 'requiredAssertionIds']
      requireObjectShape(criterion, ['id', 'statement', 'mode', 'outcome', 'recordRefs'], allowed, `Kriterium ${criterion.id || ''}`)
      requireStringArray(criterion.recordRefs, `Recordreferenzen ${criterion.id}`)
      if (criterion.mode === 'automatic') {
        requireStringArray(criterion.requiredAssertionIds, `Erforderliche Assertions ${criterion.id}`, { nonEmpty: true })
      }
      else if (criterion.requiredAssertionIds !== undefined) {
        throw new Error(`Nicht automatisches Kriterium ${criterion.id} nennt unerwartete Assertions.`)
      }
    }
  }
  requireObjectShape(report.summary, ['automaticCriteria', 'nonAutomaticCriteria', 'checklistItems'], ['automaticCriteria', 'nonAutomaticCriteria', 'checklistItems'], 'Zusammenfassung')
  const criterionKeys = ['pass', 'fail', 'inconclusive', 'notApplicable', 'noEvidence', 'total']
  requireCountObject(report.summary.automaticCriteria, criterionKeys, 'Automatische Kriterien')
  requireCountObject(report.summary.nonAutomaticCriteria, criterionKeys, 'Nicht automatische Kriterien')
  requireCountObject(report.summary.checklistItems, [...projectStatusOrder, 'total'], 'Checklistenpunkte')
  requireStringArray(report.warnings, 'Warnungen')
  requireStringArray(report.limitations, 'Grenzen', { nonEmpty: true })
}

function validateReportScopeAgainstCatalog(report, catalog) {
  validateCatalogReference(report.catalog, catalog, 'Projektbericht')
  if (!Array.isArray(report.scope?.selectedModules) || !Array.isArray(report.scope?.selectedItemIds)) {
    throw new TypeError('Projektbericht enthält keinen gültigen Katalogumfang.')
  }
  if (!report.scope.selectedModules.includes('core')) {
    throw new Error('Projektbericht muss das Katalogmodul core auswählen.')
  }
  if (new Set(report.scope.selectedModules).size !== report.scope.selectedModules.length
    || new Set(report.scope.selectedItemIds).size !== report.scope.selectedItemIds.length) {
    throw new Error('Projektbericht enthält mehrfach ausgewählte Scope-Einträge.')
  }
  const knownModules = new Set(catalog.items.map(item => item.module))
  for (const module of report.scope.selectedModules) {
    if (!knownModules.has(module)) {
      throw new Error(`Projektbericht wählt das unbekannte Katalogmodul ${module} aus.`)
    }
  }
  const expectedItemIds = catalog.items
    .filter(item => report.scope.selectedModules.includes(item.module))
    .map(item => item.id)
  requireSameSequence(report.scope.selectedItemIds, expectedItemIds, 'Ausgewählte Checklistenpunkte')
  requireSameSequence(report.items.map(item => item.id), expectedItemIds, 'Berichtete Checklistenpunkte')
}

export function validateProjectReport(report) {
  validateProjectReportSchema(report)
  validateProjectReportStructure(report)
  const catalog = loadWebsiteCatalog()
  const assertionRegistry = loadAssertionRegistry()
  validateReportScopeAgainstCatalog(report, catalog)
  const catalogItemsById = new Map(catalog.items.map(item => [item.id, item]))
  const assertionsById = new Map(assertionRegistry.assertions.map(assertion => [assertion.id, assertion]))
  const usedTechnicalRuns = report.technicalRuns.filter(run => run.usedForEvaluation)
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
    if (entry.type === 'assertion') {
      const registeredAssertion = assertionsById.get(entry.record.assertionId)
      if (!registeredAssertion
        || entry.record.assertionVersion !== registeredAssertion.version
        || entry.record.tool !== registeredAssertion.tool
        || entry.record.subject.tool !== entry.record.tool
        || !usedTechnicalRuns.some(run => run.tool === entry.record.tool
          && run.environment === entry.record.subject.environment
          && run.sourceRevision === entry.record.subject.sourceRevision
          && run.deploymentId === entry.record.subject.deploymentId)) {
        throw new Error(`Normalisierter Record ${entry.id} verwendet keine passende registrierte Werkzeug-Assertion.`)
      }
    }
    canonicalRecords.add(canonical)
    recordsById.set(entry.id, entry)
  }

  const referencedRecords = new Set()
  for (const item of report.items) {
    const catalogCriteria = catalogCriteriaForItem(item, catalogItemsById)
    for (const [criterionIndex, criterion] of item.criteria.entries()) {
      const catalogCriterion = catalogCriteria[criterionIndex]
      if (criterion.mode !== catalogCriterion.verification.mode) {
        throw new Error(`Kriterium ${criterion.id} verwendet nicht den Katalogmodus ${catalogCriterion.verification.mode}.`)
      }
      if (criterion.statement !== catalogCriterion.statement
        || criterion.evidenceClass !== catalogCriterion.verification.evidenceClass
        || criterion.evidenceInstructions !== catalogCriterion.verification.instructions) {
        throw new Error(`Kriterium ${criterion.id} verwendet nicht die Nachweisdefinition des Basiskatalogs.`)
      }
      if (criterion.mode === 'automatic') {
        requireSameSequence(criterion.requiredAssertionIds, catalogCriterion.verification.assertions, `Erforderliche Assertions für ${criterion.id}`)
      }
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

function escapeMarkdownText(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('`', '\\`')
    .replaceAll('*', '\\*')
    .replaceAll('_', '\\_')
    .replaceAll('~', '\\~')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
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

export function renderProjectReportMarkdown(report) {
  validateProjectReport(report)
  const recordsById = new Map(report.records.map(entry => [entry.id, entry]))
  const lines = [
    `# Website-QA-Prüfbericht: ${escapeMarkdownText(report.project.name)}`,
    '',
    '> Bericht auf Basis des bewusst begrenzten stabilen Basiskatalogs. Er ist weder vollständige Website-Checkliste noch WCAG-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsfreigabe.',
    '',
    '## Berichtsstand',
    '',
    '| Feld | Wert |',
    '|---|---|',
    `| Erstellt | ${escapeMarkdownText(report.generatedAt)} |`,
    `| Katalog | ${escapeMarkdownText(report.catalog.id)} ${escapeMarkdownText(report.catalog.version)} (${escapeMarkdownText(report.catalog.status)}) |`,
    `| Auswertungsumgebung | ${escapeMarkdownText(report.project.evaluationEnvironment)} |`,
    `| Bevorzugte URL | ${escapeMarkdownText(report.project.preferredUrl || 'nicht angegeben')} |`,
    `| Quellstand | ${escapeMarkdownText(report.project.sourceRevision || 'nicht angegeben')} |`,
    `| Deployment | ${escapeMarkdownText(report.project.deploymentId || 'nicht angegeben')} |`,
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
  lines.push(`| **Ausgewählte Basiskatalogpunkte** | **${report.summary.checklistItems.total}** |`)
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
    lines.push(`| ${escapeMarkdownText(run.tool)} ${escapeMarkdownText(run.toolPackage?.version || '')} | ${escapeMarkdownText(run.targetUrl)} | ${escapeMarkdownText(run.environment)} | ${run.usedForEvaluation ? 'ja' : 'nein'} | ${run.assertionCount} | <code>${escapeMarkdownText(run.command)}</code> |`)
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
    lines.push(`| ${item.id} | ${escapeMarkdownText(item.module)} | ${statusLabel(item.projectStatus)} | ${resolvedCriterionCount(automatic)}/${automatic.length} | ${resolvedCriterionCount(nonAutomatic)}/${nonAutomatic.length} |`)
  }

  for (const item of report.items) {
    lines.push('', `### ${item.id}: ${statusLabel(item.projectStatus)}`, '', item.statement, '')
    if (item.workflow) {
      lines.push(`Workflow: **${statusLabel(item.workflow.status)}** – ${escapeMarkdownText(item.workflow.note)}`, '')
    }
    for (const criterion of item.criteria) {
      const checked = ['notApplicable', 'pass'].includes(criterion.outcome)
      lines.push(`- [${checked ? 'x' : ' '}] \`${criterion.id}\` ${criterion.statement} — ${criterion.mode}, ${criterion.outcome}`)
      if (!checked && criterion.evidenceInstructions) {
        lines.push(`  - Erforderlicher Nachweis: ${criterion.evidenceInstructions}`)
      }
      if (criterion.mode === 'automatic' && ['fail', 'inconclusive'].includes(criterion.outcome)) {
        for (const reference of criterion.recordRefs) {
          const entry = recordsById.get(reference)
          if (entry?.type === 'assertion' && ['fail', 'inconclusive'].includes(entry.record.outcome)) {
            lines.push(`  - Ursache [${reference}]: ${escapeMarkdownText(redactText(entry.record.message, 240))}`)
          }
        }
      }
    }
  }

  if (report.warnings.length > 0) {
    lines.push('', '## Warnungen', '', ...report.warnings.map(warning => `- ${escapeMarkdownText(warning)}`))
  }
  lines.push('', '## Grenzen', '', ...report.limitations.map(limitation => `- ${escapeMarkdownText(limitation)}`), '')
  return lines.join('\n')
}

function publicLabelText(value) {
  return escapeMarkdownText(redactText(value, 200))
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

export function renderProjectSummaryMarkdown(report, options = {}) {
  validateProjectReport(report)
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
    `| Erstellt | ${escapeMarkdownText(report.generatedAt)} |`,
    `| Katalog | ${escapeMarkdownText(report.catalog.id)} ${escapeMarkdownText(report.catalog.version)} (${escapeMarkdownText(report.catalog.status)}) |`,
  ]

  if (publicUrl) {
    lines.push(`| Öffentlich freigegebene URL | ${escapeMarkdownText(publicUrl)} |`)
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
    `| **Ausgewählte Basiskatalogpunkte** | **${report.summary.checklistItems.total}** |`,
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
    lines.push(`| ${escapeMarkdownText(run.tool)} | ${escapeMarkdownText(run.toolPackage?.version || 'nicht angegeben')} | ${run.usedForEvaluation ? 'ja' : 'nein'} | ${run.assertionCount} |`)
  }
  if (report.technicalRuns.length === 0) {
    lines.push('| – | – | nein | 0 |')
  }

  const unfinishedItems = report.items.filter(item => !['complete', 'notApplicable'].includes(item.projectStatus))
  lines.push(
    '',
    '## Noch nicht vollständig nachgewiesene Basiskatalogpunkte',
    '',
    '| ID | Status | Allgemeine Aussage |',
    '|---|---|---|',
  )
  for (const item of unfinishedItems) {
    lines.push(`| ${item.id} | ${statusLabel(item.projectStatus)} | ${escapeMarkdownText(item.statement)} |`)
  }
  if (unfinishedItems.length === 0) {
    lines.push('| – | Keine offenen Basiskatalogpunkte | – |')
  }

  lines.push(
    '',
    '## Grenzen',
    '',
    '- Der stabile Basiskatalog ist bewusst begrenzt und weder vollständige Website-Checkliste noch WCAG-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsfreigabe.',
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

export function writeProjectReportBundle({
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
  validateProjectConfigurationSchema(config)
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
    const report = createProjectReport({
      config,
      evidenceDocument,
      generatedAt,
      technicalRuns: archivedRuns,
    })
    const reportJsonFile = join(temporaryBundleDirectory, 'report.json')
    const reportMarkdownFile = join(temporaryBundleDirectory, 'report.md')
    writeFileSync(reportJsonFile, jsonWithNewline(report), { encoding: 'utf8', mode: 0o600 })
    writeFileSync(reportMarkdownFile, renderProjectReportMarkdown(report), { encoding: 'utf8', mode: 0o600 })

    const summary = renderProjectSummaryMarkdown(report, { publicProject })
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
