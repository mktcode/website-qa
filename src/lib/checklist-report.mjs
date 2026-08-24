import { readFileSync } from 'node:fs'

const catalogUrl = new URL('../../catalog/website-pilot.json', import.meta.url)
const assertionRegistryUrl = new URL('../../catalog/assertions.json', import.meta.url)
const allowedAssertionOutcomes = new Set(['fail', 'inconclusive', 'notApplicable', 'pass'])
const allowedEvidenceModes = new Set(['automatic', 'external', 'manual'])

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'))
}

const pilotCatalog = readJson(catalogUrl)
const assertionRegistry = readJson(assertionRegistryUrl)

function duplicate(values) {
  const seen = new Set()
  return values.find((value) => {
    if (seen.has(value)) {
      return true
    }
    seen.add(value)
    return false
  })
}

export function validateChecklistCatalog(catalog = pilotCatalog, registry = assertionRegistry) {
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.items)) {
    throw new Error('Prüfkatalog verwendet kein unterstütztes Schema.')
  }
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.assertions)) {
    throw new Error('Assertion-Register verwendet kein unterstütztes Schema.')
  }

  const assertionIds = registry.assertions.map(assertion => assertion.id)
  const duplicateAssertion = duplicate(assertionIds)
  if (duplicateAssertion) {
    throw new Error(`Assertion-ID ist mehrfach vergeben: ${duplicateAssertion}`)
  }
  const registeredAssertions = new Set(assertionIds)
  const itemIds = catalog.items.map(item => item.id)
  const duplicateItem = duplicate(itemIds)
  if (duplicateItem) {
    throw new Error(`Checklisten-ID ist mehrfach vergeben: ${duplicateItem}`)
  }

  const criterionIds = []
  for (const item of catalog.items) {
    if (!item.id || !item.statement || !Array.isArray(item.criteria) || item.criteria.length === 0) {
      throw new Error(`Checklistenpunkt ${item.id || '(ohne ID)'} ist unvollständig.`)
    }
    for (const criterion of item.criteria) {
      criterionIds.push(criterion.id)
      if (!criterion.id.startsWith(`${item.id}/C`)) {
        throw new Error(`Kriterium ${criterion.id} gehört nicht zu ${item.id}.`)
      }
      const verification = criterion.verification || {}
      if (!allowedEvidenceModes.has(verification.mode)) {
        throw new Error(`Kriterium ${criterion.id} verwendet einen unbekannten Nachweismodus.`)
      }
      if (verification.mode === 'automatic') {
        if (!Array.isArray(verification.assertions) || verification.assertions.length === 0) {
          throw new Error(`Automatisches Kriterium ${criterion.id} besitzt keine Assertions.`)
        }
        for (const assertionId of verification.assertions) {
          if (!registeredAssertions.has(assertionId)) {
            throw new Error(`Kriterium ${criterion.id} verweist auf die unbekannte Assertion ${assertionId}.`)
          }
        }
      }
      else if (!verification.evidenceClass || !verification.instructions) {
        throw new Error(`Nicht automatisches Kriterium ${criterion.id} beschreibt den erforderlichen Nachweis nicht vollständig.`)
      }
    }
  }

  const duplicateCriterion = duplicate(criterionIds)
  if (duplicateCriterion) {
    throw new Error(`Kriteriums-ID ist mehrfach vergeben: ${duplicateCriterion}`)
  }
  return true
}

function aggregateOutcomes(outcomes) {
  if (outcomes.every(outcome => outcome === 'noEvidence')) {
    return 'noEvidence'
  }
  if (outcomes.includes('fail')) {
    return 'fail'
  }
  if (outcomes.includes('inconclusive') || outcomes.includes('noEvidence')) {
    return 'inconclusive'
  }
  if (outcomes.every(outcome => outcome === 'notApplicable')) {
    return 'notApplicable'
  }
  if (outcomes.every(outcome => ['notApplicable', 'pass'].includes(outcome))) {
    return 'pass'
  }
  return 'inconclusive'
}

function evaluateAutomaticCriterion(criterion, assertions) {
  const outcomes = []
  const matchedAssertions = []

  for (const assertionId of criterion.verification.assertions) {
    const matching = assertions.filter(assertion => assertion.assertionId === assertionId)
    matchedAssertions.push(...matching)
    outcomes.push(aggregateOutcomes(matching.map(assertion => assertion.outcome)))
  }

  return {
    matchedAssertions,
    outcome: aggregateOutcomes(outcomes),
  }
}

function evaluateRecordedCriterion(criterion, evidence) {
  const matching = evidence.filter(entry => entry.criterionId === criterion.id)
  return {
    evidence: matching,
    outcome: aggregateOutcomes(matching.map(entry => entry.outcome)),
  }
}

function itemOutcome(criteria) {
  const outcomes = criteria.map(criterion => criterion.outcome)
  if (outcomes.includes('fail')) {
    return 'fail'
  }
  if (outcomes.every(outcome => outcome === 'notApplicable')) {
    return 'notApplicable'
  }
  if (outcomes.every(outcome => ['notApplicable', 'pass'].includes(outcome))) {
    return 'pass'
  }
  if (outcomes.some(outcome => ['notApplicable', 'pass'].includes(outcome))) {
    return 'partial'
  }
  if (outcomes.includes('inconclusive')) {
    return 'inconclusive'
  }
  return 'open'
}

function countOutcomes(entries) {
  return Object.fromEntries(['pass', 'fail', 'partial', 'open', 'inconclusive', 'notApplicable', 'noEvidence']
    .map(outcome => [outcome, entries.filter(entry => entry.outcome === outcome).length]))
}

export function checklistItemIdsForTool(tool, catalog = pilotCatalog, registry = assertionRegistry) {
  const toolAssertions = new Set(registry.assertions
    .filter(assertion => assertion.tool === tool)
    .map(assertion => assertion.id))

  return catalog.items
    .filter(item => item.criteria.some(criterion => criterion.verification.mode === 'automatic'
      && criterion.verification.assertions.some(assertionId => toolAssertions.has(assertionId))))
    .map(item => item.id)
}

export function evaluateChecklist(catalog, registry, options = {}) {
  validateChecklistCatalog(catalog, registry)
  const assertions = options.assertions || []
  const evidence = options.evidence || []
  const selectedItemIds = options.itemIds ? new Set(options.itemIds) : undefined
  const assertionsById = new Map(registry.assertions.map(assertion => [assertion.id, assertion]))
  const criteriaById = new Map(catalog.items.flatMap(item => item.criteria).map(criterion => [criterion.id, criterion]))

  for (const assertion of assertions) {
    const registered = assertionsById.get(assertion.assertionId)
    if (!registered) {
      throw new Error(`Bericht enthält die unbekannte Assertion ${assertion.assertionId}.`)
    }
    if (assertion.assertionVersion !== registered.version) {
      throw new Error(`Assertion ${assertion.assertionId} verwendet Version ${assertion.assertionVersion} statt ${registered.version}.`)
    }
    if (!allowedAssertionOutcomes.has(assertion.outcome)) {
      throw new Error(`Assertion ${assertion.assertionId} verwendet das unbekannte Ergebnis ${assertion.outcome}.`)
    }
  }
  for (const entry of evidence) {
    const criterion = criteriaById.get(entry.criterionId)
    if (!criterion || criterion.verification.mode === 'automatic') {
      throw new Error(`Manueller oder externer Nachweis verweist auf das ungeeignete Kriterium ${entry.criterionId}.`)
    }
    if (!allowedAssertionOutcomes.has(entry.outcome)) {
      throw new Error(`Nachweis ${entry.criterionId} verwendet das unbekannte Ergebnis ${entry.outcome}.`)
    }
    const parsedDate = new Date(`${entry.checkedAt}T00:00:00Z`)
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(entry.checkedAt || '')
      && !Number.isNaN(parsedDate.valueOf())
      && parsedDate.toISOString().slice(0, 10) === entry.checkedAt
    if (!validDate || !entry.checkedBy?.trim() || !entry.note?.trim()) {
      throw new Error(`Nachweis ${entry.criterionId} benötigt ein gültiges Datum, prüfende beziehungsweise bestätigende Stelle und Notiz.`)
    }
  }

  const items = catalog.items
    .filter(item => !selectedItemIds || selectedItemIds.has(item.id))
    .map((item) => {
      const criteria = item.criteria.map((criterion) => {
        const evaluation = criterion.verification.mode === 'automatic'
          ? evaluateAutomaticCriterion(criterion, assertions)
          : evaluateRecordedCriterion(criterion, evidence)
        return {
          evidenceClass: criterion.verification.evidenceClass,
          evidenceInstructions: criterion.verification.instructions,
          id: criterion.id,
          mode: criterion.verification.mode,
          outcome: evaluation.outcome,
          records: evaluation.matchedAssertions || evaluation.evidence,
          statement: criterion.statement,
        }
      })
      return {
        criteria,
        id: item.id,
        module: item.module,
        outcome: itemOutcome(criteria),
        statement: item.statement,
      }
    })

  const criteria = items.flatMap(item => item.criteria)
  const automaticCriteria = criteria.filter(criterion => criterion.mode === 'automatic')
  const nonAutomaticCriteria = criteria.filter(criterion => criterion.mode !== 'automatic')
  return {
    catalog: {
      id: catalog.catalogId,
      status: catalog.status,
      version: catalog.catalogVersion,
    },
    items,
    summary: {
      automaticCriteria: {
        ...countOutcomes(automaticCriteria),
        total: automaticCriteria.length,
      },
      checklistItems: {
        ...countOutcomes(items),
        automaticallyPassed: items.filter(item => item.outcome === 'pass' && item.criteria.every(criterion => criterion.mode === 'automatic')).length,
        total: items.length,
      },
      nonAutomaticCriteria: {
        ...countOutcomes(nonAutomaticCriteria),
        total: nonAutomaticCriteria.length,
      },
    },
  }
}

export function evaluatePilotChecklist(options = {}) {
  return evaluateChecklist(pilotCatalog, assertionRegistry, options)
}

export function loadAssertionRegistry() {
  return structuredClone(assertionRegistry)
}

export function loadPilotCatalog() {
  return structuredClone(pilotCatalog)
}

validateChecklistCatalog()
