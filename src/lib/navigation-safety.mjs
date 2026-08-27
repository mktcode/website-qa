/* eslint-disable style/max-statements-per-line */

const potentiallyMutatingPathSegments = [
  'abmelden',
  'activate',
  'bestätigen',
  'bestaetigen',
  'cancel',
  'checkout',
  'confirm',
  'deactivate',
  'delete',
  'destroy',
  'kündigen',
  'kuendigen',
  'löschen',
  'loeschen',
  'logout',
  'order',
  'purchase',
  'remove',
  'reset',
  'revoke',
  'sign-out',
  'signout',
  'stornieren',
  'unsubscribe',
  'widerrufen',
]
const sensitiveNavigationParameters = new Set([
  'action',
  'auth',
  'code',
  'confirm',
  'delete',
  'remove',
  'token',
  'unsubscribe',
])

function decodeSafely(value) {
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

export function readOnlyNavigationConcern(url) {
  const pathSegments = url.pathname.split('/').filter(Boolean).map(segment => decodeSafely(segment).toLowerCase())
  const pathConcern = pathSegments.find(segment => potentiallyMutatingPathSegments
    .some(keyword => segment === keyword || segment.startsWith(`${keyword}-`) || segment.startsWith(`${keyword}_`)))
  if (pathConcern) { return `verdächtiges Pfadsegment ${pathConcern}` }
  const parameterConcern = [...url.searchParams.keys()].find(name => sensitiveNavigationParameters.has(name.toLowerCase()))
  if (parameterConcern) { return `potenziell zustandsverändernder Query-Parameter ${parameterConcern}` }
  return undefined
}
