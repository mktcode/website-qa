import { readFileSync } from 'node:fs'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'

const catalogUrl = new URL('../../catalog/', import.meta.url)

function readSchema(name) {
  return JSON.parse(readFileSync(new URL(name, catalogUrl), 'utf8'))
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
ajv.addSchema(readSchema('technical-report.common.schema.json'))

const projectConfigurationValidator = ajv.compile(readSchema('project-report.config.schema.json'))
const projectEvidenceValidator = ajv.compile(readSchema('project-evidence.schema.json'))
const projectReportValidator = ajv.compile(readSchema('project-report.schema.json'))
const technicalReportValidators = new Map([
  ['http-check', ajv.compile(readSchema('http-report.schema.json'))],
  ['crawl-check', ajv.compile(readSchema('crawl-report.schema.json'))],
  ['browser-check', ajv.compile(readSchema('browser-report.schema.json'))],
  ['social-preview-check', ajv.compile(readSchema('social-report.schema.json'))],
])

function requireSchema(validator, value, label) {
  if (!validator(value)) {
    throw new Error(`${label} entspricht nicht dem veröffentlichten JSON-Schema.`)
  }
}

export function validateProjectConfigurationSchema(config) {
  requireSchema(projectConfigurationValidator, config, 'Projektberichtskonfiguration')
}

export function validateProjectEvidenceSchema(evidence) {
  requireSchema(projectEvidenceValidator, evidence, 'Projektnachweisdatei')
}

export function validateProjectReportSchema(report) {
  requireSchema(projectReportValidator, report, 'Projektbericht')
}

export function validateTechnicalReportSchema(report, label) {
  const validator = technicalReportValidators.get(report?.tool)
  if (!validator) {
    throw new TypeError(`${label} verwendet ein unbekanntes Werkzeug.`)
  }
  requireSchema(validator, report, label)
  if (typeof report.error === 'string') {
    throw new TypeError(`${label} ist eine Fehlerhülle und kein vollständiger technischer Bericht.`)
  }
}
