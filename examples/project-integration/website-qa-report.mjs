#!/usr/bin/env node

import { writeProjectReportBundle } from '@mktcode/website-qa/report'

const configFile = process.argv[2] || './website-qa.project.json'
const result = writeProjectReportBundle({ configFile })

console.info(`Vollständiger lokaler Bericht: ${result.bundleDirectory}`)
console.info(`Versionierbare Zusammenfassung: ${result.summaryFile}`)
