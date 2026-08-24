#!/usr/bin/env node

import { writePilotProjectReportBundle } from '@mktcode/website-qa/report'

const configFile = process.argv[2] || './website-qa.project.json'
const result = writePilotProjectReportBundle({ configFile })

console.info(`Vollständiger lokaler Bericht: ${result.bundleDirectory}`)
console.info(`Versionierbare Zusammenfassung: ${result.summaryFile}`)
