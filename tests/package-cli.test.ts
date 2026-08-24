import { spawnSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories = new Set<string>()

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { force: true, recursive: true })
  }
  temporaryDirectories.clear()
})

describe('installed package commands', () => {
  it('run through package-manager-style symbolic links', () => {
    const directory = mkdtempSync(join(tmpdir(), 'website-qa-bin-'))
    temporaryDirectories.add(directory)
    const commands = [
      ['website-qa-browser', 'src/check-browser.mjs'],
      ['website-qa-crawl', 'src/check-crawl.mjs'],
      ['website-qa-http', 'src/check-http.mjs'],
      ['website-qa-social', 'src/check-social-preview.mjs'],
    ]

    for (const [command, source] of commands) {
      const link = join(directory, command)
      symlinkSync(resolve(source), link)
      const execution = spawnSync(process.execPath, [link, '--help'], { encoding: 'utf8' })

      expect(execution.status).toBe(0)
      expect(execution.stderr).toBe('')
      expect(execution.stdout).toContain(`website-qa-${command.split('-').at(-1)}`)
      expect(realpathSync(link)).toBe(resolve(source))
    }
  })
})
