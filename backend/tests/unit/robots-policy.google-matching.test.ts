/**
 * Politique robots.txt (`@repo/seo-url-contract/robots-policy`) évaluée avec la
 * sémantique de Google — pas par recherche de sous-chaînes.
 *
 * Aucun parseur robots.txt n'est installé (et aucune dépendance n'est ajoutée) :
 * le matcher ci-dessous est un ORACLE DE TEST, validé d'abord sur les exemples
 * publiés par Google, puis appliqué aux tables de décision de la politique.
 *
 * Sémantique retenue (https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt) :
 *  - `#` ouvre un commentaire jusqu'à la fin de ligne ;
 *  - un robot applique le(s) groupe(s) dont le user-agent égale son jeton
 *    produit (insensible à la casse), sinon le(s) groupe(s) `*` — jamais les deux ;
 *  - motif ancré au début du chemin, `*` = toute séquence, `$` final = fin d'URL ;
 *  - la règle dont le motif est le plus long l'emporte ; égalité → allow ;
 *  - `crawl-delay`, `sitemap` et une valeur vide n'influencent pas la décision.
 */
import {
  buildRobotsTxt,
  isRobotsProductionEnv,
} from '@repo/seo-url-contract/robots-policy';

type Rule = { allow: boolean; pattern: string };
type Group = { agents: string[]; rules: Rule[] };

function parseRobots(body: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if ((field === 'allow' || field === 'disallow') && current && value) {
      current.rules.push({ allow: field === 'allow', pattern: value });
    }
  }
  return groups;
}

function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path);
}

/** Décision Google pour `crawler` (jeton produit) sur `path` (chemin + query). */
function isAllowed(body: string, crawler: string, path: string): boolean {
  const groups = parseRobots(body);
  const token = crawler.toLowerCase();
  let applicable = groups.filter((g) => g.agents.includes(token));
  if (applicable.length === 0) {
    applicable = groups.filter((g) => g.agents.includes('*'));
  }
  let best: Rule | null = null;
  for (const rule of applicable.flatMap((g) => g.rules)) {
    if (!patternMatches(rule.pattern, path)) continue;
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

describe('oracle de test — exemples publiés par Google', () => {
  const single = (rule: string) => `User-agent: *\n${rule}\n`;

  it.each([
    ['Disallow: /fish', '/fish', false],
    ['Disallow: /fish', '/fish.html', false],
    ['Disallow: /fish', '/fish/salmon.html', false],
    ['Disallow: /fish', '/fishheads', false],
    ['Disallow: /fish', '/fish.php?id=anything', false],
    ['Disallow: /fish', '/Fish.asp', true],
    ['Disallow: /fish', '/catfish', true],
    ['Disallow: /fish', '/?id=fish', true],
    ['Disallow: /fish', '/desert/fish', true],
    ['Disallow: /fish*', '/fishheads/yummy.html', false],
    ['Disallow: /fish/', '/fish/', false],
    ['Disallow: /fish/', '/fish/?id=anything', false],
    ['Disallow: /fish/', '/fish', true],
    ['Disallow: /fish/', '/fish.html', true],
    ['Disallow: /fish/', '/animals/fish/', true],
    ['Disallow: /*.php', '/index.php', false],
    ['Disallow: /*.php', '/folder/filename.php?parameters', false],
    ['Disallow: /*.php', '/folder/any.php.file.html', false],
    ['Disallow: /*.php', '/windows.PHP', true],
    ['Disallow: /*.php$', '/filename.php', false],
    ['Disallow: /*.php$', '/filename.php?parameters', true],
    ['Disallow: /*.php$', '/filename.php/', true],
    ['Disallow: /*.php$', '/filename.php5', true],
    ['Disallow: /fish*.php', '/fishheads/catfish.php?parameters', false],
    ['Disallow: /fish*.php', '/Fish.PHP', true],
  ])('%s → %s autorisé = %s', (rule, path, expected) => {
    expect(isAllowed(single(rule), 'Examplebot', path)).toBe(expected);
  });

  it.each([
    ['Allow: /p\nDisallow: /', '/page', true],
    ['Allow: /folder\nDisallow: /folder', '/folder/page', true],
    ['Allow: /page\nDisallow: /*.htm', '/page.htm', false],
    ['Allow: /page\nDisallow: /*.ph', '/page.php5', true],
    ['Allow: /$\nDisallow: /', '/', true],
    ['Allow: /$\nDisallow: /', '/page.htm', false],
  ])('précédence %j sur %s → autorisé = %s', (rules, path, expected) => {
    expect(isAllowed(single(rules), 'Examplebot', path)).toBe(expected);
  });

  it('groupe le plus spécifique seul : les règles de * ne s’ajoutent pas', () => {
    const body =
      'User-agent: *\nDisallow: /private/\n\nUser-agent: Googlebot\nDisallow: /tmp/\n';
    expect(isAllowed(body, 'Googlebot', '/private/x')).toBe(true);
    expect(isAllowed(body, 'Googlebot', '/tmp/x')).toBe(false);
    expect(isAllowed(body, 'Examplebot', '/private/x')).toBe(false);
  });
});

describe('politique robots.txt de production — tables de décision', () => {
  const now = new Date('2026-09-11T08:00:00Z');
  const body = buildRobotsTxt({
    production: true,
    baseUrl: 'https://www.automecanik.com',
    now,
  });

  it.each([
    '/',
    '/pieces/filtre-a-air-8.html',
    '/pieces/capteur-niveau-d-huile-moteur-1289/audi-22/a5-sportback-22048/1-8-tfsi-33409.html',
    '/blog-pieces-auto/conseils/capteur-abs',
    '/constructeurs/audi-22.html',
    '/pieces/filtre-a-air-8.html?utm_source=newsletter',
    '/pieces/filtre-a-air-8.html?gclid=abc',
    '/cart',
    '/checkout',
    '/account/orders',
    '/login',
    '/search',
    '/sitemap.xml',
  ])('Googlebot PEUT explorer %s', (path) => {
    expect(isAllowed(body, 'Googlebot', path)).toBe(true);
  });

  it.each([
    '/search?q=plaquette+frein',
    '/search/results?q=frein',
    '/search/cnit',
    '/search/mine',
    '/api/seo/robots.txt',
    '/admin/',
    '/img/pieces/x.webp',
    '/fiche/123',
    '/find/x',
    '/searchmine/x',
    '/_form.get.car.brand',
  ])('Googlebot ne peut PAS explorer %s', (path) => {
    expect(isAllowed(body, 'Googlebot', path)).toBe(false);
  });

  it('groupe Googlebot sans Crawl-delay (non pris en charge par Google)', () => {
    const googlebot = body.split(/\n(?=# 🖼️ Googlebot-Image)/)[0];
    const section = googlebot.slice(googlebot.indexOf('User-agent: Googlebot'));
    expect(section).not.toMatch(/crawl-delay/i);
  });

  it('robots génériques (*) : comportement inchangé, y compris ses limites connues', () => {
    expect(isAllowed(body, 'Examplebot', '/pieces/filtre-a-air-8.html')).toBe(
      true,
    );
    expect(isAllowed(body, 'Examplebot', '/search?q=x')).toBe(false);
    expect(isAllowed(body, 'Examplebot', '/pieces/x.html?utm_source=a')).toBe(
      false,
    );
    expect(isAllowed(body, 'Examplebot', '/cart/items')).toBe(false);
    // limite constatée, non modifiée (hors décision) : `/cart/` ne couvre pas `/cart`
    expect(isAllowed(body, 'Examplebot', '/cart')).toBe(true);
  });

  it.each(['AhrefsBot', 'SemrushBot', 'GPTBot', 'ClaudeBot', 'Bytespider'])(
    '%s reste entièrement bloqué',
    (bot) => {
      expect(isAllowed(body, bot, '/')).toBe(false);
      expect(isAllowed(body, bot, '/pieces/filtre-a-air-8.html')).toBe(false);
    },
  );

  it('toutes les directives sont connues (aucune faute de frappe ignorée silencieusement)', () => {
    const fields = body
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter(Boolean)
      .map((l) => l.slice(0, l.indexOf(':')).toLowerCase());
    expect(
      fields.filter(
        (f) =>
          ![
            'user-agent',
            'allow',
            'disallow',
            'crawl-delay',
            'sitemap',
          ].includes(f),
      ),
    ).toEqual([]);
  });

  it('un seul Sitemap, sur l’origine fournie ; sortie déterministe pour un instant donné', () => {
    expect(body.match(/^Sitemap: .*$/gm)).toEqual([
      'Sitemap: https://www.automecanik.com/sitemap.xml',
    ]);
    expect(
      buildRobotsTxt({
        production: true,
        baseUrl: 'https://www.automecanik.com',
        now,
      }),
    ).toBe(body);
  });
});

describe('hors production', () => {
  const body = buildRobotsTxt({
    production: false,
    baseUrl: 'https://www.automecanik.com',
    now: new Date('2026-09-11T08:00:00Z'),
  });

  it.each(['Googlebot', 'Examplebot'])('%s ne peut rien explorer', (bot) => {
    expect(isAllowed(body, bot, '/')).toBe(false);
    expect(isAllowed(body, bot, '/pieces/filtre-a-air-8.html')).toBe(false);
  });

  it.each([
    ['production', true],
    ['preprod', false],
    ['development', false],
    ['test', false],
    ['PRODUCTION', false],
    [undefined, false],
  ])(
    'isRobotsProductionEnv(%s) = %s (seule la valeur exacte publie)',
    (env, expected) => {
      expect(isRobotsProductionEnv(env)).toBe(expected);
    },
  );
});
