import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'

const catalogDirectory = join(import.meta.dirname, '..', 'catalog')

function json(name: string) {
  return JSON.parse(readFileSync(join(catalogDirectory, name), 'utf8'))
}

function validate(schemaName: string, documentName: string) {
  const ajv = new Ajv2020.Ajv2020({ allErrors: true, strict: true })
  addFormats.default(ajv)
  const validator = ajv.compile(json(schemaName))
  const valid = validator(json(documentName))
  expect(valid, JSON.stringify(validator.errors, null, 2)).toBe(true)
}

describe('catalog schemas', () => {
  it('validate the pilot catalog, evidence and project configuration examples', () => {
    validate('website-catalog.schema.json', 'website-pilot.json')
    validate('project-evidence.schema.json', 'project-evidence.example.json')
    validate('project-report.schema.json', 'project-report.example.json')
  })
})
