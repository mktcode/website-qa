import { closeSync, mkdirSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export function writeJsonOutput(file, value) {
  if (typeof file !== 'string' || !file.trim()) {
    throw new TypeError('JSON-Ausgabepfad fehlt.')
  }

  const destination = resolve(file)
  const directory = dirname(destination)
  mkdirSync(directory, { recursive: true })
  const temporaryFile = `${destination}.${process.pid}.${Date.now()}.tmp`
  let descriptor

  try {
    descriptor = openSync(temporaryFile, 'wx', 0o600)
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    closeSync(descriptor)
    descriptor = undefined
    renameSync(temporaryFile, destination)
  }
  catch (error) {
    if (descriptor !== undefined) {
      closeSync(descriptor)
    }
    rmSync(temporaryFile, { force: true })
    throw new Error('JSON-Bericht konnte nicht geschrieben werden.', { cause: error })
  }

  return destination
}
