/* eslint-disable style/max-statements-per-line */

import { existsSync } from 'node:fs'
import { readOnlyNavigationConcern } from './navigation-safety.mjs'

export function chromiumExecutable(configuredPath) {
  const candidates = [
    configuredPath,
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean)
  const executable = candidates.find(candidate => existsSync(candidate))
  if (!executable) { throw new TypeError('Keine Chromium-/Chrome-Binärdatei gefunden. --chromium-path oder CHROMIUM_PATH setzen.') }
  return executable
}

function comparableUrl(value) {
  const url = new URL(value)
  url.hash = ''
  return url.href
}

export function classifyBrowserRequest(details, policy) {
  if (!['http:', 'https:'].includes(details.protocol)) { return { action: 'allow' } }
  if (details.method !== 'GET') {
    return { action: 'block', code: 'non-get-blocked', reason: `Browser versuchte eine blockierte ${details.method}-Anfrage.`, severity: 'error' }
  }
  if (details.origin !== policy.origin) {
    return { action: 'block', code: 'external-request-blocked', reason: `Externer Browser-Request zu ${details.origin} wurde blockiert.`, severity: 'warning' }
  }
  const concern = readOnlyNavigationConcern(new URL(details.url))
  if (concern) {
    return { action: 'block', code: 'suspicious-get-blocked', reason: `GET-Anfrage wurde wegen ${concern} vorsorglich blockiert.`, severity: 'warning' }
  }
  if (details.mainFrameNavigation && comparableUrl(details.url) !== comparableUrl(policy.expectedUrl)) {
    return { action: 'block', code: 'unexpected-navigation-blocked', reason: 'Unerwartete Hauptfenster-Navigation wurde blockiert.', severity: 'warning' }
  }
  if (details.requestNumber > policy.maxRequests) {
    return { action: 'block', code: 'request-limit', reason: `Request-Limit von ${policy.maxRequests} je Lauf erreicht.`, severity: 'warning' }
  }
  return { action: 'allow' }
}

export async function installReadOnlyDomGuards(page, onBlockedAction, functionName = 'websiteQaRecordBlockedAction') {
  await page.exposeFunction(functionName, (kind, value) => onBlockedAction(String(kind), String(value || '')))
  await page.evaluateOnNewDocument((recorderName) => {
    const record = (kind, value) => {
      void globalThis[recorderName](kind, String(value || location.href))
    }
    globalThis.open = (target) => {
      record('popup', target)
      return null
    }
    navigator.sendBeacon = (target) => {
      record('beacon', target)
      return false
    }
    globalThis.WebSocket = function BlockedWebSocket(target) {
      record('websocket', target)
      throw new DOMException('WebSocket durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
    }
    globalThis.EventSource = function BlockedEventSource(target) {
      record('eventsource', target)
      throw new DOMException('EventSource durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
    }
    globalThis.Worker = function BlockedWorker(target) {
      record('worker', target)
      throw new DOMException('Worker durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
    }
    globalThis.SharedWorker = function BlockedSharedWorker(target) {
      record('shared-worker', target)
      throw new DOMException('SharedWorker durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
    }
    const serviceWorkerPrototype = globalThis.ServiceWorkerContainer?.prototype
    if (serviceWorkerPrototype) {
      Object.defineProperty(serviceWorkerPrototype, 'register', {
        configurable: false,
        value(scriptUrl) {
          record('service-worker', scriptUrl)
          return Promise.reject(new DOMException('ServiceWorker durch Nur-Lese-Prüfung blockiert.', 'SecurityError'))
        },
        writable: false,
      })
    }
    globalThis.RTCPeerConnection = function BlockedRtcPeerConnection() {
      record('webrtc', location.href)
      throw new DOMException('WebRTC durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
    }
    globalThis.webkitRTCPeerConnection = globalThis.RTCPeerConnection
    globalThis.WebTransport = function BlockedWebTransport(target) {
      record('webtransport', target)
      throw new DOMException('WebTransport durch Nur-Lese-Prüfung blockiert.', 'SecurityError')
    }
    const blockForm = form => record('form-submit', form.action || location.href)
    HTMLFormElement.prototype.submit = function submit() {
      blockForm(this)
    }
    HTMLFormElement.prototype.requestSubmit = function requestSubmit() {
      blockForm(this)
    }
    document.addEventListener('submit', (event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      blockForm(event.target)
    }, true)
    document.addEventListener('click', (event) => {
      const anchor = event.target?.closest?.('a[href]')
      if (anchor?.target && anchor.target.toLowerCase() !== '_self') {
        event.preventDefault()
        event.stopImmediatePropagation()
        record('popup', anchor.href)
      }
    }, true)
  }, functionName)
}
