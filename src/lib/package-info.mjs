import { readFileSync, realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

export const packageName = packageJson.name
export const packageVersion = packageJson.version

export function isMainModule(metaUrl) {
  if (!process.argv[1]) {
    return false
  }
  return metaUrl === pathToFileURL(realpathSync(process.argv[1])).href
}
