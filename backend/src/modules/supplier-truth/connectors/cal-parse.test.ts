import {
  calLookupToObservation,
  calVerdictForRef,
  isCalBrandItem,
  isCalLineConsistent,
  isCalStockIconPlaceholder,
  matchCalItem,
  normalizeCalRef,
  parseCalAutocomplete,
  type CalArticleRow,
  type CalAutocompleteItem,
  type CalLookup,
} from './cal-parse';
import { brandTokenSet } from './inoshop-search-parse';

// --- fixtures (shape of the live `/CallWS.aspx?origine=autocomplete` JSONP) ---
const item = (
  key: string,
  ref: string,
  marq: string | null,
  codemarq: string | null,
): CalAutocompleteItem => ({ key, ref, marq, codemarq });

const ACME = brandTokenSet({ tokens: ['ACME', 'ACME MOTOR PARTS'] });
const NONE = new Set<string>();

const ICON = (n: string) => `/app_themes/cyber_CAL92/img/ico_dispo${n}.png`;
const PLACEHOLDER = '/app_themes/cyber_CAL92/img/ico_disposearch.gif';

const row = (o: Partial<CalArticleRow> = {}): CalArticleRow => ({
  marque: 'ACME MOTOR PARTS',
  refcde: '1234-5',
  prixBaseText: '20,00 €',
  remiseText: '40 %',
  prixNetText: '12,00 €',
  stockIconSrc: ICON('1'),
  iconSettled: true,
  ...o,
});

const ACME_ITEM = item('900001', '1234-5', 'ACME MOTOR PARTS', 'ACME');

const lookup = (o: Partial<CalLookup> = {}): CalLookup => ({
  ref: '12345',
  kind: 'REF_BRAND',
  item: ACME_ITEM,
  row: row(),
  ...o,
});

describe('parseCalAutocomplete', () => {
  it('unwraps the JSONP callback and keeps key/ref/marq/codemarq', () => {
    const body =
      'jsonpCb({"result":[' +
      '{"key":"900001","value":"x","marq":"ACME MOTOR PARTS","codemarq":"ACME","ref":"1234-5","qte":"1"},' +
      '{"key":"900002","marq":"OTHERCO","codemarq":"OTHR","ref":"12345"}' +
      ']});';
    expect(parseCalAutocomplete(body)).toEqual([
      item('900001', '1234-5', 'ACME MOTOR PARTS', 'ACME'),
      item('900002', '12345', 'OTHERCO', 'OTHR'),
    ]);
  });

  it('drops entries without a key or a ref; blank brand fields become null', () => {
    const body =
      'cb({"result":[{"key":"","ref":"A"},{"key":"1","ref":" "},{"key":"2","ref":"B","marq":" ","codemarq":null}]})';
    expect(parseCalAutocomplete(body)).toEqual([item('2', 'B', null, null)]);
  });

  it('no result field → empty list', () => {
    expect(parseCalAutocomplete('cb({})')).toEqual([]);
  });

  it('throws on a non-JSON body (login page, error page)', () => {
    expect(() => parseCalAutocomplete('<html>login</html>')).toThrow();
  });
});

describe('normalizeCalRef', () => {
  it.each([
    [' 1234-5 ', '12345'],
    ['ab.12 3', 'AB123'],
    ['ABC', 'ABC'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeCalRef(input)).toBe(expected);
  });
});

describe('isCalBrandItem', () => {
  it('matches on the brand label or on the short code', () => {
    expect(isCalBrandItem(item('1', 'R', 'ACME MOTOR PARTS', null), ACME)).toBe(
      true,
    );
    expect(isCalBrandItem(item('1', 'R', 'OTHER LABEL', 'ACME'), ACME)).toBe(
      true,
    );
  });
  it('rejects another brand and empty brand fields', () => {
    expect(isCalBrandItem(item('1', 'R', 'OTHERCO', 'OTHR'), ACME)).toBe(false);
    expect(isCalBrandItem(item('1', 'R', null, null), ACME)).toBe(false);
  });
});

describe('matchCalItem — never the first result by default', () => {
  it('exact normalized ref + brand → REF_BRAND', () => {
    const items = [
      item('9', '12345-X', 'ACME MOTOR PARTS', 'ACME'), // prefix match only
      ACME_ITEM,
    ];
    expect(matchCalItem(items, '12345', ACME)).toEqual({
      item: ACME_ITEM,
      kind: 'REF_BRAND',
    });
  });

  it('same ref under another brand first in the list is skipped', () => {
    const items = [item('8', '12345', 'OTHERCO', 'OTHR'), ACME_ITEM];
    expect(matchCalItem(items, '12345', ACME).item).toBe(ACME_ITEM);
  });

  it('the same article listed twice is still one match', () => {
    expect(matchCalItem([ACME_ITEM, ACME_ITEM], '12345', ACME).kind).toBe(
      'REF_BRAND',
    );
  });

  it('two brand articles with the exact ref → REF_BRAND_AMBIGUOUS, no item', () => {
    const items = [ACME_ITEM, item('900009', '12345', 'ACME', 'ACME')];
    expect(matchCalItem(items, '12345', ACME)).toEqual({
      item: null,
      kind: 'REF_BRAND_AMBIGUOUS',
    });
  });

  it('exact ref only under other brands → FALSE_MATCH, no item', () => {
    const items = [item('8', '12345', 'OTHERCO', 'OTHR')];
    expect(matchCalItem(items, '12345', ACME)).toEqual({
      item: null,
      kind: 'FALSE_MATCH',
    });
  });

  it('only prefix matches → NOT_FOUND, no item', () => {
    const items = [item('9', '123456', 'ACME MOTOR PARTS', 'ACME')];
    expect(matchCalItem(items, '12345', ACME)).toEqual({
      item: null,
      kind: 'NOT_FOUND',
    });
    expect(matchCalItem([], '12345', ACME).kind).toBe('NOT_FOUND');
  });

  it('no brand tokens (sync runner) → REF_ONLY on one exact article', () => {
    expect(matchCalItem([ACME_ITEM], '12345', NONE)).toEqual({
      item: ACME_ITEM,
      kind: 'REF_ONLY',
    });
  });

  it('no brand tokens and two exact articles → ambiguous, never the first', () => {
    const items = [item('8', '12345', 'OTHERCO', 'OTHR'), ACME_ITEM];
    expect(matchCalItem(items, '12345', NONE)).toEqual({
      item: null,
      kind: 'REF_BRAND_AMBIGUOUS',
    });
  });
});

describe('isCalStockIconPlaceholder', () => {
  it.each([[PLACEHOLDER], [''], [null], [undefined]])(
    '%j is the placeholder (not yet resolved)',
    (src) => {
      expect(isCalStockIconPlaceholder(src)).toBe(true);
    },
  );
  it('a resolved icon is not', () => {
    expect(isCalStockIconPlaceholder(ICON('0'))).toBe(false);
  });
});

describe('isCalLineConsistent', () => {
  it('same brand label (case/space-insensitive) and same normalized ref', () => {
    expect(
      isCalLineConsistent(
        ACME_ITEM,
        row({ marque: ' acme  motor parts ', refcde: '12345' }),
      ),
    ).toBe(true);
  });
  it.each([
    [{ marque: 'OTHERCO' }],
    [{ refcde: '99999' }],
    [{ marque: null }],
    [{ refcde: null }],
  ])('rejects a foreign or empty line %j', (o) => {
    expect(isCalLineConsistent(ACME_ITEM, row(o))).toBe(false);
  });
});

describe('calLookupToObservation', () => {
  it('reads net, base and remise from the selected line', () => {
    const obs = calLookupToObservation('19', lookup());
    expect(obs.rawRef).toBe('12345');
    expect(obs.available).toBe(true);
    expect(obs.priceBuyHt).toBe(12);
    expect(obs.priceBaseHt).toBe(20);
    expect(obs.remisePct).toBe(40);
    expect(obs.parseError).toBe(false);
  });

  it.each([
    ['no item', { item: null, kind: 'NOT_FOUND' as const }],
    ['no line', { row: null }],
    ['foreign line', { row: row({ marque: 'OTHERCO' }) }],
  ])('%s → nothing extracted (parseError, never available)', (_l, o) => {
    const obs = calLookupToObservation('19', lookup(o));
    expect(obs.available).toBe(false);
    expect(obs.priceBuyHt).toBeNull();
    expect(obs.parseError).toBe(true);
  });

  it('unsettled icon is dropped: price kept, not available', () => {
    const obs = calLookupToObservation(
      '19',
      lookup({ row: row({ iconSettled: false }) }),
    );
    expect(obs.available).toBe(false);
    expect(obs.priceBuyHt).toBe(12);
  });

  it('the legend text on the line never makes it available', () => {
    const obs = calLookupToObservation(
      '19',
      lookup({ row: row({ stockIconSrc: ICON('0') }) }),
    );
    expect(obs.available).toBe(false);
  });
});

describe('calVerdictForRef — only green + brand lock confirms', () => {
  it('green + REF_BRAND → CONFIRMED_AG with CAL fields', () => {
    const v = calVerdictForRef(lookup(), '3200000000000');
    expect(v).toMatchObject({
      ref: '12345',
      ean: '3200000000000',
      bucket: 'CONFIRMED_AG',
      matchKind: 'REF_BRAND',
      code: '900001',
      marque: 'ACME MOTOR PARTS',
      icon: null,
      dispoType: 'available',
      portalPrix: 12,
      reason: 'cal:ico_dispo1.png',
    });
  });

  it('green without brand lock (REF_ONLY) → REVIEW_NO_SIGNAL', () => {
    const v = calVerdictForRef(lookup({ kind: 'REF_ONLY' }), null);
    expect(v.bucket).toBe('REVIEW_NO_SIGNAL');
    expect(v.reason).toBe('cal:ico_dispo1.png|no_brand_lock');
  });

  it('J+1 → REVIEW_MANUAL_ORDER', () => {
    const v = calVerdictForRef(
      lookup({ row: row({ stockIconSrc: ICON('3') }) }),
      null,
    );
    expect(v.bucket).toBe('REVIEW_MANUAL_ORDER');
    expect(v.dispoType).toBe('on_order_j1');
  });

  it('red → REVIEW_ON_ORDER_OR_OUT, never a BLOCK', () => {
    const v = calVerdictForRef(
      lookup({ row: row({ stockIconSrc: ICON('0') }) }),
      null,
    );
    expect(v.bucket).toBe('REVIEW_ON_ORDER_OR_OUT');
    expect(v.reason).toBe('cal:ico_dispo0.png');
  });

  it('unknown icon → REVIEW_NO_SIGNAL', () => {
    const v = calVerdictForRef(
      lookup({ row: row({ stockIconSrc: '/img/other.png' }) }),
      null,
    );
    expect(v.bucket).toBe('REVIEW_NO_SIGNAL');
    expect(v.dispoType).toBe('unknown');
  });

  it('green but still the placeholder after the wait → REVIEW_NO_SIGNAL', () => {
    const v = calVerdictForRef(
      lookup({ row: row({ iconSettled: false }) }),
      null,
    );
    expect(v.bucket).toBe('REVIEW_NO_SIGNAL');
    expect(v.reason).toBe('cal:icon_unsettled');
  });

  it('a line that is not the selected article → REVIEW_CONTRADICTION', () => {
    const v = calVerdictForRef(
      lookup({ row: row({ marque: 'OTHERCO', refcde: '12345' }) }),
      null,
    );
    expect(v.bucket).toBe('REVIEW_CONTRADICTION');
    expect(v.reason).toBe('cal:line_mismatch:OTHERCO|12345');
  });

  it.each([
    ['FALSE_MATCH', 'REVIEW_FALSE_MATCH'],
    ['REF_BRAND_AMBIGUOUS', 'REVIEW_NO_EAN'],
    ['NOT_FOUND', 'REVIEW_NOT_FOUND'],
  ] as const)('no item (%s) → %s', (kind, bucket) => {
    const v = calVerdictForRef(lookup({ kind, item: null, row: null }), null);
    expect(v.bucket).toBe(bucket);
    expect(v.reason).toBe(kind);
    expect(v.code).toBeNull();
    expect(v.portalPrix).toBeNull();
  });
});
