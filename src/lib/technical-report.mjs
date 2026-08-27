import { packageName, packageVersion } from './package-info.mjs'

export function jsonOutputIntent(argv) {
  const jsonFileArgument = argv.find(argument => argument.startsWith('--json-file='))
  const jsonFile = jsonFileArgument?.slice('--json-file='.length) || undefined
  return {
    json: argv.includes('--json') || Boolean(jsonFileArgument),
    jsonFile,
  }
}

export function technicalErrorReport(tool, error) {
  return {
    error,
    schemaVersion: 2,
    tool,
    toolPackage: { name: packageName, version: packageVersion },
  }
}
