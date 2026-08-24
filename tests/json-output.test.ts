import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeJsonOutput } from '../src/lib/json-output.mjs'

const temporaryDirectories = new Set<string>()

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { force: true, recursive: true })
  }
  temporaryDirectories.clear()
})

describe('json file output', () => {
  it('creates parent directories and replaces a previous local report', () => {
    const directory = mkdtempSync(join(tmpdir(), 'website-qa-json-'))
    temporaryDirectories.add(directory)
    const file = join(directory, '.website-qa/current/http.json')

    writeJsonOutput(file, { run: 1 })
    writeJsonOutput(file, { run: 2 })

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ run: 2 })
    expect(readFileSync(file, 'utf8')).toBe('{\n  "run": 2\n}\n')
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })
})
