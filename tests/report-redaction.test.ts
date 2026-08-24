import { describe, expect, it } from 'vitest'
import { redactReportData, redactText, reportUrl, validateUrl } from '../src/lib/http-client.mjs'

describe('report redaction', () => {
  it('removes credentials, query values and fragments from reported URLs', () => {
    expect(reportUrl('https://user:password@example.com/path?token=secret&email=person%40example.com#section')).toEqual({
      parameterNames: ['token', 'email'],
      url: 'https://example.com/path',
    })
  })

  it('does not repeat URL credentials in validation errors', () => {
    expect(() => validateUrl('https://user:very-secret@example.com/', { allowHttp: false, allowPrivate: false }))
      .toThrow('URL darf keine Zugangsdaten enthalten.')
  })

  it('does not expose private or local report targets', () => {
    expect(reportUrl('http://127.0.0.1:3000/private?token=secret')).toEqual({
      parameterNames: ['token'],
      url: '(privates/lokales Ziel)',
    })
    expect(redactText('Abruf http://internal.local/admin?token=secret fehlgeschlagen')).toBe('Abruf (privates/lokales Ziel) fehlgeschlagen')
    expect(redactText('connect ECONNREFUSED 192.168.1.4, [::1] und service.internal.local')).toBe('connect ECONNREFUSED [REDACTED_PRIVATE_IP], [REDACTED_PRIVATE_IP] und [REDACTED_PRIVATE_HOST]')
  })

  it('redacts URLs and common secret assignments in arbitrary messages', () => {
    const output = redactText('Abruf https://example.com/path?arbitrary=sensitive fehlgeschlagen; token=very-secret; person@example.com; Bearer ey.secret')

    expect(output).toBe('Abruf https://example.com/path fehlgeschlagen; token=[REDACTED]; [REDACTED_EMAIL]; Bearer [REDACTED]')
    expect(output).not.toContain('sensitive')
    expect(output).not.toContain('very-secret')
  })

  it('redacts nested report URL fields without changing non-sensitive facts', () => {
    const output = redactReportData({
      action: '/submit?csrf=secret',
      issue: { message: 'Weiter zu https://example.com/?code=secret', severity: 'warning' },
      requestedUrl: 'https://example.com/?email=private%40example.com',
      status: 200,
    })

    expect(output).toEqual({
      action: '/submit',
      issue: { message: 'Weiter zu https://example.com/', severity: 'warning' },
      requestedUrl: 'https://example.com/',
      status: 200,
    })
  })
})
