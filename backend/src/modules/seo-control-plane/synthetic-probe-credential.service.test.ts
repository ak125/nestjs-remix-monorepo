import { ConfigService } from '@nestjs/config';
import {
  SyntheticProbeCredentialService,
  type SyntheticVerifiableRequest,
} from './synthetic-probe-credential.service';
import {
  SYNTHETIC_PROBE_HEADER,
  SYNTHETIC_PROBE_SECRET_KEY,
  SYNTHETIC_PROBE_ENABLED_KEY,
  SYNTHETIC_PROBE_WINDOW_MS,
  isSyntheticExemptPath,
} from './types';

/** Secret fixture — JAMAIS une vraie valeur. */
const SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);
const ENABLED: Record<string, string> = {
  [SYNTHETIC_PROBE_ENABLED_KEY]: 'true',
  [SYNTHETIC_PROBE_SECRET_KEY]: SECRET,
};

function makeService(
  env: Record<string, string | undefined>,
): SyntheticProbeCredentialService {
  const config = {
    get: (k: string, d?: string) => env[k] ?? d ?? '',
  } as unknown as ConfigService;
  return new SyntheticProbeCredentialService(config);
}

function reqWith(
  mac: string | undefined,
  method = 'GET',
  path = '/pieces/x.html',
): SyntheticVerifiableRequest {
  return {
    method,
    path,
    headers: mac === undefined ? {} : { [SYNTHETIC_PROBE_HEADER]: mac },
  };
}

describe('SyntheticProbeCredentialService', () => {
  const T0 = 1_700_000_000_000; // epoch ms fixe
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(T0);
  });
  afterEach(() => jest.restoreAllMocks());

  it('signe et vérifie dans la même fenêtre', () => {
    const s = makeService(ENABLED);
    const mac = s.sign('GET', '/pieces/x.html');
    expect(s.verify(reqWith(mac))).toBe(true);
  });

  it('accepte la fenêtre précédente (t-1, tolérance de skew)', () => {
    const s = makeService(ENABLED);
    const mac = s.sign('GET', '/pieces/x.html');
    nowSpy.mockReturnValue(T0 + SYNTHETIC_PROBE_WINDOW_MS);
    expect(s.verify(reqWith(mac))).toBe(true);
  });

  it('rejette une signature expirée (> 2 fenêtres)', () => {
    const s = makeService(ENABLED);
    const mac = s.sign('GET', '/pieces/x.html');
    nowSpy.mockReturnValue(T0 + 2 * SYNTHETIC_PROBE_WINDOW_MS + 1000);
    expect(s.verify(reqWith(mac))).toBe(false);
  });

  it('rejette une signature faite avec un autre secret', () => {
    const signer = makeService(ENABLED);
    const verifier = makeService({
      ...ENABLED,
      [SYNTHETIC_PROBE_SECRET_KEY]: OTHER_SECRET,
    });
    const mac = signer.sign('GET', '/pieces/x.html');
    expect(verifier.verify(reqWith(mac))).toBe(false);
  });

  it('rejette le rejeu sur un autre chemin (binding chemin)', () => {
    const s = makeService(ENABLED);
    const mac = s.sign('GET', '/pieces/a.html');
    expect(s.verify(reqWith(mac, 'GET', '/pieces/b.html'))).toBe(false);
  });

  it('rejette le rejeu avec une autre méthode (binding méthode)', () => {
    const s = makeService(ENABLED);
    const mac = s.sign('GET', '/pieces/x.html');
    expect(s.verify(reqWith(mac, 'POST', '/pieces/x.html'))).toBe(false);
  });

  it('rejette quand le header est absent (spoof UA-seul = sans effet)', () => {
    const s = makeService(ENABLED);
    expect(s.verify(reqWith(undefined))).toBe(false);
  });

  it('rejette (fail-closed) quand le kill-switch est OFF', () => {
    const off = makeService({ [SYNTHETIC_PROBE_SECRET_KEY]: SECRET }); // enabled non posé
    const mac = makeService(ENABLED).sign('GET', '/pieces/x.html');
    expect(off.isActive()).toBe(false);
    expect(off.verify(reqWith(mac))).toBe(false);
  });

  it('rejette (fail-closed) quand activé mais secret absent', () => {
    const noSecret = makeService({ [SYNTHETIC_PROBE_ENABLED_KEY]: 'true' });
    expect(noSecret.isActive()).toBe(false);
    expect(noSecret.verify(reqWith('anything'))).toBe(false);
  });

  it('isActive() = vrai seulement si activé ET secret présent', () => {
    expect(makeService(ENABLED).isActive()).toBe(true);
    expect(
      makeService({ [SYNTHETIC_PROBE_ENABLED_KEY]: 'true' }).isActive(),
    ).toBe(false);
    expect(
      makeService({ [SYNTHETIC_PROBE_SECRET_KEY]: SECRET }).isActive(),
    ).toBe(false);
  });
});

describe('isSyntheticExemptPath (least-privilege scope)', () => {
  it('exempte les GET catalogue publics + accueil', () => {
    expect(isSyntheticExemptPath('GET', '/')).toBe(true);
    expect(isSyntheticExemptPath('GET', '/pieces/barre-274.html')).toBe(true);
    expect(isSyntheticExemptPath('GET', '/pieces')).toBe(true);
    expect(
      isSyntheticExemptPath('GET', '/constructeurs/audi/a4/2-0.html'),
    ).toBe(true);
    expect(isSyntheticExemptPath('GET', '/blog/guide')).toBe(true);
  });

  it('ne couvre PAS les sitemaps (servis statiquement par Caddy, hors throttler)', () => {
    expect(isSyntheticExemptPath('GET', '/sitemap-pieces-1.xml')).toBe(false);
    expect(isSyntheticExemptPath('GET', '/sitemap.xml')).toBe(false);
  });

  it('REFUSE toute méthode non-GET (même chemin public)', () => {
    expect(isSyntheticExemptPath('POST', '/pieces/x.html')).toBe(false);
    expect(isSyntheticExemptPath('HEAD', '/pieces/x.html')).toBe(false);
    expect(isSyntheticExemptPath('PUT', '/')).toBe(false);
  });

  it('REFUSE les chemins sensibles/non-publics (blast radius borné)', () => {
    expect(isSyntheticExemptPath('GET', '/api/auth/login')).toBe(false);
    expect(isSyntheticExemptPath('GET', '/cart')).toBe(false);
    expect(isSyntheticExemptPath('GET', '/checkout')).toBe(false);
    expect(isSyntheticExemptPath('GET', '/admin')).toBe(false);
    expect(isSyntheticExemptPath('GET', '/account/orders')).toBe(false);
  });

  it('ne matche pas un préfixe partiel trompeur', () => {
    // '/piecesXYZ' ne doit PAS matcher le préfixe '/pieces'
    expect(isSyntheticExemptPath('GET', '/pieces-fake/x')).toBe(false);
    expect(isSyntheticExemptPath('GET', '/blogger')).toBe(false);
  });
});
