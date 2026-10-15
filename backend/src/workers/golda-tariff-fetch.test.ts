import {
  countVerdict,
  errorText,
  loginAttemptsOn,
  makeRedactor,
  redirectHopAllowed,
} from './golda-tariff-fetch';

const G = 'https://www.golda.fr';

describe('makeRedactor — credentials, session headers and URLs never reach the output', () => {
  const USER = 'test.user@example.invalid';
  const PASS = 'p@ss w0rd!(~)"\\';
  const redact = makeRedactor([USER, PASS]);

  it('hides the raw, URL-encoded, form-encoded and JSON-escaped forms', () => {
    const forms = [
      PASS,
      encodeURIComponent(PASS),
      encodeURIComponent(PASS).replace(/%20/g, '+'),
      new URLSearchParams({ x: PASS }).toString().slice(2),
      JSON.stringify(PASS).slice(1, -1),
    ];
    expect(new Set(forms).size).toBe(forms.length);
    for (const form of forms)
      expect(redact(`before ${form} after`)).toBe('before *** after');
    expect(redact(`login ${USER}`)).toBe('login ***');
  });

  it('hides cookie, set-cookie and authorization header lines', () => {
    expect(
      redact('Call log:\n  - cookie: PHPSESSID=abc123\n  - accept: */*'),
    ).toBe('Call log:\n  - cookie: ***\n  - accept: */*');
    expect(redact('Set-Cookie: a=b; path=/')).toBe('Set-Cookie: ***');
    expect(redact('authorization: Basic eHk=')).toBe('authorization: ***');
  });

  it('replaces every URL', () => {
    expect(redact(`GET ${G}/tarifs/download.php?idt=1&idv=2 failed`)).toBe(
      'GET <url> failed',
    );
  });
});

describe('errorText — drops the Playwright call log (it lists the cookie header)', () => {
  const e = new Error(
    'apiRequestContext.get: socket hang up\nCall log:\n  - → GET <url>\n  - cookie: PHPSESSID=SECRET',
  );

  it('keeps the message head only', () => {
    expect(errorText(e)).toBe('Error: apiRequestContext.get: socket hang up');
  });

  it('with the stack: the head, then the frames, never the call log', () => {
    const t = errorText(e, true);
    expect(t).not.toContain('SECRET');
    expect(t).toMatch(/^Error: apiRequestContext\.get: socket hang up\n\s+at /);
  });

  it('a value that is not an Error', () => {
    expect(errorText('plain')).toBe('plain');
  });
});

describe('loginAttemptsOn — the daily cap counts attempts, recorded before the credentials leave', () => {
  const jsonl =
    [
      { ts: '2026-01-15T08:00:00.000Z', outcome: 'attempt' },
      { ts: '2026-01-15T08:00:05.000Z', outcome: 'ok' },
      { ts: '2026-01-15T09:00:00.000Z', outcome: 'attempt' },
      { ts: '2026-01-15T09:00:05.000Z', outcome: 'LOCK_LOGIN_FAILED' },
      { ts: '2026-01-14T23:59:59.999Z', outcome: 'attempt' },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n') + '\n';

  it('counts the attempt lines of that day only', () => {
    expect(loginAttemptsOn(jsonl, '2026-01-15')).toBe(2);
    expect(loginAttemptsOn(jsonl, '2026-01-14')).toBe(1);
    expect(loginAttemptsOn(jsonl, '2026-01-16')).toBe(0);
    expect(loginAttemptsOn('', '2026-01-15')).toBe(0);
  });

  it('an unreadable line is fatal, never skipped', () => {
    for (const bad of [
      '{"ts":"2026-01-15T0',
      'null',
      '42',
      '{"outcome":"attempt"}',
    ])
      expect(() => loginAttemptsOn(`${bad}\n`, '2026-01-15')).toThrow(
        /line 1 unreadable/,
      );
  });
});

describe('countVerdict — "Tarif complet" = data lines minus SUP lines', () => {
  const report = (dataLines: number, sup: number, rejectedLines = 0) => ({
    dataLines,
    rejectedLines,
    byStatus: { UNCHANGED: 0, NOU: 0, MOD: 0, FIN: 0, SUP: sup },
  });

  it('matches when the SUP lines are taken out', () => {
    expect(countVerdict(report(120, 20, 3), 100)).toEqual({
      ok: true,
      dataLines: 120,
      sup: 20,
      rejected: 3,
    });
  });

  it('refuses any other count', () => {
    expect(countVerdict(report(120, 20), 120).ok).toBe(false);
    expect(countVerdict(report(120, 20), 99).ok).toBe(false);
  });
});

describe('redirectHopAllowed — hops Playwright never routes', () => {
  const hop = (url: string, resourceType = 'document', method = 'GET') => ({
    url,
    method,
    resourceType,
  });

  it('accepts a page landing on a worker page or the logged-out landing', () => {
    for (const url of [
      `${G}/espace-abonnes.php`,
      `${G}/index.php?statut=notvalid`,
      `${G}/`,
    ])
      expect(redirectHopAllowed(hop(url), 'read')).toBe(true);
    expect(redirectHopAllowed(hop(`${G}/img/a.gif`, 'image'), 'read')).toBe(
      true,
    );
  });

  it('refuses any other target, type or host', () => {
    expect(
      redirectHopAllowed(hop(`${G}/compte/supprimer.php?id=1`), 'read'),
    ).toBe(false);
    expect(
      redirectHopAllowed(
        hop(`${G}/compte/supprimer.php?id=1`, 'image'),
        'read',
      ),
    ).toBe(false);
    expect(
      redirectHopAllowed(hop(`${G}/index.php?statut=notvalid`, 'xhr'), 'read'),
    ).toBe(false);
    expect(
      redirectHopAllowed(
        hop(`${G}/index.php?statut=notvalid`, 'document', 'POST'),
        'login',
      ),
    ).toBe(false);
    expect(
      redirectHopAllowed(hop('https://other.example/index.php'), 'read'),
    ).toBe(false);
  });
});
