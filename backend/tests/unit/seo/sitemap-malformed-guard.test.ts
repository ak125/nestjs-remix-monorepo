import {
  normalizeAlias,
  normalizeTypeAlias,
  isMalformedSeoUrl,
} from '../../../src/common/utils/url-builder.utils';

// Mirrors the sitemap services' type-segment hardening (buildPieceUrl):
// normalizeTypeAlias collapses null/"type"/alias==id, then normalizeAlias
// slugifies — identical output to legacy for valid rows.
function typeSegment(alias: string, id: string): string {
  return normalizeAlias(normalizeTypeAlias(alias, null, id));
}

describe('sitemap type-segment hardening + defense-in-depth guard', () => {
  it('skips malformed rows, keeps and slugifies valid ones', () => {
    const rows = [
      { alias: 'null', id: '100060' }, // -> type-100060 -> skip
      { alias: '122813', id: '122813' }, // alias==id -> type-122813 -> skip
      { alias: 'type', id: '7379' }, // -> type-7379 -> skip
      { alias: '2.0 tdi', id: '200199' }, // valid -> 20-tdi-200199 (slugified)
    ];
    const emitted: string[] = [];
    let skipped = 0;
    for (const r of rows) {
      const url = `/pieces/filtre-a-air-8/audi-22/a6-iv-22057/${typeSegment(r.alias, r.id)}-${r.id}.html`;
      if (isMalformedSeoUrl(url)) {
        skipped++;
        continue;
      }
      emitted.push(url);
    }
    expect(skipped).toBe(3);
    expect(emitted).toEqual([
      '/pieces/filtre-a-air-8/audi-22/a6-iv-22057/20-tdi-200199.html',
    ]);
  });
});
