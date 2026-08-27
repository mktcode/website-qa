export function aggregateEvidenceOutcomes(outcomes) {
  if (outcomes.every(outcome => outcome === 'noEvidence')) {
    return 'noEvidence'
  }
  if (outcomes.includes('fail')) {
    return 'fail'
  }
  if (outcomes.includes('inconclusive') || outcomes.includes('noEvidence')) {
    return 'inconclusive'
  }
  if (outcomes.every(outcome => outcome === 'notApplicable')) {
    return 'notApplicable'
  }
  if (outcomes.every(outcome => ['notApplicable', 'pass'].includes(outcome))) {
    return 'pass'
  }
  return 'inconclusive'
}

export function aggregateItemOutcome(criteria) {
  const outcomes = criteria.map(criterion => criterion.outcome)
  if (outcomes.includes('fail')) {
    return 'fail'
  }
  if (outcomes.every(outcome => outcome === 'notApplicable')) {
    return 'notApplicable'
  }
  if (outcomes.every(outcome => ['notApplicable', 'pass'].includes(outcome))) {
    return 'pass'
  }
  if (outcomes.some(outcome => ['notApplicable', 'pass'].includes(outcome))) {
    return 'partial'
  }
  if (outcomes.includes('inconclusive')) {
    return 'inconclusive'
  }
  return 'open'
}
