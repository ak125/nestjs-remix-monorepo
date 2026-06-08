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
    ({ marque, mrq } as SearchRow);
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
    } as SearchRow);

  it('EAN-first lock (brand-checked)', () => {
    const rows = [
      mk({ code: 'SBS1', refFournisseur: '1', marque: 'NK', ean: 'E1', dispoType: 'ag' }),
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
      mk({ code: 'SBS1', refFournisseur: '1', marque: 'NK', ean: 'EY', dispoType: 'ag' }),
    ];
    const { row, kind } = matchBrandRow(rows, '1', 'EX', NK);
    expect(kind).toBe('REF_BRAND');
    expect(row?.code).toBe('SBS1');
  });

  it('REF_BRAND when no feed EAN but a single NK SKU', () => {
    const rows = [mk({ code: 'SBS1', refFournisseur: '9', marque: 'NK', dispoType: 'grp' })];
    expect(matchBrandRow(rows, '9', null, NK).kind).toBe('REF_BRAND');
  });

  it('REF_BRAND_AMBIGUOUS when no EAN lock and several NK SKUs share the ref', () => {
    const rows = [
      mk({ code: 'SBS1', refFournisseur: '9', marque: 'NK', dispoType: 'ag' }),
      mk({ code: 'SBS2', refFournisseur: '9', marque: 'SBS', dispoType: 'grp' }),
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
    ({ dispoType: dispo, icon } as SearchRow);

  it('ag + vert → CONFIRMED_AG', () => {
    expect(classifyForActivation(row('ag', '/stock/vert.png')).bucket).toBe('CONFIRMED_AG');
  });
  it('grp + vert+ → CONFIRMED_GRP', () => {
    expect(classifyForActivation(row('grp', '/stock/vert+.png')).bucket).toBe('CONFIRMED_GRP');
  });
  it('ag WITHOUT a green icon → REVIEW_NO_SIGNAL (never auto-sell on dispo alone)', () => {
    expect(classifyForActivation(row('ag', '/stock/orange.png')).bucket).toBe('REVIEW_NO_SIGNAL');
    expect(classifyForActivation(row('grp', null)).bucket).toBe('REVIEW_NO_SIGNAL');
  });
  it('ag + rouge → REVIEW_CONTRADICTION', () => {
    expect(classifyForActivation(row('ag', '/stock/rouge.png')).bucket).toBe('REVIEW_CONTRADICTION');
  });
  it('none + (rouge/none) → BLOCK_NONE', () => {
    expect(classifyForActivation(row('none', '/stock/rouge.png')).bucket).toBe('BLOCK_NONE');
    expect(classifyForActivation(row('none', null)).bucket).toBe('BLOCK_NONE');
  });
  it('none + green → REVIEW_CONTRADICTION (mis-block guard)', () => {
    expect(classifyForActivation(row('none', '/stock/vert.png')).bucket).toBe('REVIEW_CONTRADICTION');
  });
  it('arrivage → REVIEW_ARRIVAGE (never auto-PREORDER)', () => {
    expect(classifyForActivation(row('arrivage', '/stock/transport.png')).bucket).toBe('REVIEW_ARRIVAGE');
  });
  it('unknown dispo + rouge → BLOCK_NONE; unknown dispo + other → REVIEW_NO_SIGNAL', () => {
    expect(classifyForActivation(row(null, '/stock/rouge.png')).bucket).toBe('BLOCK_NONE');
    expect(classifyForActivation(row(null, '/stock/orange.png')).bucket).toBe('REVIEW_NO_SIGNAL');
  });
});

describe('verdictForRef (end-to-end)', () => {
  const articleHtml = (o: ArtOpts, icon: string): string =>
    articleTr(o) + iconImg(o.code, icon);

  it('CONFIRMED via EAN lock + green', () => {
    const rows = parseSearchHtml(
      articleHtml({ code: 'SBS1', ref: '1', marque: 'NK', ean: 'E1', dispo: 'ag', prix: '8.5' }, 'vert'),
    );
    const v = verdictForRef(rows, '1', 'E1', NK);
    expect(v.bucket).toBe('CONFIRMED_AG');
    expect(v.matchKind).toBe('EAN');
    expect(v.portalPrix).toBe(8.5);
  });

  it('ambiguous ref+brand match holds a would-be CONFIRMED in REVIEW_NO_EAN', () => {
    const rows = parseSearchHtml(
      articleHtml({ code: 'SBS1', ref: '9', marque: 'NK', dispo: 'ag' }, 'vert') +
        articleHtml({ code: 'SBS2', ref: '9', marque: 'NK', dispo: 'grp' }, 'vert+'),
    );
    const v = verdictForRef(rows, '9', null, NK);
    expect(v.matchKind).toBe('REF_BRAND_AMBIGUOUS');
    expect(v.bucket).toBe('REVIEW_NO_EAN');
    expect(v.reason).toContain('ref_brand_ambiguous');
  });

  it('FALSE_MATCH → REVIEW_FALSE_MATCH, NOT_FOUND → REVIEW_NOT_FOUND', () => {
    const rows = parseSearchHtml(articleHtml({ code: 'V1', ref: '5', marque: 'VALEO' }, 'vert'));
    expect(verdictForRef(rows, '5', null, NK).bucket).toBe('REVIEW_FALSE_MATCH');
    expect(verdictForRef(rows, 'absent', null, NK).bucket).toBe('REVIEW_NOT_FOUND');
  });

  it('BLOCK_NONE → would map to pri_dispo 0 (rupture)', () => {
    const rows = parseSearchHtml(
      articleHtml({ code: 'SBS1', ref: '1', marque: 'NK', ean: 'E1', dispo: 'none' }, 'rouge'),
    );
    expect(verdictForRef(rows, '1', 'E1', NK).bucket).toBe('BLOCK_NONE');
  });
});
