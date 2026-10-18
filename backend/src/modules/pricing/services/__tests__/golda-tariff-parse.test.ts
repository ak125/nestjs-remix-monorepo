import {
  GOLDA_TARIFF_COLUMNS,
  GOLDA_UNSUPPORTED_COLUMNS,
  GoldaFormatError,
  classifyGoldaMention,
  goldaRefKey,
  parseGoldaTariffCsv,
  type GoldaColumn,
} from '../golda-tariff-parse';

type Row = Partial<Record<GoldaColumn, string>>;

const HEADER = GOLDA_TARIFF_COLUMNS.join(';');

const row = (over: Row = {}): string => {
  const fields: Row = {
    Code_marque: 'TSTA',
    Ref_fournisseur: 'X100',
    Prix_euro: '10.000',
    Base_prix_euro: '1',
    Type_prix: 'AP',
    Qte_cond: '1',
    Udm_qte_cond: 'PCE',
    ...over,
  };
  return GOLDA_TARIFF_COLUMNS.map((c) => fields[c] ?? '').join(';');
};

const file = (lines: string[], header = HEADER): Buffer =>
  Buffer.from([header, ...lines].map((l) => `${l}\r\n`).join(''), 'latin1');

const parse = (...rows: Row[]) => parseGoldaTariffCsv(file(rows.map(row)));

const rejectOf = (over: Row) => {
  const r = parse(over);
  expect(r.lines).toHaveLength(0);
  expect(r.rejected).toHaveLength(1);
  return r.rejected[0];
};

describe('parseGoldaTariffCsv — file format', () => {
  it('decodes latin-1 bytes', () => {
    const r = parse({ Art_substitution: 'épuisement du stock' });
    expect(r.report.unclassifiedMentions).toEqual({
      'Art_substitution: ÉPUISEMENT DU STOCK': 1,
    });
  });

  it('refuses a header that is not the 105-column layout', () => {
    const swapped = [...GOLDA_TARIFF_COLUMNS];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(() => parseGoldaTariffCsv(file([row()], swapped.join(';')))).toThrow(
      GoldaFormatError,
    );
    expect(() =>
      parseGoldaTariffCsv(file([row()], `${HEADER};Nouvelle_colonne`)),
    ).toThrow(GoldaFormatError);
    const short = GOLDA_TARIFF_COLUMNS.slice(0, -1).join(';');
    expect(() => parseGoldaTariffCsv(file([row()], short))).toThrow(
      GoldaFormatError,
    );
  });

  it('refuses a UTF-8 BOM, LF-only line ends, an empty file, a header alone', () => {
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), file([row()])]);
    expect(() => parseGoldaTariffCsv(bom)).toThrow(GoldaFormatError);
    const lf = Buffer.from(`${HEADER}\n${row()}\n`, 'latin1');
    expect(() => parseGoldaTariffCsv(lf)).toThrow(GoldaFormatError);
    expect(() => parseGoldaTariffCsv(Buffer.alloc(0))).toThrow(
      GoldaFormatError,
    );
    expect(() => parseGoldaTariffCsv(file([]))).toThrow(GoldaFormatError);
  });

  it.each([['\n'], ['\r']])(
    'refuses a CRLF header followed by records separated by %j',
    (eol) => {
      const mixed = Buffer.from(
        `${HEADER}\r\n${row()}${eol}${row({ Ref_fournisseur: 'X200' })}${eol}`,
        'latin1',
      );
      expect(() => parseGoldaTariffCsv(mixed)).toThrow(GoldaFormatError);
    },
  );

  it('accepts a file with or without the final CRLF', () => {
    expect(parse({}).report.dataLines).toBe(1);
    const noFinal = Buffer.from(`${HEADER}\r\n${row()}`, 'latin1');
    expect(parseGoldaTariffCsv(noFinal).report.acceptedLines).toBe(1);
  });

  it('rejects a line with the wrong column count, an empty line, a stray LF or CR', () => {
    const r = parseGoldaTariffCsv(
      file([
        `${row()};extra`,
        '',
        row({ Ref_fournisseur: 'X200', Description: 'a\nb' }),
        row({ Ref_fournisseur: 'X300', Description: 'a\rb' }),
      ]),
    );
    expect(r.rejected).toEqual([
      { lineNo: 2, reason: 'WRONG_COLUMN_COUNT', detail: '106' },
      { lineNo: 3, reason: 'WRONG_COLUMN_COUNT', detail: '1' },
      { lineNo: 4, reason: 'STRAY_LINE_BREAK' },
      { lineNo: 5, reason: 'STRAY_LINE_BREAK' },
    ]);
  });
});

describe('parseGoldaTariffCsv — prices', () => {
  it('AP = gross price, exact cents from 3 decimals', () => {
    const [l] = parse({ Prix_euro: '54.200' }).lines;
    expect(l).toMatchObject({
      priceType: 'AP',
      priceCents: 5420,
      grossCents: 5420,
      netCents: null,
      distributorCents: null,
      ppcMismatch: false,
    });
  });

  it('NTP = net price; the gross is the PPC when present', () => {
    const r = parse(
      {
        Type_prix: 'NTP',
        Prix_euro: '7.500',
        Prix_ppc: '12.000',
        Base_ppc: '1',
      },
      { Ref_fournisseur: 'X200', Type_prix: 'NTP', Prix_euro: '7.500' },
    );
    expect(r.lines[0]).toMatchObject({
      netCents: 750,
      grossCents: 1200,
      ppcMismatch: false,
    });
    expect(r.lines[1]).toMatchObject({ netCents: 750, grossCents: null });
    expect(r.report.ppcMismatch).toBe(0);
  });

  it('DIS is neither net nor gross; the gross is the PPC when present', () => {
    const r = parse({
      Type_prix: 'DIS',
      Prix_euro: '8.000',
      Prix_ppc: '11.000',
      Base_ppc: '1',
    });
    expect(r.lines[0]).toMatchObject({
      distributorCents: 800,
      netCents: null,
      grossCents: 1100,
      ppcMismatch: false,
    });
    expect(r.report.ppcMismatch).toBe(0);
  });

  it.each([
    ['12.340', 1234],
    ['12.3', 1230],
    ['12', 1200],
    ['0.010', 1],
  ])('price %s → %i cents', (raw, cents) => {
    expect(parse({ Prix_euro: raw }).lines[0].priceCents).toBe(cents);
  });

  it('refuses a sub-cent price instead of rounding it', () => {
    expect(rejectOf({ Prix_euro: '12.345' })).toMatchObject({
      reason: 'SUB_CENT_PRICE',
      detail: 'Prix_euro',
    });
    expect(rejectOf({ Prix_ppc: '9.999', Base_ppc: '1' })).toMatchObject({
      reason: 'SUB_CENT_PRICE',
      detail: 'Prix_ppc',
    });
  });

  it.each([['1,5'], ['.5'], ['1.2345'], ['-1.000'], ['1e3']])(
    'refuses the malformed price %s',
    (raw) => {
      expect(rejectOf({ Prix_euro: raw }).reason).toBe('INVALID_NUMBER');
    },
  );

  it('refuses a price too large to hold in exact cents', () => {
    expect(rejectOf({ Prix_euro: '100000000000000.010' })).toMatchObject({
      reason: 'INVALID_NUMBER',
      detail: 'Prix_euro',
    });
  });

  it('refuses a zero price, a missing price and a price base other than 1', () => {
    expect(rejectOf({ Prix_euro: '0.000' }).reason).toBe('NON_POSITIVE_PRICE');
    expect(rejectOf({ Prix_euro: '' }).reason).toBe('MISSING_PRICE');
    expect(rejectOf({ Base_prix_euro: '10' })).toMatchObject({
      reason: 'PRICE_BASE_NOT_ONE',
      detail: 'Base_prix_euro',
    });
    expect(rejectOf({ Prix_ppc: '12.000', Base_ppc: '100' })).toMatchObject({
      reason: 'PRICE_BASE_NOT_ONE',
      detail: 'Base_ppc',
    });
  });

  it('refuses a zero PPC', () => {
    expect(
      rejectOf({ Type_prix: 'DIS', Prix_ppc: '0.000', Base_ppc: '1' }),
    ).toMatchObject({ reason: 'NON_POSITIVE_PRICE', detail: 'Prix_ppc' });
  });

  it('refuses PRP and unknown price types', () => {
    expect(rejectOf({ Type_prix: 'PRP' })).toMatchObject({
      reason: 'UNSUPPORTED_PRICE_TYPE',
      detail: 'PRP',
    });
    expect(rejectOf({ Type_prix: '' })).toMatchObject({
      reason: 'UNSUPPORTED_PRICE_TYPE',
      detail: '',
    });
  });

  it('keeps an AP line whose PPC differs from its price, and reports it', () => {
    const r = parse({ Prix_euro: '10.000', Prix_ppc: '11.000', Base_ppc: '1' });
    expect(r.lines[0]).toMatchObject({ grossCents: 1000, ppcMismatch: true });
    expect(r.report.ppcMismatch).toBe(1);
  });

  it('an AP line whose PPC equals its price is no mismatch', () => {
    const r = parse({ Prix_euro: '10.000', Prix_ppc: '10.000', Base_ppc: '1' });
    expect(r.lines[0].ppcMismatch).toBe(false);
    expect(r.report.ppcMismatch).toBe(0);
  });
});

describe('parseGoldaTariffCsv — pack and order quantities', () => {
  it('a pack price is never divided; only packs above 1 are counted', () => {
    const r = parse(
      { Qte_cond: '4', Udm_qte_cond: 'PCE', Prix_euro: '40.000' },
      { Ref_fournisseur: 'X200', Qte_cond: '1', Udm_qte_cond: 'PCE' },
    );
    expect(r.lines[0]).toMatchObject({ packQty: 4, priceCents: 4000 });
    expect(r.lines[1].packQty).toBe(1);
    expect(r.report.packQtyAboveOne).toBe(1);
  });

  it('refuses a priced line whose pack unit is not PCE or whose pack quantity is missing', () => {
    expect(rejectOf({ Qte_cond: '2', Udm_qte_cond: 'M' })).toMatchObject({
      reason: 'PACK_UNIT_NOT_PCE',
      detail: 'M',
    });
    expect(rejectOf({ Qte_cond: '2', Udm_qte_cond: '' })).toMatchObject({
      reason: 'PACK_UNIT_NOT_PCE',
      detail: '',
    });
    expect(rejectOf({ Qte_cond: '', Udm_qte_cond: 'KG' })).toMatchObject({
      reason: 'PACK_UNIT_NOT_PCE',
      detail: 'KG',
    });
    expect(rejectOf({ Qte_cond: '', Udm_qte_cond: '' })).toMatchObject({
      reason: 'PACK_UNIT_NOT_PCE',
      detail: '',
    });
    expect(rejectOf({ Qte_cond: '', Udm_qte_cond: 'PCE' }).reason).toBe(
      'MISSING_PACK_QTY',
    );
  });

  it.each([['2.5'], ['abc'], ['0'], ['99999999999999999999']])(
    'refuses the pack quantity %s',
    (raw) => {
      expect(rejectOf({ Qte_cond: raw })).toMatchObject({
        reason: 'INVALID_NUMBER',
        detail: 'Qte_cond',
      });
    },
  );

  it('reports lines not sold one by one; refuses quantities below 1', () => {
    const r = parse(
      { Qte_mini: '2', Udm_qte_mini: 'PCE' },
      { Ref_fournisseur: 'X200', Qte_multiple: '5' },
      { Ref_fournisseur: 'X300', Qte_mini: '1', Qte_multiple: '1' },
    );
    expect(r.report.orderQtyAboveOne).toBe(2);
    expect(r.lines[0]).toMatchObject({ minQty: 2, minQtyUnit: 'PCE' });
    expect(rejectOf({ Qte_multiple: '0' })).toMatchObject({
      reason: 'INVALID_NUMBER',
      detail: 'Qte_multiple',
    });
  });
});

describe('parseGoldaTariffCsv — unsupported fields', () => {
  // Written out, not taken from the export: removing a column from the
  // exported list must fail here.
  const UNSUPPORTED = [
    'Prix2',
    'Qte2',
    'Prix3',
    'Qte3',
    'Prix4',
    'Qte4',
    'Prix5',
    'Qte5',
    'Prix6',
    'Qte6',
    'Prix7',
    'Qte7',
    'Udm_prix2x_qte2x',
    'ValeurHT_DEA_DEEE',
    'Code_DEA_DEEE',
    'Coefficient_TICPE',
    'Mention_Coeff_TICPE',
    'Valeur_TICPE',
    'Coeff_TGAP',
    'Mention_Coeff_TGAP',
    'Valeur_TGAP',
    'Valeur_DDS',
    'Surcharge_valeur',
    'Surcharge_type',
    'Surcharge_incluse',
    'Date_fin_validite',
  ] as const;

  it('the exported list is exactly the written-out one', () => {
    expect([...GOLDA_UNSUPPORTED_COLUMNS].sort()).toEqual(
      [...UNSUPPORTED].sort(),
    );
  });

  it.each(UNSUPPORTED.map((c) => [c]))(
    'refuses a priced line that fills %s',
    (column) => {
      expect(rejectOf({ [column]: '1' })).toMatchObject({
        reason: 'UNSUPPORTED_FIELD',
        detail: column,
      });
    },
  );

  it('does not read price, quantity, deposit nor date fields on a SUP line', () => {
    const [l] = parse({
      Statut: 'SUP',
      Prix_euro: '',
      Base_prix_euro: '',
      Prix2: '1',
      Type_prix: 'PRP',
      Qte_cond: '',
      Udm_qte_cond: 'M',
      Qte_mini: '0',
      Udm_qte_mini: 'SET',
      Qte_multiple: '0',
      Montant_consigne: '1.005',
      Date_application: '01/01/2026',
    }).lines;
    expect(l).toMatchObject({
      status: 'SUP',
      lifecycle: 'DISCONTINUED',
      priceType: null,
      priceCents: null,
      grossCents: null,
      packQty: null,
      minQty: null,
      minQtyUnit: null,
      multipleQty: null,
      depositCents: null,
      effectiveDate: null,
    });
  });
});

describe('parseGoldaTariffCsv — deposit', () => {
  it('emits the deposit apart from the price; a zero deposit is not counted', () => {
    const r = parse(
      {
        Montant_consigne: '15.000',
        Code_classe_consigne: 'C1',
        Reference_consigne: 'DEP-1',
      },
      { Ref_fournisseur: 'X200', Montant_consigne: '0.000' },
    );
    expect(r.lines[0]).toMatchObject({
      priceCents: 1000,
      depositCents: 1500,
      depositClass: 'C1',
      depositRef: 'DEP-1',
    });
    expect(r.lines[1].depositCents).toBe(0);
    expect(r.report.withDeposit).toBe(1);
  });

  it('refuses a malformed or sub-cent deposit', () => {
    expect(rejectOf({ Montant_consigne: 'abc' })).toMatchObject({
      reason: 'INVALID_NUMBER',
      detail: 'Montant_consigne',
    });
    expect(rejectOf({ Montant_consigne: '1.005' })).toMatchObject({
      reason: 'SUB_CENT_PRICE',
      detail: 'Montant_consigne',
    });
  });

  it('rejects a line whose deposit ref is its own ref', () => {
    expect(
      rejectOf({ Ref_fournisseur: 'DEP 1', Reference_consigne: 'dep1' }).reason,
    ).toBe('DEPOSIT_RECORD');
  });
});

describe('parseGoldaTariffCsv — line key', () => {
  it('uppercases and removes whitespace, keeps separators', () => {
    expect(goldaRefKey(' x 100/1 ')).toBe('X100/1');
    expect(goldaRefKey('x\t100 1')).toBe('X1001');
    const r = parse(
      { Ref_fournisseur: ' x 100/1 ' },
      { Ref_fournisseur: 'X1001' },
      { Ref_fournisseur: 'x\t200' },
    );
    expect(r.lines.map((l) => [l.ref, l.refPublished])).toEqual([
      ['X100/1', 'x 100/1'],
      ['X1001', 'X1001'],
      ['X200', 'x\t200'],
    ]);
  });

  it('rejects every occurrence of a duplicated key', () => {
    const r = parse(
      { Ref_fournisseur: 'X100' },
      { Ref_fournisseur: 'x 100' },
      { Ref_fournisseur: 'X200' },
    );
    expect(r.lines.map((l) => l.ref)).toEqual(['X200']);
    expect(r.rejected).toEqual([
      { lineNo: 2, reason: 'DUPLICATE_KEY', detail: 'X100' },
      { lineNo: 3, reason: 'DUPLICATE_KEY', detail: 'X100' },
    ]);
  });

  it('compares the brand code of a key regardless of case', () => {
    const r = parse({ Code_marque: 'tsta' }, { Code_marque: 'TSTA' });
    expect(r.lines).toHaveLength(0);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      'DUPLICATE_KEY',
      'DUPLICATE_KEY',
    ]);
  });

  it.each([
    [{ Prix_euro: '12.345' }, 'SUB_CENT_PRICE'],
    [{ Statut: 'XXX' }, 'UNKNOWN_STATUS'],
    [{ Type_prix: 'PRP' }, 'UNSUPPORTED_PRICE_TYPE'],
  ] as const)(
    'a twin rejected for %o still blocks the other occurrence',
    (twin, reason) => {
      const r = parse({}, { ...twin });
      expect(r.lines).toHaveLength(0);
      expect(r.rejected).toEqual([
        { lineNo: 2, reason: 'DUPLICATE_KEY', detail: 'X100' },
        expect.objectContaining({ lineNo: 3, reason }),
      ]);
    },
  );

  it('lists rejected lines in file order', () => {
    const r = parse(
      { Ref_fournisseur: 'X100' },
      { Ref_fournisseur: 'X100' },
      { Ref_fournisseur: 'X200', Type_prix: 'PRP' },
      { Ref_fournisseur: 'X300' },
    );
    expect(r.rejected.map((x) => x.lineNo)).toEqual([2, 3, 4]);
  });

  it('lists a content reject before a later column-count reject', () => {
    const r = parseGoldaTariffCsv(
      file([
        row({ Ref_fournisseur: 'X100', Type_prix: 'PRP' }),
        `${row({ Ref_fournisseur: 'X200' })};extra`,
      ]),
    );
    expect(r.rejected.map((x) => [x.lineNo, x.reason])).toEqual([
      [2, 'UNSUPPORTED_PRICE_TYPE'],
      [3, 'WRONG_COLUMN_COUNT'],
    ]);
  });

  it('accepts the same ref under two brand codes', () => {
    const r = parse({ Code_marque: 'tsta' }, { Code_marque: 'TSTB' });
    expect(r.lines.map((l) => l.brandCode)).toEqual(['TSTA', 'TSTB']);
    expect(r.report.byBrandCode).toEqual({ TSTA: 1, TSTB: 1 });
  });

  it('rejects a missing brand code or ref', () => {
    expect(rejectOf({ Code_marque: ' ' }).reason).toBe('MISSING_BRAND_CODE');
    expect(rejectOf({ Ref_fournisseur: '' }).reason).toBe('MISSING_REF');
  });
});

describe('parseGoldaTariffCsv — fields carried as published', () => {
  it('maps each field from its own column', () => {
    const r = parse(
      {
        Code_remise: 'R1',
        Code_sousfamille_NU: 'S1',
        Code_famille_NU: 'F1',
        Code_EAN: 'E1',
        Code_EAN_1: 'E2',
        Ref_complementaire: 'C1',
        Ref_TecDoc: 'T1',
      },
      { Ref_fournisseur: 'X200' },
    );
    expect(r.lines[0]).toMatchObject({
      remiseCode: 'R1',
      subfamilyNu: 'S1',
      ean: 'E1',
      refComplementary: 'C1',
    });
    expect(r.lines[1]).toMatchObject({
      remiseCode: null,
      subfamilyNu: null,
      ean: null,
      refComplementary: null,
    });
  });
});

describe('parseGoldaTariffCsv — status, mentions, lifecycle', () => {
  it.each([
    ['', 'UNCHANGED', 'ACTIVE'],
    ['NOU', 'NOU', 'ACTIVE'],
    ['MOD', 'MOD', 'ACTIVE'],
    ['FIN', 'FIN', 'END_OF_LIFE'],
  ])('status "%s" → %s / %s', (code, status, lifecycle) => {
    expect(parse({ Statut: code }).lines[0]).toMatchObject({
      status,
      lifecycle,
    });
  });

  it.each([['XYZ'], ['constructor'], ['toString'], ['__proto__']])(
    'rejects the unknown status %s',
    (code) => {
      expect(rejectOf({ Statut: code })).toMatchObject({
        reason: 'UNKNOWN_STATUS',
        detail: code,
      });
    },
  );

  it('classifies mentions from a closed list only', () => {
    expect(classifyGoldaMention('JUSQU A EPUISEMENT DU STOCK')).toBe(
      'END_OF_LIFE',
    );
    expect(classifyGoldaMention('STOCK')).toBe('END_OF_LIFE');
    expect(classifyGoldaMention('STOCKS')).toBe('UNCLASSIFIED');
    expect(classifyGoldaMention('REFERENCE REMPLACEE')).toBe(
      'SUCCESSOR_ANNOUNCED',
    );
    expect(classifyGoldaMention('TEMPORAIREMENT INDISPONIBLE')).toBe(
      'TEMPORARILY_UNAVAILABLE',
    );
  });

  it.each([
    ['JUSQU A EPUISEMENT'],
    ["JUSQU'A EPUISEMENT DU STOCK"],
    ['EPUISEMENT DE STOCK'],
    ['EPUISEMENT  STOCK ET REMPLACEMENT'],
    ['STOCK'],
  ])('the end-of-life mention %s ends the life of a MOD line', (mention) => {
    expect(
      parse({ Statut: 'MOD', Art_substitution: mention }).lines[0],
    ).toMatchObject({ mentionClass: 'END_OF_LIFE', lifecycle: 'END_OF_LIFE' });
  });

  it('collapses spaces before classifying; end-of-life mention = END_OF_LIFE', () => {
    const [l] = parse({
      Art_substitution: ' jusqu a  epuisement   du stock',
    }).lines;
    expect(l).toMatchObject({
      mention: 'JUSQU A EPUISEMENT DU STOCK',
      mentionClass: 'END_OF_LIFE',
      lifecycle: 'END_OF_LIFE',
    });
  });

  it('a replacement or temporary mention keeps the line ACTIVE', () => {
    const r = parse(
      { Art_substitution: 'REFERENCE REMPLACEE' },
      {
        Ref_fournisseur: 'X200',
        Art_substitution: 'TEMPORAIREMENT INDISPONIBLE',
      },
    );
    expect(r.lines.map((l) => [l.mentionClass, l.lifecycle])).toEqual([
      ['SUCCESSOR_ANNOUNCED', 'ACTIVE'],
      ['TEMPORARILY_UNAVAILABLE', 'ACTIVE'],
    ]);
  });

  it('reports unknown mentions and digitless replacements, never classifies them', () => {
    const r = parse(
      { Art_substitution: 'STOCKS' },
      { Ref_fournisseur: 'X200', Art_remplacement: 'voir catalogue' },
    );
    expect(r.lines[0]).toMatchObject({
      mentionClass: 'UNCLASSIFIED',
      lifecycle: 'ACTIVE',
    });
    expect(r.lines[1]).toMatchObject({ successor: null, mention: null });
    expect(r.report.unclassifiedMentions).toEqual({
      'Art_substitution: STOCKS': 1,
      'Art_remplacement: VOIR CATALOGUE': 1,
    });
  });

  it.each([['JUSQU A EPUISEMENT'], ['TEMPORAIREMENT INDISPONIBLE']])(
    'SUP wins over the mention %s',
    (mention) => {
      const [l] = parse({ Statut: 'SUP', Art_substitution: mention }).lines;
      expect(l.lifecycle).toBe('DISCONTINUED');
    },
  );

  it('reads a calendar effective date and rejects any other form', () => {
    expect(
      parse({ Date_application: '2026-01-15' }).lines[0].effectiveDate,
    ).toBe('2026-01-15');
    expect(
      parse({ Date_application: '2028-02-29' }).lines[0].effectiveDate,
    ).toBe('2028-02-29');
    for (const raw of [
      '15/01/2026',
      '2026-01-15X',
      '2026-02-31',
      '2026-13-01',
      '0000-00-00',
    ]) {
      expect(rejectOf({ Date_application: raw }).reason).toBe('INVALID_DATE');
    }
  });
});

describe('parseGoldaTariffCsv — successor', () => {
  const successorOf = (r: ReturnType<typeof parse>, ref: string) => {
    const l = r.lines.find((x) => x.ref === ref);
    return [l?.successor, l?.successorSource];
  };

  it('Art_remplacement first, then an Art_substitution ref; the line stays ACTIVE', () => {
    const r = parse(
      { Art_remplacement: 'y 200', Art_substitution: 'Y300' },
      { Ref_fournisseur: 'X200', Art_substitution: 'y 300' },
    );
    expect(successorOf(r, 'X100')).toEqual(['Y200', 'ART_REMPLACEMENT']);
    expect(successorOf(r, 'X200')).toEqual(['Y300', 'ART_SUBSTITUTION']);
    for (const l of r.lines) {
      expect(l).toMatchObject({ status: 'UNCHANGED', lifecycle: 'ACTIVE' });
    }
  });

  it('a reference successor wins over a replacing line', () => {
    const r = parse(
      { Ref_fournisseur: 'X100', Art_remplacement: 'Y200' },
      { Ref_fournisseur: 'X200', Art_remplace: 'X100' },
      { Ref_fournisseur: 'X300', Art_substitution: 'Y300' },
      { Ref_fournisseur: 'X400', Art_remplace: 'X300' },
    );
    expect(successorOf(r, 'X100')).toEqual(['Y200', 'ART_REMPLACEMENT']);
    expect(successorOf(r, 'X300')).toEqual(['Y300', 'ART_SUBSTITUTION']);
  });

  it('else the single active line of the same brand that replaces it', () => {
    const r = parse(
      { Ref_fournisseur: 'X100' },
      { Ref_fournisseur: 'X200', Art_remplace: 'x 100' },
    );
    expect(successorOf(r, 'X100')).toEqual(['X200', 'ART_REMPLACE_LOOKUP']);
    expect(successorOf(r, 'X200')).toEqual([null, null]);
  });

  it('ignores a replacing line of another brand, a SUP line, itself', () => {
    const r = parse(
      { Ref_fournisseur: 'X100' },
      { Code_marque: 'TSTB', Ref_fournisseur: 'X200', Art_remplace: 'X100' },
      { Ref_fournisseur: 'X300', Statut: 'SUP', Art_remplace: 'X100' },
      { Ref_fournisseur: 'X400', Art_remplace: 'X400' },
    );
    expect(successorOf(r, 'X100')).toEqual([null, null]);
    expect(successorOf(r, 'X400')).toEqual([null, null]);
  });

  it('ignores a replacing line at end of life', () => {
    const r = parse(
      { Ref_fournisseur: 'X100', Statut: 'SUP' },
      { Ref_fournisseur: 'X200', Statut: 'FIN', Art_remplace: 'X100' },
      { Ref_fournisseur: 'X300', Statut: 'SUP' },
      {
        Ref_fournisseur: 'X400',
        Art_substitution: 'STOCK',
        Art_remplace: 'X300',
      },
    );
    expect(successorOf(r, 'X100')).toEqual([null, null]);
    expect(successorOf(r, 'X300')).toEqual([null, null]);
    expect(r.report.successorAmbiguous).toBe(0);
  });

  it('a successor naming the line itself is ignored, the next step is tried', () => {
    const r = parse(
      { Ref_fournisseur: 'X100', Statut: 'SUP', Art_substitution: 'x 100' },
      {
        Ref_fournisseur: 'X200',
        Art_remplacement: 'X200',
        Art_substitution: 'Y300',
      },
      { Ref_fournisseur: 'X300', Art_remplacement: 'X300' },
      { Ref_fournisseur: 'X400', Art_remplace: 'X300' },
    );
    expect(successorOf(r, 'X100')).toEqual([null, null]);
    expect(successorOf(r, 'X200')).toEqual(['Y300', 'ART_SUBSTITUTION']);
    expect(successorOf(r, 'X300')).toEqual(['X400', 'ART_REMPLACE_LOOKUP']);
    expect(r.report.successorSelf).toBe(3);
  });

  it('several replacing lines = ambiguous, none picked', () => {
    const r = parse(
      { Ref_fournisseur: 'X100' },
      { Ref_fournisseur: 'X200', Art_remplace: 'X100' },
      { Ref_fournisseur: 'X300', Art_remplace: 'X100' },
    );
    expect(successorOf(r, 'X100')).toEqual([null, null]);
    expect(r.report.successorAmbiguous).toBe(1);
  });

  it('a rejected line that replaces it = ambiguous, none picked', () => {
    const subCent = parse(
      { Ref_fournisseur: 'X100' },
      { Ref_fournisseur: 'X200', Art_remplace: 'X100' },
      { Ref_fournisseur: 'X300', Art_remplace: 'X100', Prix_euro: '1.005' },
    );
    expect(successorOf(subCent, 'X100')).toEqual([null, null]);
    expect(subCent.report.successorAmbiguous).toBe(1);
    const duplicated = parse(
      { Ref_fournisseur: 'X100' },
      { Ref_fournisseur: 'X200', Art_remplace: 'X100' },
      { Ref_fournisseur: 'X300', Art_remplace: 'X100' },
      { Ref_fournisseur: 'X300', Art_remplace: 'X100' },
    );
    expect(successorOf(duplicated, 'X100')).toEqual([null, null]);
    expect(duplicated.report.successorAmbiguous).toBe(1);
  });

  it('a rejected declarer blocks the lookup whatever its brand case', () => {
    const r = parse(
      { Ref_fournisseur: 'X100' },
      { Ref_fournisseur: 'X200', Art_remplace: 'X100' },
      {
        Code_marque: 'tsta',
        Ref_fournisseur: 'X300',
        Art_remplace: 'X100',
        Prix_euro: '1.005',
      },
    );
    expect(successorOf(r, 'X100')).toEqual([null, null]);
    expect(r.report.successorAmbiguous).toBe(1);
  });

  it('never splits an Art_remplace value on a separator', () => {
    const r = parse(
      { Ref_fournisseur: 'X100' },
      { Ref_fournisseur: 'X200', Art_remplace: 'X100+X300' },
    );
    expect(successorOf(r, 'X100')).toEqual([null, null]);
  });
});

describe('parseGoldaTariffCsv — report', () => {
  it('every data line is either accepted or rejected', () => {
    const r = parse(
      {},
      { Ref_fournisseur: 'X200', Statut: 'SUP', Prix_euro: '' },
      { Ref_fournisseur: 'X300', Type_prix: 'NTP' },
      { Ref_fournisseur: 'X400', Type_prix: 'PRP' },
      { Ref_fournisseur: 'X500', Statut: 'FIN', Type_prix: 'DIS' },
    );
    expect(r.report).toMatchObject({
      dataLines: 5,
      acceptedLines: 4,
      rejectedLines: 1,
      rejectedByReason: { UNSUPPORTED_PRICE_TYPE: 1 },
      byStatus: { UNCHANGED: 2, NOU: 0, MOD: 0, FIN: 1, SUP: 1 },
      byLifecycle: { ACTIVE: 2, END_OF_LIFE: 1, DISCONTINUED: 1 },
      byPriceType: { AP: 1, NTP: 1, DIS: 1 },
      successorAmbiguous: 0,
      successorSelf: 0,
    });
  });
});
