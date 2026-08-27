/* eslint-disable style/max-statements-per-line */

import { readFileSync } from 'node:fs'

const checklistIndexUrl = new URL('../../catalog/checklist-index.json', import.meta.url)
const signalRegistryUrl = new URL('../../catalog/signals.json', import.meta.url)
const statusMap = {
  fail: 'defect',
  inconclusive: 'inconclusive',
  notApplicable: 'notApplicable',
  pass: 'positive',
}

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'))
}

const checklistIndex = readJson(checklistIndexUrl)
const signalRegistry = readJson(signalRegistryUrl)

function duplicate(values) {
  const seen = new Set()
  return values.find((value) => {
    if (seen.has(value)) { return true }
    seen.add(value)
    return false
  })
}

export function validateSignalCatalog(index = checklistIndex, registry = signalRegistry) {
  if (index.schemaVersion !== 1 || index.status !== 'stable' || !Array.isArray(index.items)) {
    throw new TypeError('Checklistenindex verwendet kein unterstütztes Schema.')
  }
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.signals)) {
    throw new TypeError('Signalregister verwendet kein unterstütztes Schema.')
  }
  const checklistRefs = index.items.map(item => item.id)
  const duplicateChecklistId = duplicate(checklistRefs)
  if (duplicateChecklistId) { throw new TypeError(`Checklisten-ID ist mehrfach vergeben: ${duplicateChecklistId}`) }
  const knownChecklistIds = new Set(checklistRefs)
  const signalIds = registry.signals.map(signal => signal.id)
  const duplicateSignalId = duplicate(signalIds)
  if (duplicateSignalId) { throw new TypeError(`Signal-ID ist mehrfach vergeben: ${duplicateSignalId}`) }
  for (const signal of registry.signals) {
    if (!signal.id || !signal.description || !signal.tool || !Number.isInteger(signal.version) || signal.version < 1) {
      throw new TypeError(`Signal ${signal.id || '(ohne ID)'} ist unvollständig.`)
    }
    if (!Array.isArray(signal.checklistRefs) || new Set(signal.checklistRefs).size !== signal.checklistRefs.length) {
      throw new TypeError(`Signal ${signal.id} besitzt ungültige Checklistenreferenzen.`)
    }
    for (const reference of signal.checklistRefs) {
      if (!knownChecklistIds.has(reference)) { throw new TypeError(`Signal ${signal.id} verweist auf die unbekannte Checklisten-ID ${reference}.`) }
    }
  }
  return true
}

export function technicalSignals(records, tool) {
  const definitions = new Map(signalRegistry.signals.map(signal => [signal.id, signal]))
  return records.map((record) => {
    const definition = definitions.get(record.assertionId)
    if (!definition || definition.tool !== tool || definition.version !== record.assertionVersion) {
      throw new TypeError(`Technisches Signal ${record.assertionId} ist für ${tool} nicht registriert.`)
    }
    const status = statusMap[record.outcome]
    if (!status) { throw new TypeError(`Technisches Signal ${record.assertionId} verwendet ein unbekanntes Ergebnis.`) }
    return {
      checklistRefs: definition.checklistRefs,
      id: record.assertionId,
      message: record.message,
      signalVersion: record.assertionVersion,
      status,
      subject: record.subject,
    }
  })
}

export function technicalSignalSummary(signals) {
  const summary = Object.fromEntries(['positive', 'defect', 'inconclusive', 'notApplicable']
    .map(status => [status, signals.filter(signal => signal.status === status).length]))
  return { ...summary, total: signals.length }
}

export function checklistReference() {
  return {
    id: checklistIndex.checklistId,
    version: checklistIndex.checklistVersion,
  }
}

export function loadChecklistIndex() {
  return structuredClone(checklistIndex)
}

export function loadSignalRegistry() {
  return structuredClone(signalRegistry)
}

validateSignalCatalog()
