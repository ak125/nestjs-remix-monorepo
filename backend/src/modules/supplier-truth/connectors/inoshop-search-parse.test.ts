import {
  parseSearchHtml,
  isBrandRow,
  brandTokenSet,
  matchBrandRow,
  classifyForActivation,
  verdictForRef,
  type SearchRow,
} from './inoshop-search-parse';

// --- HTML fixture helpers (mirror the captured `POST /search` schema) ---
interface ArtOpts {
  code: string;
  ref?: string;
  marque?: string;
  mrq?: string;
  ean?: string;
  prix?: string;
  stock?: string;
  dispo?: string;
  lib?: string;
  sfam?: string;
}
function articleTr(o: ArtOpts): string {
  return (
    `<tr class="ARTICLE ARTICLE_CONTENT" id="art_${o.code}" ` +
    `data-Filtrecodearticle="${o.code}" ` +
    `data-Filtrecodearticlefournisseur="${o.ref ?? ''}" ` +
    `data-Filtremarques="${o.marque ?? ''}" ` +
    `data-Filtremrq="${o.mrq ?? ''}" ` +
    `data-ean="${o.ean ?? ''}" ` +
    `data-prix="${o.prix ?? ''}" ` +
    `data-stock="${o.stock ?? ''}" ` +
    `data-dispo-type="${o.dispo ?? ''}" ` +
    `data-Filtrelibelle="${o.lib ?? ''}" ` +
    `data-Filtresous-familles-lib="${o.sfam ?? ''}">` +
    `<td>cell</td></tr>`
  );
}
/** the availability icon img, structurally bound to a code via `icone-dispo-<code>`. */
function iconImg(code: string, state: string): string {
  return `<img class="icone-dispo-${code}" src="/img/stock/${state}.png" alt="">`;
}

const NK = brandTokenSet({ tokens: ['NK', 'SBS'] });

describe('parseSearchHtml', () => {
  it('extracts data-* fields and binds the icon structurally by code', () => {
    const html =
      articleTr({
        code: 'SBS251908',
        ref: '251908',
        marque: 'NK',
        mrq: 'SBS',
        ean: '3660034251908',
        prix: '15.24',
        stock: '3',
        dispo: 'grp',
        lib: 'FILTRE',
        sfam: 'FI',
      }) + iconImg('SBS251908', 'vert+');
    const rows = parseSearchHtml(html);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.code).toBe('SBS251908');
    expect(r.refFournisseur).toBe('251908');
    expect(r.marque).toBe('NK');
    expect(r.mrq).toBe('SBS');
    expect(r.ean).toBe('3660034251908');
    expect(r.prix).toBe(15.24);
    expect(r.stockRaw).toBe('3'); // kept for audit, not used in decision
    expect(r.dispoType).toBe('grp');
    expect(r.icon).toBe('/stock/vert+.png');
  });

  it('dedups by code and merges richer signal across duplicate rows', () => {
    // main row carries dispo, a second (responsive) row only carries the ean
    const html =
      articleTr({ code: 'SBS1', ref: '1', marque: 'NK', dispo: 'ag' }) +
      articleTr({ code: 'SBS1', ref: '1', marque: 'NK', ean: '999' }) +
      iconImg('SBS1', 'vert');
    const rows = parseSearchHtml(html);
    expect(rows).toHaveLength(1);
    expect(rows[0].dispoType).toBe('ag');
    expect(rows[0].ean).toBe('999');
    expect(rows[0].icon).toBe('/stock/vert.png');
  });

  it('does not bind an entity-escaped legend img to a real article code', () => {
    // legend palette is HTML-entity escaped → its src=" is &quot; → never matched
    const legend =
      '&lt;img class=&quot;icone-dispo-LEGENDVERT&quot; src=&quot;/img/stock/vert.png&quot;&gt;';
    const html =
      legend +
      articleTr({ code: 'SBS2', ref: '2', marque: 'NK', dispo: 'none' }) +
      iconImg('SBS2', 'rouge');
    const rows = parseSearchHtml(html);
    expect(rows).toHaveLength(1);
    expect(rows[0].icon).toBe('/stock/rouge.png'); // its own icon, not the legend's
  });

  it('ignores non-ARTICLE rows', () => {
    const html =
      '<tr class="HEADER"><td>h</td></tr>' +
      articleTr({ code: 'SBS3', ref: '3', marque: 'NK' });
    expect(parseSearchHtml(html)).toHaveLength(1);
  });
});

describe('isBrandRow', () => {
  const row = (marque: string | null, mrq: string | null): SearchRow =>
    ({ marque, mrq }) as SearchRow;
  it('matches on brand label', () => {
    expect(isBrandRow(row('NK', null), NK)).toBe(true);
  });
  it('matches on short code (NK ⇒ SBS)', () => {
    expect(isBrandRow(row(null, 'SBS'), NK)).toBe(true);
  });
  it('is case-insensitive', () => {
    expect(isBrandRow(row('nk', null), NK)).toBe(true);
  });
  it('rejects other brands', () => {
    expect(isBrandRow(row('VALEO', 'VAL'), NK)).toBe(false);
  });
  it('rejects empty brand fields', () => {
    expect(isBrandRow(row('', ''), NK)).toBe(false);
  });
  it('generalizes to any brand token set (MECAFILTER)', () => {
    const mefi = brandTokenSet({ tokens: ['MECAFILTER', 'MEFI'] });
    expect(isBrandRow(row('MECAFILTER', null), mefi)).toBe(true);
    expect(isBrandRow(row(null, 'MEFI'), mefi)).toBe(true);
    expect(isBrandRow(row('NK', 'SBS'), mefi)).toBe(false);
  });
});

describe('matchBrandRow', () => {
  const mk = (o: Partial<SearchRow>): SearchRow =>
    ({
      code: o.code ?? 'C',
      refFournisseur: o.refFournisseur ?? null,
      marque: o.marque ?? null,
      mrq: o.mrq ?? null,
      ean: o.ean ?? null,
      prix: o.prix ?? null,
      stockRaw: null,
      dispoType: o.dispoType ?? null,
      libelle: null,
      sousFamille: null,
      icon: o.icon ?? null,
    }) as SearchRow;

  it('EAN-first lock (brand-checked)', () => {
    const rows = [
      mk({
        code: 'SBS1',
        refFournisseur: '1',
        marque: 'NK',
        ean: 'E1',
        dispoType: 'ag',
      }),
      mk({ code: 'V1', refFournisseur: '1', marque: 'VALEO', ean: 'E2' }),
    ];
    const { row, kind } = matchBrandRow(rows, '1', 'E1', NK);
    expect(kind).toBe('EAN');
    expect(row?.code).toBe('SBS1');
  });

  it('cross-brand EAN anomaly → falls through to ref+brand, never locks foreign brand', () => {
    // feed EAN matches only a VALEO row; our NK row shares the ref but not the EAN
    const rows = [
      mk({ code: 'V1', refFournisseur: '1', marque: 'VALEO', ean: 'EX' }),
      mk({
        code: 'SBS1',
        refFournisseur: '1',
        marque: 'NK',
        ean: 'EY',
        dispoType: 'ag',
      }),
    ];
    const { row, kind } = matchBrandRow(rows, '1', 'EX', NK);
    expect(kind).toBe('REF_BRAND');
    expect(row?.code).toBe('SBS1');
  });

  it('REF_BRAND when no feed EAN but a single NK SKU', () => {
    const rows = [
      mk({ code: 'SBS1', refFournisseur: '9', marque: 'NK', dispoType: 'grp' }),
    ];
    expect(matchBrandRow(rows, '9', null, NK).kind).toBe('REF_BRAND');
  });

  it('REF_BRAND_AMBIGUOUS when no EAN lock and several NK SKUs share the ref', () => {
    const rows = [
      mk({ code: 'SBS1', refFournisseur: '9', marque: 'NK', dispoType: 'ag' }),
      mk({
        code: 'SBS2',
        refFournisseur: '9',
        marque: 'SBS',
        dispoType: 'grp',
      }),
    ];
    expect(matchBrandRow(rows, '9', null, NK).kind).toBe('REF_BRAND_AMBIGUOUS');
  });

  it('FALSE_MATCH when the ref exists only under other brands', () => {
    const rows = [mk({ code: 'V1', refFournisseur: '5', marque: 'VALEO' })];
    const { row, kind } = matchBrandRow(rows, '5', null, NK);
    expect(kind).toBe('FALSE_MATCH');
    expect(row).toBeNull();
  });

  it('NOT_FOUND when the ref is absent entirely', () => {
    const rows = [mk({ code: 'SBS1', refFournisseur: '1', marque: 'NK' })];
    expect(matchBrandRow(rows, 'absent', null, NK).kind).toBe('NOT_FOUND');
  });
});

describe('classifyForActivation (no-false-in-stock invariant)', () => {
  const row = (dispo: string | null, icon: string | null): SearchRow =>
    ({ dispoType: dispo, icon }) as SearchRow;

  it('ag + vert → CONFIRMED_AG', () => {
    expect(classifyForActivation(row('ag', '/stock/vert.png')).bucket).toBe(
      'CONFIRMED_AG',
    );
  });
  it('grp + vert+ → CONFIRMED_GRP', () => {
    expect(classifyForActivation(row('grp', '/stock/vert+.png')).bucket).toBe(
      'CONFIRMED_GRP',
    );
  });
  it('ag WITHOUT a green icon → REVIEW_NO_SIGNAL (never auto-sell on dispo alone)', () => {
    expect(classifyForActivation(row('ag', '/stock/orange.png')).bucket).toBe(
      'REVIEW_NO_SIGNAL',
    );
    expect(classifyForActivation(row('grp', null)).bucket).toBe(
      'REVIEW_NO_SIGNAL',
    );
  });
  it('ag + rouge → REVIEW_CONTRADICTION', () => {
    expect(classifyForActivation(row('ag', '/stock/rouge.png')).bucket).toBe(
      'REVIEW_CONTRADICTION',
    );
  });
  it('none + (rouge/none) → BLOCK_NONE', () => {
    expect(classifyForActivation(row('none', '/stock/rouge.png')).bucket).toBe(
      'BLOCK_NONE',
    );
    expect(classifyForActivation(row('none', null)).bucket).toBe('BLOCK_NONE');
  });
  it('none + green → REVIEW_CONTRADICTION (mis-block guard)', () => {
    expect(classifyForActivation(row('none', '/stock/vert.png')).bucket).toBe(
      'REVIEW_CONTRADICTION',
    );
  });
  it('arrivage → REVIEW_ARRIVAGE (never auto-PREORDER)', () => {
    expect(
      classifyForActivation(row('arrivage', '/stock/transport.png')).bucket,
    ).toBe('REVIEW_ARRIVAGE');
  });
  it('unknown dispo + rouge → BLOCK_NONE; unknown dispo + other → REVIEW_NO_SIGNAL', () => {
    expect(classifyForActivation(row(null, '/stock/rouge.png')).bucket).toBe(
      'BLOCK_NONE',
    );
    expect(classifyForActivation(row(null, '/stock/orange.png')).bucket).toBe(
      'REVIEW_NO_SIGNAL',
    );
  });
});

describe('icon legend (hashed icon file names)', () => {
  // synthetic hashed file names: mixed case, digits, and none of the state words
  const HASHED = 'Ab12Cd34Ef56';
  const H = HASHED.toLowerCase();
  const OTHER = 'Pq78Rs90Tu12';
  const escapeOnce = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const legendEntry = (type: string, file: string | null): string =>
    `<div class="d-inline-flex align-items-center py-1" data-icon-type="${type}">` +
    `<div style="max-width: 24px;">` +
    (file ? `<img class="w-100" src="/img/stock/${file}.png"/>` : '') +
    `</div><span class="ml-2">label</span></div>`;
  /** the legend as the portal ships it: inside a tooltip attribute, escaped `depth` times. */
  const legendTooltip = (entries: string, depth = 1): string => {
    let s = entries;
    for (let i = 0; i < depth; i++) s = escapeOnce(s);
    return `<span data-toggle="tooltip" data-html="true" data-original-title="${s}">?</span>`;
  };
  const rowHtml = (dispo: string, file: string): string =>
    articleTr({ code: 'X1', ref: '1', marque: 'NK', ean: 'E1', dispo }) +
    iconImg('X1', file);
  const rowOf = (legend: string, dispo = 'grp', file = HASHED): SearchRow =>
    parseSearchHtml(legend + rowHtml(dispo, file))[0];
  const GRP_LEGEND = legendTooltip(
    legendEntry('ag', 'vert') + legendEntry('grp', HASHED),
  );
  // the portal's legend shape: named files, one hashed file, orange+ drawn for 4 types
  const PORTAL_LEGEND = legendTooltip(
    [
      ['ag', 'vert'],
      ['agpart', 'orange'],
      ['agvirt', 'orange+'],
      ['agvirtpart', 'orange+'],
      ['grp', HASHED],
      ['grppart', 'orange+'],
      ['nonecmd', 'orange+'],
      ['none', 'rouge'],
      ['fourn', 'transport'],
      ['partner', 'partner'],
      ['noref', 'gris'],
    ]
      .map(([type, file]) => legendEntry(type, file))
      .join(''),
  );

  it('captures a hashed icon file name (digits included)', () => {
    expect(rowOf('').icon).toBe(`/stock/${H}.png`);
  });

  it.each([1, 2, 3])(
    'binds the file to its legend type at escaping depth %i',
    (depth) => {
      const legend = legendTooltip(
        legendEntry('ag', 'vert') + legendEntry('grp', HASHED),
        depth,
      );
      const rows = parseSearchHtml(legend + rowHtml('grp', HASHED));
      expect(rows).toHaveLength(1); // the legend images never become rows or row icons
      expect(rows[0].iconType).toBe('grp');
    },
  );

  it('reads the legend only inside its tooltip attribute, never the page', () => {
    // a typed entry in the page body, and a row icon wrapped in an element typed
    // with the row's dispo: neither is the legend, which binds the file to none
    const html =
      legendEntry('grp', HASHED) +
      legendTooltip(legendEntry('none', HASHED)) +
      articleTr({
        code: 'X1',
        ref: '1',
        marque: 'NK',
        ean: 'E1',
        dispo: 'grp',
      }) +
      `<div data-icon-type="grp">${iconImg('X1', HASHED)}</div>`;
    const r = parseSearchHtml(html)[0];
    expect(r.iconType).toBe('none');
    const c = classifyForActivation(r);
    expect(c.bucket).toBe('REVIEW_CONTRADICTION');
    expect(c.reason).toBe('grp+rouge [legend:none]');
    expect(rowOf(legendEntry('grp', HASHED)).iconType).toBeNull();
  });

  it('decodes numeric entities (&#60; &#62; &#34;)', () => {
    const legend = legendTooltip(
      legendEntry('grp', HASHED) + legendEntry('grppart', OTHER),
    )
      .replace(/&lt;/g, '&#60;')
      .replace(/&gt;/g, '&#62;')
      .replace(/&quot;/g, '&#34;');
    expect(rowOf(legend, 'grp', OTHER).iconType).toBe('grppart');
    expect(rowOf(legend).iconType).toBe('grp');
  });

  it('binds each entry to the image inside it, whatever comes before', () => {
    // an image-less typed element, then a typed entry holding nested wrappers
    const legend = legendTooltip(
      `<span data-icon-type="grp">label</span>` +
        `<div data-icon-type="grppart"><div class="w"><div>` +
        `<img src="/img/stock/${OTHER}.png"/></div></div></div>`,
    );
    expect(rowOf(legend, 'grp', OTHER).iconType).toBe('grppart');
  });

  it('an image outside its typed element binds nothing', () => {
    const imgFirst = (type: string, file: string): string =>
      `<div><img src="/img/stock/${file}.png"/><span data-icon-type="${type}">x</span></div>`;
    const legend = legendTooltip(
      imgFirst('grp', HASHED) + imgFirst('grppart', OTHER),
    );
    expect(rowOf(legend).iconType).toBeNull();
    expect(rowOf(legend, 'grp', OTHER).iconType).toBeNull();
  });

  it('binds nothing from an entry holding two images', () => {
    const legend = legendTooltip(
      `<div data-icon-type="grp"><img src="/img/stock/${HASHED}.png"/>` +
        `<img src="/img/stock/${OTHER}.png"/></div>`,
    );
    expect(rowOf(legend).iconType).toBeNull();
    expect(rowOf(legend, 'grp', OTHER).iconType).toBeNull();
  });

  it('binds nothing from a holder whose typed element never closes', () => {
    const legend = legendTooltip(
      `<div data-icon-type="grp"><img src="/img/stock/${HASHED}.png"/>` +
        legendEntry('grppart', OTHER),
    );
    expect(rowOf(legend).iconType).toBeNull();
    expect(rowOf(legend, 'grp', OTHER).iconType).toBeNull();
  });

  it('binds nothing from a holder nested deeper than the portal ever does', () => {
    const nested = (n: number): string =>
      legendTooltip(
        '<div>'.repeat(n) + legendEntry('grp', HASHED) + '</div>'.repeat(n),
      );
    expect(rowOf(nested(5)).iconType).toBe('grp');
    expect(rowOf(nested(40)).iconType).toBeNull();
  });

  it('drops a file bound to several types, in one legend or across two', () => {
    const one = legendTooltip(
      legendEntry('agvirt', HASHED) +
        legendEntry('grppart', HASHED) +
        legendEntry('grp', null),
    );
    expect(rowOf(one).iconType).toBeNull();
    const two =
      legendTooltip(legendEntry('grp', HASHED)) +
      legendTooltip(legendEntry('none', HASHED), 2);
    expect(rowOf(two).iconType).toBeNull();
  });

  it('captures and binds a file name with - _ . % and a query string', () => {
    const F = 'a1-B2_c3.v2%3D';
    const legend = legendTooltip(
      legendEntry('grp', F).replace(`${F}.png`, `${F}.png?v=1`),
    );
    const html =
      legend +
      articleTr({
        code: 'X1',
        ref: '1',
        marque: 'NK',
        ean: 'E1',
        dispo: 'grp',
      }) +
      `<img class="icone-dispo-X1" src="/img/stock/${F}.png?v=1" alt="">`;
    const r = parseSearchHtml(html)[0];
    expect(r.icon).toBe('/stock/a1-b2_c3.v2%3d.png');
    expect(r.iconType).toBe('grp');
  });

  it('normalises an upper-case legend type', () => {
    const c = classifyForActivation(
      rowOf(legendTooltip(legendEntry('GRP', HASHED))),
    );
    expect(c.bucket).toBe('CONFIRMED_GRP');
    expect(c.reason).toBe('grp/vert+ [legend:grp]');
  });

  it('grp + hashed file the legend binds to grp → CONFIRMED_GRP, reason names the legend', () => {
    const c = classifyForActivation(rowOf(GRP_LEGEND));
    expect(c.bucket).toBe('CONFIRMED_GRP');
    expect(c.reason).toBe('grp/vert+ [legend:grp]');
    expect(c.icon).toBe('vert+');
  });

  it('portal-shaped legend: named files keep their plain reason', () => {
    const at = (dispo: string, file: string) =>
      classifyForActivation(rowOf(PORTAL_LEGEND, dispo, file));
    expect(at('grp', HASHED)).toEqual({
      bucket: 'CONFIRMED_GRP',
      reason: 'grp/vert+ [legend:grp]',
      icon: 'vert+',
    });
    expect(at('ag', 'vert')).toEqual({
      bucket: 'CONFIRMED_AG',
      reason: 'ag/vert',
      icon: 'vert',
    });
    expect(at('none', 'rouge')).toEqual({
      bucket: 'BLOCK_NONE',
      reason: 'none/rouge',
      icon: 'rouge',
    });
    // orange+ is drawn for several types: the legend drops it, the name still reads
    expect(rowOf(PORTAL_LEGEND, 'grp', 'orange+').iconType).toBeNull();
    expect(at('grp', 'orange+').reason).toBe('grp+noncorrob:orange+');
  });

  it('a file name and a legend that disagree → REVIEW_CONTRADICTION, never confirmed nor blocked', () => {
    const at = (dispo: string | null, file: string, type: string) =>
      classifyForActivation({
        dispoType: dispo,
        icon: `/stock/${file}.png`,
        iconType: type,
      } as SearchRow);
    expect(at('grp', 'rouge', 'grp')).toEqual({
      bucket: 'REVIEW_CONTRADICTION',
      reason: 'grp+conflict(rouge.png vs legend:grp)',
      icon: 'unknown',
    });
    expect(at('ag', 'vert', 'none').reason).toBe(
      'ag+conflict(vert.png vs legend:none)',
    );
    expect(at('none', 'vert', 'none').reason).toBe(
      'none+conflict(vert.png vs legend:none)',
    );
    expect(at(null, 'rouge', 'ag').reason).toBe(
      'nodispo+conflict(rouge.png vs legend:ag)',
    );
    for (const [d, f, t] of [
      ['ag', 'vert', 'none'],
      ['none', 'vert', 'none'],
      ['arrivage', 'transport', 'grp'],
      [null, 'rouge', 'ag'],
    ] as const)
      expect(at(d, f, t).bucket).toBe('REVIEW_CONTRADICTION');
  });

  it('a hashed name containing a state word is not read as that state', () => {
    const F = 'Q7vErTz9';
    expect(classifyForActivation(rowOf('', 'ag', F))).toEqual({
      bucket: 'REVIEW_NO_SIGNAL',
      reason: 'ag+noncorrob:unknown(q7vertz9.png)',
      icon: 'unknown',
    });
    const c = classifyForActivation(
      rowOf(legendTooltip(legendEntry('none', F)), 'ag', F),
    );
    expect(c.bucket).toBe('REVIEW_CONTRADICTION');
    expect(c.reason).toBe('ag+rouge [legend:none]');
  });

  it('hashed file without a legend → every reason names the file', () => {
    const at = (dispo: string) => classifyForActivation(rowOf('', dispo));
    expect(at('grp')).toEqual({
      bucket: 'REVIEW_NO_SIGNAL',
      reason: `grp+noncorrob:unknown(${H}.png)`,
      icon: 'unknown',
    });
    expect(at('arrivage')).toEqual({
      bucket: 'REVIEW_ARRIVAGE',
      reason: `arrivage/unknown(${H}.png)`,
      icon: 'unknown',
    });
    expect(at('none')).toEqual({
      bucket: 'BLOCK_NONE',
      reason: `none/unknown(${H}.png)`,
      icon: 'unknown',
    });
    expect(at('')).toEqual({
      bucket: 'REVIEW_NO_SIGNAL',
      reason: `dispo='' icon=unknown(${H}.png)`,
      icon: 'unknown',
    });
  });

  // the state each type's named legend file draws on the pages captured 2026-10-13
  it.each([
    ['ag', 'vert'],
    ['agpart', 'orange'],
    ['agvirt', 'orange+'],
    ['agvirtpart', 'orange+'],
    ['grp', 'vert+'],
    ['grppart', 'orange+'],
    ['nonecmd', 'orange+'],
    ['none', 'rouge'],
    ['fourn', 'transport'],
    ['partner', 'partner'],
    ['noref', 'gris'],
  ])(
    'hashed file bound to %s reads %s; an ag/grp row confirms only on green',
    (type, state) => {
      const legend = legendTooltip(legendEntry(type, HASHED));
      for (const dispo of ['ag', 'grp']) {
        const c = classifyForActivation(rowOf(legend, dispo));
        expect(c.icon).toBe(state);
        expect(c.bucket.startsWith('CONFIRMED')).toBe(
          state === 'vert' || state === 'vert+',
        );
      }
    },
  );

  it('a legend type without a bound icon never confirms', () => {
    const c = classifyForActivation({
      dispoType: 'grp',
      icon: null,
      iconType: 'grp',
    } as SearchRow);
    expect(c.bucket).toBe('REVIEW_NO_SIGNAL');
    expect(c.icon).toBe('unknown');
  });

  it('a legend type outside the known vocabulary resolves to nothing', () => {
    for (const t of ['mystery', 'constructor', '__proto__']) {
      const c = classifyForActivation({
        dispoType: 'grp',
        icon: `/stock/${HASHED}.png`,
        iconType: t,
      } as SearchRow);
      expect(c.bucket).toBe('REVIEW_NO_SIGNAL');
      expect(c.icon).toBe('unknown');
    }
  });

  it('end-to-end: EAN-locked grp row with a hashed icon → CONFIRMED_GRP', () => {
    const v = verdictForRef(
      parseSearchHtml(GRP_LEGEND + rowHtml('grp', HASHED)),
      '1',
      'E1',
      NK,
    );
    expect(v.bucket).toBe('CONFIRMED_GRP');
    expect(v.matchKind).toBe('EAN');
    expect(v.icon).toBe('vert+');
  });
});

describe('verdictForRef (end-to-end)', () => {
  const articleHtml = (o: ArtOpts, icon: string): string =>
    articleTr(o) + iconImg(o.code, icon);

  it('CONFIRMED via EAN lock + green', () => {
    const rows = parseSearchHtml(
      articleHtml(
        {
          code: 'SBS1',
          ref: '1',
          marque: 'NK',
          ean: 'E1',
          dispo: 'ag',
          prix: '8.5',
        },
        'vert',
      ),
    );
    const v = verdictForRef(rows, '1', 'E1', NK);
    expect(v.bucket).toBe('CONFIRMED_AG');
    expect(v.matchKind).toBe('EAN');
    expect(v.portalPrix).toBe(8.5);
  });

  it('ambiguous ref+brand match holds a would-be CONFIRMED in REVIEW_NO_EAN', () => {
    const rows = parseSearchHtml(
      articleHtml(
        { code: 'SBS1', ref: '9', marque: 'NK', dispo: 'ag' },
        'vert',
      ) +
        articleHtml(
          { code: 'SBS2', ref: '9', marque: 'NK', dispo: 'grp' },
          'vert+',
        ),
    );
    const v = verdictForRef(rows, '9', null, NK);
    expect(v.matchKind).toBe('REF_BRAND_AMBIGUOUS');
    expect(v.bucket).toBe('REVIEW_NO_EAN');
    expect(v.reason).toContain('ref_brand_ambiguous');
  });

  it('FALSE_MATCH → REVIEW_FALSE_MATCH, NOT_FOUND → REVIEW_NOT_FOUND', () => {
    const rows = parseSearchHtml(
      articleHtml({ code: 'V1', ref: '5', marque: 'VALEO' }, 'vert'),
    );
    expect(verdictForRef(rows, '5', null, NK).bucket).toBe(
      'REVIEW_FALSE_MATCH',
    );
    expect(verdictForRef(rows, 'absent', null, NK).bucket).toBe(
      'REVIEW_NOT_FOUND',
    );
  });

  it('BLOCK_NONE → would map to pri_dispo 0 (rupture)', () => {
    const rows = parseSearchHtml(
      articleHtml(
        { code: 'SBS1', ref: '1', marque: 'NK', ean: 'E1', dispo: 'none' },
        'rouge',
      ),
    );
    expect(verdictForRef(rows, '1', 'E1', NK).bucket).toBe('BLOCK_NONE');
  });
});
