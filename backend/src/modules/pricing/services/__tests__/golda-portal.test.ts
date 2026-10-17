import {
  GOLDA_ORIGIN,
  GoldaPageFormatError,
  goldaCsvDownloadUrl,
  goldaFicheUrl,
  goldaRequestVerdict,
  isGoldaLandingUrl,
  isGoldaLoggedOutUrl,
  parseGoldaDownloadUrl,
  parseGoldaFichePage,
  type GoldaPhase,
  type GoldaPublicationKind,
} from '../golda-portal';

// Synthetic pages shaped like the portal's fiche page (the real captures stay outside the repo).
const FICHE = 7;

const csvHref = (
  kind: GoldaPublicationKind,
  o: { idt?: number; idv?: number; protect?: string; format?: string } = {},
) =>
  `download.php?idt=${o.idt ?? FICHE}&amp;idv=${o.idv ?? 11}&amp;format=${o.format ?? 'csv'}` +
  `&amp;type=${kind}&amp;protect=${o.protect ?? 'nomdp'}`;

const link = (href: string, title = 'T&eacute;l&eacute;charger') =>
  `<a href="${href}" title="${title}" target="_blank"><img src="/img/csv.gif" alt=""></a>`;

interface SectionOpts {
  heading?: string;
  published?: string;
  updated?: string;
  summary?: string;
  count?: string;
  links?: string;
  extraRows?: string;
}

const HEADINGS: Record<GoldaPublicationKind, string> = {
  tavi: 'Tarif en vigueur au 01/03/2026',
  tapr: 'Prochain tarif au 01/06/2026',
};
const SUMMARIES: Record<GoldaPublicationKind, string> = {
  tavi: 'Tarif en vigueur',
  tapr: 'Prochain tarif',
};

const section = (kind: GoldaPublicationKind, o: SectionOpts = {}) =>
  `<a name="${kind}"></a>
<h2>${o.heading ?? HEADINGS[kind]}</h2>
<p class="pub">Date initiale de publication : ${o.published ?? '15/02/2026'}${
    o.updated ? ` - Derni&egrave;re mise &agrave; jour : ${o.updated}` : ''
  }</p>
<table class="tarifs" summary="${o.summary ?? SUMMARIES[kind]}">
<tr><th>Fichier</th><th>R&eacute;f&eacute;rences</th><th>T&eacute;l&eacute;chargement</th></tr>
<tr><td class="lib">Tarif complet</td><td>${o.count ?? '1 234'}</td><td>${
    o.links ??
    `${link(csvHref(kind))} ${link(csvHref(kind, { format: 'xls' }))}`
  }</td></tr>
<tr><td class="lib">Modifications</td><td>12</td><td>${link(csvHref(kind, { idv: 99 }))}</td></tr>
${o.extraRows ?? ''}</table>`;

const page = (sections: string[], title = 'MARQUE TEST - Tarif Public') =>
  `<html><head><title>Golda</title></head><body>
<div id="menu"><a href="/espace-abonnes.php">Mon espace</a></div>
<h1 class="titre">${title}</h1>
${sections.join('\n<p>&nbsp;</p>\n')}
</body></html>`;

const refuses = (html: string, msg: RegExp) => {
  expect(() => parseGoldaFichePage(html, FICHE)).toThrow(GoldaPageFormatError);
  expect(() => parseGoldaFichePage(html, FICHE)).toThrow(msg);
};

describe('parseGoldaFichePage — recognised pages', () => {
  it('reads a current tariff with a public CSV link', () => {
    expect(parseGoldaFichePage(page([section('tavi')]), FICHE)).toEqual({
      ficheId: FICHE,
      title: 'MARQUE TEST - Tarif Public',
      publications: [
        {
          kind: 'tavi',
          applicationDate: '2026-03-01',
          firstPublished: '2026-02-15',
          lastUpdated: null,
          completCount: 1234,
          csv: { idt: FICHE, idv: 11, protect: 'nomdp', access: 'public' },
        },
      ],
    });
  });

  it('reads the next tariff and the last update date', () => {
    const html = page([
      section('tavi', { updated: '20/02/2026' }),
      section('tapr', {
        links: link(
          csvHref('tapr', { idv: 12, protect: 'mdp' }),
          'Acc&egrave;s autoris&eacute;',
        ),
      }),
    ]);
    const { publications } = parseGoldaFichePage(html, FICHE);
    expect(publications.map((p) => [p.kind, p.lastUpdated])).toEqual([
      ['tavi', '2026-02-20'],
      ['tapr', null],
    ]);
    expect(publications[1]).toMatchObject({
      applicationDate: '2026-06-01',
      csv: { idt: FICHE, idv: 12, protect: 'mdp', access: 'authorized' },
    });
  });

  it('reads a protected link (password not granted) as "protected"', () => {
    const html = page([
      section('tavi', {
        links: link(
          csvHref('tavi', { protect: 'mdp' }),
          'Acc&egrave;s prot&eacute;g&eacute;',
        ),
      }),
    ]);
    expect(parseGoldaFichePage(html, FICHE).publications[0].csv).toEqual({
      idt: FICHE,
      idv: 11,
      protect: 'mdp',
      access: 'protected',
    });
  });

  it('returns csv null when the "Tarif complet" row has no CSV link', () => {
    const html = page([
      section('tavi', {
        links: link(csvHref('tavi', { format: 'xls' })),
        count: '0',
      }),
    ]);
    expect(parseGoldaFichePage(html, FICHE).publications[0]).toMatchObject({
      completCount: 0,
      csv: null,
    });
  });

  it('reads a reference count written with &nbsp; thousands separators', () => {
    const html = page([section('tavi', { count: '12&nbsp;345' })]);
    expect(parseGoldaFichePage(html, FICHE).publications[0].completCount).toBe(
      12345,
    );
  });

  it('refuses an invalid fiche id as a caller error, not a page format', () => {
    expect(() => parseGoldaFichePage(page([section('tavi')]), 0)).toThrow(
      'invalid fiche id',
    );
    expect(() => parseGoldaFichePage(page([section('tavi')]), 0)).not.toThrow(
      GoldaPageFormatError,
    );
  });
});

describe('parseGoldaFichePage — anything unexpected throws GoldaPageFormatError', () => {
  it('a page without one <h1>, or with an empty one', () => {
    refuses(
      page([section('tavi')]).replace('<h1 class="titre">', '<h1>A</h1><h1>'),
      /one <h1>/,
    );
    refuses(page([section('tavi')], ' &nbsp; '), /empty title/);
  });

  it('a page without the current tariff section', () => {
    refuses(page([section('tapr')]), /no current tariff section/);
  });

  it('a repeated section anchor', () => {
    refuses(page([section('tavi'), section('tavi')]), /anchor repeated/);
  });

  it('a heading that is not the expected one, or not right after the anchor', () => {
    refuses(
      page([section('tavi', { heading: 'Tarif futur au 01/03/2026' })]),
      /unexpected heading/,
    );
    refuses(
      page([section('tavi')]).replace(
        '<a name="tavi"></a>\n',
        '<a name="tavi"></a><p>x</p>',
      ),
      /heading not right after the anchor/,
    );
  });

  it('a date that is not a calendar day', () => {
    refuses(
      page([section('tavi', { heading: 'Tarif en vigueur au 31/02/2026' })]),
      /not a calendar day/,
    );
    refuses(
      page([section('tavi', { updated: '00/01/2026' })]),
      /not a calendar day/,
    );
  });

  it('a missing publication date', () => {
    refuses(
      page([section('tavi')]).replace('Date initiale', 'Date'),
      /no publication date/,
    );
  });

  it('a table that is not the section table', () => {
    refuses(
      page([section('tavi', { summary: 'Autre tableau' })]),
      /table summary mismatch/,
    );
    refuses(
      page([section('tavi')]).replace(
        '<p class="pub">',
        '<table><tr><td>x</td></tr><p class="pub">',
      ),
      /expected one table/,
    );
  });

  it('no "Tarif complet" row, or two of them', () => {
    refuses(
      page([section('tavi')]).replace(/Tarif complet/g, 'Tarif'),
      /"Tarif complet" row not found once/,
    );
    refuses(
      page([
        section('tavi', {
          extraRows: '<tr><td>Tarif complet</td><td>1</td><td></td></tr>',
        }),
      ]),
      /"Tarif complet" row not found once/,
    );
  });

  it('an unreadable reference count', () => {
    refuses(page([section('tavi', { count: 'n/c' })]), /count unreadable/);
  });

  it('two CSV links in the "Tarif complet" row', () => {
    refuses(
      page([
        section('tavi', {
          links: `${link(csvHref('tavi'))}${link(csvHref('tavi', { idv: 12 }))}`,
        }),
      ]),
      /several CSV links/,
    );
  });

  it('a CSV link that is not a strict download URL', () => {
    refuses(
      page([section('tavi', { links: link(`${csvHref('tavi')}&amp;x=1`) })]),
      /CSV link not recognised/,
    );
  });

  it('a CSV link for another fiche or another publication', () => {
    refuses(
      page([section('tavi', { links: link(csvHref('tavi', { idt: 8 })) })]),
      /another fiche/,
    );
    refuses(
      page([section('tavi', { links: link(csvHref('tapr')) })]),
      /another publication/,
    );
  });

  it('a CSV link title that is unknown or disagrees with the protection', () => {
    refuses(
      page([section('tavi', { links: link(csvHref('tavi'), 'Voir') })]),
      /title not recognised/,
    );
    refuses(
      page([
        section('tavi', {
          links: link(csvHref('tavi'), 'Acc&egrave;s autoris&eacute;'),
        }),
      ]),
      /title and protection disagree/,
    );
    refuses(
      page([
        section('tavi', { links: link(csvHref('tavi', { protect: 'mdp' })) }),
      ]),
      /title and protection disagree/,
    );
  });
});

describe('parseGoldaDownloadUrl', () => {
  const ok = 'idt=7&idv=11&format=csv&type=tavi&protect=nomdp';

  it('reads a relative or absolute CSV download URL', () => {
    const want = { idt: 7, idv: 11, kind: 'tavi', protect: 'nomdp' };
    expect(parseGoldaDownloadUrl(`download.php?${ok}`)).toEqual(want);
    expect(
      parseGoldaDownloadUrl(`${GOLDA_ORIGIN}/tarifs/download.php?${ok}`),
    ).toEqual(want);
    expect(
      parseGoldaDownloadUrl(
        'download.php?protect=mdp&type=tapr&format=csv&idv=2&idt=3',
      ),
    ).toEqual({ idt: 3, idv: 2, kind: 'tapr', protect: 'mdp' });
  });

  it.each([
    ['an extra key', `download.php?${ok}&x=1`],
    ['a repeated key', `download.php?${ok}&idt=7`],
    ['a missing key', 'download.php?idt=7&idv=11&format=csv&type=tavi'],
    ['the Excel format', ok.replace('csv', 'xls')],
    ['a zero id', ok.replace('idt=7', 'idt=0')],
    ['a leading zero', ok.replace('idt=7', 'idt=07')],
    ['a decimal id', ok.replace('idv=11', 'idv=1.5')],
    ['an unknown type', ok.replace('tavi', 'tadel')],
    ['an unknown protection', ok.replace('nomdp', 'open')],
    ['another path', `/tarifs/fiche.php?${ok}`],
    ['a path outside /tarifs/', `../download.php?${ok}`],
    ['a hash', `download.php?${ok}#x`],
    ['another host', `https://golda.fr/tarifs/download.php?${ok}`],
    ['plain http', `http://www.golda.fr/tarifs/download.php?${ok}`],
  ])('refuses %s', (_why, href) => {
    const h = href.startsWith('idt=') ? `download.php?${href}` : href;
    expect(parseGoldaDownloadUrl(h)).toBeNull();
  });
});

describe('goldaCsvDownloadUrl / goldaFicheUrl', () => {
  it('rebuilds the download URL from validated values (round trip)', () => {
    const p = { idt: 7, idv: 11, kind: 'tapr', protect: 'mdp' } as const;
    const url = goldaCsvDownloadUrl(p);
    expect(url).toBe(
      `${GOLDA_ORIGIN}/tarifs/download.php?idt=7&idv=11&format=csv&type=tapr&protect=mdp`,
    );
    expect(parseGoldaDownloadUrl(url)).toEqual(p);
  });

  it('refuses ids that are not positive safe integers, and unknown values', () => {
    const p = { idt: 7, idv: 11, kind: 'tavi', protect: 'nomdp' } as const;
    for (const idt of [0, -1, 1.5, NaN, 2 ** 53])
      expect(() => goldaCsvDownloadUrl({ ...p, idt })).toThrow('invalid idt');
    expect(() =>
      goldaCsvDownloadUrl({ ...p, kind: 'x' as unknown as 'tavi' }),
    ).toThrow('invalid type');
    expect(() =>
      goldaCsvDownloadUrl({ ...p, protect: 'x' as unknown as 'mdp' }),
    ).toThrow('invalid protect');
  });

  it('builds the fiche URL, only for a positive integer', () => {
    expect(goldaFicheUrl(4321)).toBe(
      `${GOLDA_ORIGIN}/tarifs/fiche.php?id=4321`,
    );
    expect(() => goldaFicheUrl(0)).toThrow('invalid fiche id');
    expect(() => goldaFicheUrl(1.5)).toThrow('invalid fiche id');
  });
});

describe('goldaRequestVerdict — fail-closed allowlist', () => {
  const G = GOLDA_ORIGIN;
  const v = (
    url: string,
    method = 'GET',
    resourceType = 'document',
    phase: GoldaPhase = 'read',
  ) => goldaRequestVerdict({ url, method, resourceType }, phase);
  const DL = `${G}/tarifs/download.php?idt=7&idv=11&format=csv&type=tavi&protect=nomdp`;

  it('allows the two worker pages, in every phase', () => {
    for (const phase of ['anon', 'login', 'read'] as const) {
      expect(v(`${G}/espace-abonnes.php`, 'GET', 'document', phase)).toEqual({
        allowed: true,
      });
      expect(
        v(`${G}/tarifs/fiche.php?id=4321`, 'GET', 'document', phase),
      ).toEqual({ allowed: true });
    }
  });

  it('refuses every other page — account-writing links included', () => {
    for (const url of [
      `${G}/`,
      `${G}/espace-abonnes.php?action=x`,
      `${G}/tarifs/fiche.php?id=4321&del=1`,
      `${G}/tarifs/fiche.php?id=0`,
      `${G}/tarifs/fiche.php?id=4321#tapr`,
      `${G}/tarifs/autre.php?id=4321`,
      `${G}/compte/supprimer.php?id=4321`,
      `${G}/deconnexion.php`,
    ])
      expect(v(url)).toEqual({ allowed: false, reason: 'path' });
  });

  it('allows the credential POST only during the login phase', () => {
    expect(v(`${G}/js_treat_cx.php`, 'POST', 'xhr', 'login')).toEqual({
      allowed: true,
    });
    for (const phase of ['anon', 'read'] as const)
      expect(v(`${G}/js_treat_cx.php`, 'POST', 'xhr', phase)).toEqual({
        allowed: false,
        reason: 'write',
      });
    expect(v(`${G}/js_treat_cx.php?x=1`, 'POST', 'xhr', 'login')).toEqual({
      allowed: false,
      reason: 'write',
    });
    expect(
      v(`${G}/tarifs/fiche.php?id=4321`, 'POST', 'document', 'login'),
    ).toEqual({ allowed: false, reason: 'write' });
  });

  it('refuses every method other than GET and the login POST', () => {
    for (const method of ['PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
      expect(v(`${G}/espace-abonnes.php`, method)).toEqual({
        allowed: false,
        reason: 'method',
      });
  });

  it('allows a CSV download only after login and only for a strict download URL', () => {
    expect(v(DL, 'GET', 'download', 'read')).toEqual({ allowed: true });
    for (const phase of ['anon', 'login'] as const)
      expect(v(DL, 'GET', 'download', phase)).toEqual({
        allowed: false,
        reason: 'path',
      });
    expect(v(DL.replace('csv', 'xls'), 'GET', 'download')).toEqual({
      allowed: false,
      reason: 'path',
    });
    expect(v(DL, 'GET', 'document')).toEqual({
      allowed: false,
      reason: 'path',
    });
  });

  it('allows same-host static assets by type AND extension, without a query', () => {
    expect(v(`${G}/css/site.css`, 'GET', 'stylesheet')).toEqual({
      allowed: true,
    });
    expect(v(`${G}/js/jquery-ui.min.js`, 'GET', 'script')).toEqual({
      allowed: true,
    });
    expect(v(`${G}/img/logo.PNG`, 'GET', 'image')).toEqual({ allowed: true });
    expect(v(`${G}/fonts/a.woff2`, 'GET', 'font')).toEqual({ allowed: true });
    for (const [url, type] of [
      [`${G}/css/site.css?v=2`, 'stylesheet'],
      [`${G}/js/app.php`, 'script'],
      [`${G}/img/pixel.php?u=1`, 'image'],
    ])
      expect(v(url, 'GET', type)).toEqual({ allowed: false, reason: 'path' });
  });

  it('refuses XHR, fetch, beacons and other request types', () => {
    for (const type of [
      'xhr',
      'fetch',
      'ping',
      'websocket',
      'other',
      'manifest',
    ])
      expect(v(`${G}/espace-abonnes.php`, 'GET', type)).toEqual({
        allowed: false,
        reason: 'type',
      });
  });

  it('refuses other hosts, plain http and URLs carrying credentials', () => {
    for (const url of [
      'https://golda.fr/espace-abonnes.php',
      'https://www.golda.fr.example.test/espace-abonnes.php',
      'https://cdn.example.test/jquery.js',
      'http://www.golda.fr/espace-abonnes.php',
      'https://u:p@www.golda.fr/espace-abonnes.php',
      'not a url',
    ])
      expect(v(url)).toEqual({ allowed: false, reason: 'host' });
  });
});

describe('landing and logged-out URLs', () => {
  const G = GOLDA_ORIGIN;

  it('recognises where a navigation may land', () => {
    for (const url of [
      `${G}/espace-abonnes.php`,
      `${G}/tarifs/fiche.php?id=4321`,
      `${G}/`,
      `${G}/index.php`,
      `${G}/index.php?statut=notvalid`,
    ])
      expect(isGoldaLandingUrl(url)).toBe(true);
    for (const url of [
      `${G}/index.php?statut=autre`,
      `${G}/index.php#top`,
      `${G}/autre.php`,
      'https://golda.fr/',
    ])
      expect(isGoldaLandingUrl(url)).toBe(false);
  });

  it('recognises the logged-out landing only on the portal host', () => {
    expect(isGoldaLoggedOutUrl(`${G}/index.php?statut=notvalid`)).toBe(true);
    expect(isGoldaLoggedOutUrl(`${G}/x.php?a=1&statut=notvalid`)).toBe(true);
    expect(isGoldaLoggedOutUrl(`${G}/index.php`)).toBe(false);
    expect(isGoldaLoggedOutUrl(`${G}/index.php?statut=notvalidated`)).toBe(
      false,
    );
    expect(
      isGoldaLoggedOutUrl('https://golda.fr/index.php?statut=notvalid'),
    ).toBe(false);
  });
});

describe('parseGoldaFichePage — the page as the browser serializes it', () => {
  // The worker parses page.content(): raw UTF-8 accents and a <tbody> in each table,
  // where the fixtures above write entities and no <tbody>.
  const serialized = (html: string) =>
    html
      .replace(/&egrave;/g, 'è')
      .replace(/&agrave;/g, 'à')
      .replace(/&eacute;/g, 'é')
      .replace(/(<table\b[^>]*>)/g, '$1<tbody>')
      .replace(/<\/table>/g, '</tbody></table>');

  it('reads raw accents and <tbody> exactly like the entity forms', () => {
    const html = page([
      section('tavi', { updated: '20/02/2026' }),
      section('tapr', {
        links: link(
          csvHref('tapr', { idv: 12, protect: 'mdp' }),
          'Acc&egrave;s autoris&eacute;',
        ),
      }),
    ]);
    const raw = serialized(html);
    expect(raw).toContain('Dernière mise à jour');
    expect(raw).toContain('title="Télécharger"');
    expect(raw).toContain('title="Accès autorisé"');
    expect(raw).toContain('<tbody>');
    expect(raw).not.toMatch(/&(?:egrave|agrave|eacute);/);
    const parsed = parseGoldaFichePage(raw, FICHE);
    expect(parsed.publications.map((p) => [p.kind, p.lastUpdated])).toEqual([
      ['tavi', '2026-02-20'],
      ['tapr', null],
    ]);
    expect(parsed).toEqual(parseGoldaFichePage(html, FICHE));
  });
});

describe('goldaRequestVerdict — a static asset URL never reaches a script', () => {
  const v = (path: string, resourceType: string) =>
    goldaRequestVerdict(
      { url: `${GOLDA_ORIGIN}${path}`, method: 'GET', resourceType },
      'read',
    );

  it('refuses PATH_INFO and double-extension URLs', () => {
    for (const [path, type] of [
      ['/compte/supprimer.php/x.gif', 'image'],
      ['/deconnexion.php/a.js', 'script'],
      ['/compte/alerte.php/s.css', 'stylesheet'],
      ['/img/x.php.gif', 'image'],
      ['/img/a.b/x.gif', 'image'],
      ['/img/a%2ephp/x.gif', 'image'],
    ])
      expect(v(path, type)).toEqual({ allowed: false, reason: 'path' });
  });

  it('still allows nested asset folders and dotted file names', () => {
    for (const [path, type] of [
      ['/inc/css/theme/jquery-ui.custom.css', 'stylesheet'],
      ['/inc/js/plugin/jquery.plugin.min.js', 'script'],
      ['/images/pictos/a-b_c.gif', 'image'],
    ])
      expect(v(path, type)).toEqual({ allowed: true });
  });
});

describe('parseGoldaFichePage — an update date it cannot read is refused, never dropped', () => {
  it('refuses an update date separated from the first date by markup', () => {
    for (const pub of [
      'Date initiale de publication : 15/02/2026<br> - Derni&egrave;re mise &agrave; jour : 20/02/2026',
      'Date initiale de publication : 15/02/2026 <span>- Dernière mise à jour : 20/02/2026</span>',
    ])
      refuses(
        page([section('tavi')]).replace(
          'Date initiale de publication : 15/02/2026',
          pub,
        ),
        /tavi: update date not recognised/,
      );
  });

  it('reads a page whose free text mentions an update without the label', () => {
    const html = page([section('tavi')]).replace(
      '<table class="tarifs"',
      '<p><em>Mise &agrave; jour du tarif : nouveaut&eacute;s.</em></p><table class="tarifs"',
    );
    expect(parseGoldaFichePage(html, FICHE).publications[0].lastUpdated).toBe(
      null,
    );
  });
});

describe('parseGoldaFichePage — a next-tariff section it cannot read is refused, never skipped', () => {
  it('refuses a tapr section whose anchor is not the expected one', () => {
    for (const anchor of [
      '<a name="tapr" id="tapr"></a>',
      '<a id="tapr"></a>',
      '<a name=tapr></a>',
      '',
    ])
      refuses(
        page([
          section('tavi'),
          section('tapr').replace('<a name="tapr"></a>', anchor),
        ]),
        /tapr: section not recognised/,
      );
  });

  it('refuses a stray tapr anchor even without the next-tariff heading', () => {
    for (const anchor of [
      '<a id="tapr"></a>',
      '<a name=tapr></a>',
      '<a name="TAPR"></a>',
    ])
      refuses(page([section('tavi'), anchor]), /tapr: section not recognised/);
  });
});
