// @vitest-environment node
/**
 * En-tête de passage Cloudflare de la sonde du parcours d'achat (complément n° 2
 * du mandat EI). Aucun réseau : fonctions pures, chargement de la config et
 * lecture du code de la sonde.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BYPASS_ENV,
  BYPASS_HEADER,
  REDACTED,
  apiOptions,
  headersFor,
  leakedOrigin,
  readBypassToken,
  redact,
} from '../purchase-probe/probe-network';

const ORIGIN = 'https://www.automecanik.com';
const TOKEN = 'jeton-de-test-0123456789abcdef';
const PROBE_DIR = resolve(__dirname, '../purchase-probe');

describe('readBypassToken', () => {
  it('renvoie le jeton présent', () => {
    expect(readBypassToken({ [BYPASS_ENV]: TOKEN })).toBe(TOKEN);
  });

  it.each([
    ['absent', {}],
    ['vide', { [BYPASS_ENV]: '' }],
  ])('échoue, jeton %s, avec un message qui nomme la variable', (_, env) => {
    expect(() => readBypassToken(env)).toThrow(/PURCHASE_PROBE_BYPASS_TOKEN requis/);
  });

  it.each([
    ['retour à la ligne final', `${TOKEN}\n`],
    ['espace', 'abc def'],
    ['retour chariot', 'abc\rdef'],
    ['non ASCII', 'jéton'],
  ])('refuse un jeton mal formé (%s) sans afficher sa valeur', (_, value) => {
    let message = '';
    try {
      readBypassToken({ [BYPASS_ENV]: value });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/PURCHASE_PROBE_BYPASS_TOKEN mal formé/);
    expect(message).not.toContain(value.trim());
  });
});

describe('headersFor', () => {
  const base = {
    'user-agent': 'HeadlessChrome AutoMecanik-PurchaseProbe-bot/1.0',
    accept: '*/*',
  };

  it("ajoute l'en-tête vers l'origine sondée et garde les autres en-têtes", () => {
    expect(headersFor(`${ORIGIN}/`, ORIGIN, base, TOKEN)).toEqual({
      ...base,
      [BYPASS_HEADER]: TOKEN,
    });
    expect(headersFor(`${ORIGIN}/api/cart/items?x=1`, ORIGIN, base, TOKEN)[BYPASS_HEADER]).toBe(TOKEN);
  });

  it.each([
    'https://www.googletagmanager.com/gtag/js',
    'https://automecanik.com/',
    'https://cdn.automecanik.com/img.webp',
    'http://www.automecanik.com/',
    'https://www.automecanik.com:8443/',
    'https://www.automecanik.com.evil.example/',
    'data:image/png;base64,AAAA',
    'pas une url',
  ])("n'envoie jamais le jeton à une autre origine : %s", (url) => {
    const out = headersFor(url, ORIGIN, base, TOKEN);
    expect(out).toEqual(base);
    expect(Object.values(out)).not.toContain(TOKEN);
  });

  it("retire l'en-tête d'une requête tierce qui le porterait, quelle que soit la casse", () => {
    const out = headersFor('https://tiers.example/', ORIGIN, { ...base, 'X-AutoMecanik-Probe': TOKEN }, TOKEN);
    expect(out).toEqual(base);
  });

  it("ne modifie pas l'objet reçu", () => {
    const input = { ...base };
    headersFor(`${ORIGIN}/`, ORIGIN, input, TOKEN);
    expect(input).toEqual(base);
  });
});

describe('redact', () => {
  it('masque chaque occurrence du jeton', () => {
    const log = `→ GET ${ORIGIN}/api/cart\n  - ${BYPASS_HEADER}: ${TOKEN}\n  - again ${TOKEN}`;
    const out = redact(log, TOKEN);
    expect(out).not.toContain(TOKEN);
    expect(out.split(REDACTED)).toHaveLength(3);
  });

  it('laisse un texte sans jeton intact', () => {
    expect(redact('GET /', TOKEN)).toBe('GET /');
  });
});

describe('leakedOrigin', () => {
  it("relève une redirection qui quitte l'origine sondée", () => {
    expect(leakedOrigin([`${ORIGIN}/sortie`, 'https://tiers.example/x'], ORIGIN)).toBe('https://tiers.example');
    expect(leakedOrigin([`${ORIGIN}/a`, `${ORIGIN}/b`, 'https://tiers.example/x'], ORIGIN)).toBe(
      'https://tiers.example',
    );
  });

  it("ignore une redirection interne ou une chaîne partie d'un tiers (jeton jamais ajouté)", () => {
    expect(leakedOrigin([`${ORIGIN}/a`, `${ORIGIN}/b`], ORIGIN)).toBeNull();
    expect(leakedOrigin(['https://tiers.example/a', 'https://autre.example/b'], ORIGIN)).toBeNull();
    expect(leakedOrigin([`${ORIGIN}/`], ORIGIN)).toBeNull();
  });
});

describe('apiOptions', () => {
  it("porte l'en-tête et ne suit aucune redirection", () => {
    expect(apiOptions(TOKEN)).toEqual({
      headers: { [BYPASS_HEADER]: TOKEN },
      maxRedirects: 0,
    });
  });
});

describe('config de la sonde', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.resetModules();
  });

  it('refuse de démarrer sans jeton, avec un message clair', async () => {
    process.env.PURCHASE_PROBE_BASE_URL = ORIGIN;
    delete process.env[BYPASS_ENV];
    vi.resetModules();
    await expect(import('../purchase-probe/playwright.config')).rejects.toThrow(/PURCHASE_PROBE_BYPASS_TOKEN requis/);
  });

  it('démarre avec le jeton, sans le placer dans la config', async () => {
    process.env.PURCHASE_PROBE_BASE_URL = ORIGIN;
    process.env[BYPASS_ENV] = TOKEN;
    vi.resetModules();
    const config = (await import('../purchase-probe/playwright.config')).default;
    expect(config.use?.baseURL).toBe(ORIGIN);
    expect(JSON.stringify(config)).not.toContain(TOKEN);
    // Ni trace, ni capture, ni vidéo : aucun artefact où le jeton pourrait figurer.
    expect(config.use).toMatchObject({
      trace: 'off',
      screenshot: 'off',
      video: 'off',
    });
  });
});

describe('code de la sonde', () => {
  const probe = readFileSync(resolve(PROBE_DIR, 'purchase-path.probe.ts'), 'utf8');
  const network = readFileSync(resolve(PROBE_DIR, 'probe-network.ts'), 'utf8');

  it("garde l'agent utilisateur robot (décision 36)", () => {
    expect(probe).toContain("PROBE_UA_TOKEN = 'AutoMecanik-PurchaseProbe-bot/1.0'");
    expect(probe).toMatch(/HeadlessChrome\/\$\{browser\.version\(\)\}/);
  });

  it("n'ajoute pas le jeton aux en-têtes de tout le contexte (ils partiraient vers les tiers)", () => {
    expect(probe).not.toMatch(/extraHTTPHeaders:[^}]*BYPASS/);
    expect(probe).not.toMatch(/setExtraHTTPHeaders/);
  });

  it('passe chaque requête de la page par headersFor', () => {
    expect(network.match(/route\.continue\(/g)).toHaveLength(1);
    expect(network).toMatch(
      /route\.continue\(\{\s*headers: headersFor\(request\.url\(\), origin, request\.headers\(\), token\),?\s*\}\)/,
    );
    expect(probe).not.toMatch(/route\.continue\(/);
  });

  it('appelle context.request avec apiOptions (origine sondée, sans redirection)', () => {
    const calls = probe.match(/context\.request\.\w+\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).toMatch(/^context\.request\.\w+\('\/[^']*', API\)$/);
  });

  it("masque le jeton avant toute écriture du résultat et du message d'échec", () => {
    expect(probe).toMatch(
      /writeFileSync\(RESULT_PATH, `\$\{redact\(JSON\.stringify\(result, null, 2\), BYPASS_TOKEN\)\}/,
    );
    expect(probe).toMatch(/const raw = redact\(/);
    expect(probe).toMatch(/expect\(failedStep, redact\(/);
  });

  it("n'écrit rien dans le journal", () => {
    expect(`${probe}\n${network}`).not.toMatch(/console\.|process\.stdout|process\.stderr/);
  });
});
