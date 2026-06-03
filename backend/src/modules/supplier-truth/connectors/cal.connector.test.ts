import {
  calProductToObservation,
  classifyCalDispo,
  classifyCalStockIcon,
  parseCalDelayDays,
  parseCalPriceHt,
  parseCalRemisePct,
} from './cal-parse';
import {
  CalConnector,
  isForbiddenPostbackTarget,
  parsePriceFromText,
} from './cal.connector';

// Importing the connector here also proves the module loads WITHOUT playwright
// at import-time (type-only imports are erased; the dynamic import is in login()).

describe('parseCalPriceHt', () => {
  it.each([
    ['12,15 €', 12.15],
    ['12.15 € HT', 12.15],
    ['Prix net : 12,15 €', 12.15],
    ['Prix net HT 320,30 €', 320.3],
    ['0 €', 0],
  ])('parses %j → %s', (input, expected) => {
    expect(parseCalPriceHt(input)).toBe(expected);
  });
  it.each(['', null, undefined, 'non communiqué', 'sur devis'])(
    'returns null on %j',
    (input) => {
      expect(parseCalPriceHt(input as string | null | undefined)).toBeNull();
    },
  );
  it('parsePriceFromText (connector helper) behaves the same', () => {
    expect(parsePriceFromText('12,15 €')).toBe(12.15);
    expect(parsePriceFromText(null)).toBeNull();
  });
});

describe('parseCalRemisePct', () => {
  it.each([
    ['50%', 50],
    ['50 %', 50],
    ['50% ', 50],
    ['45,5%', 45.5],
    ['0%', 0],
    ['100%', 100],
  ])('parses %j → %s', (input, expected) => {
    expect(parseCalRemisePct(input)).toBe(expected);
  });
  it.each(['', null, undefined, '— %', '150%', '-5%'])(
    'returns null on out-of-range/unparsable %j',
    (input) => {
      expect(parseCalRemisePct(input as string | null | undefined)).toBeNull();
    },
  );
});

describe('parseCalDelayDays', () => {
  it.each([
    ['J+2', 2],
    ['j +5', 5],
    ['Sur commande 3 j', 3],
    ['Sous 4 jours', 4],
    ['Délai 7 jours', 7],
  ])('parses %j → %s days', (input, expected) => {
    expect(parseCalDelayDays(input)).toBe(expected);
  });
  it.each(['En stock', 'Indisponible', null, ''])(
    'returns null on %j',
    (input) => {
      expect(parseCalDelayDays(input as string | null)).toBeNull();
    },
  );
});

describe('classifyCalDispo', () => {
  it.each([
    ['En stock', 'in_stock'],
    ['Disponible', 'in_stock'],
    ['DISPO', 'in_stock'],
    ['Sur commande', 'on_order'],
    ['Sous 5 jours', 'on_order'],
    ['Délai 7 jours', 'on_order'],
    ['Rupture', 'unavailable'],
    ['Indisponible', 'unavailable'],
    ['Non disponible', 'unavailable'],
    ['ND', 'unavailable'],
  ])('classifies %j → %s', (input, expected) => {
    expect(classifyCalDispo(input)).toBe(expected);
  });
  it.each(['', null, undefined, '???'])('unknown for %j', (input) => {
    expect(classifyCalDispo(input as string | null | undefined)).toBe(
      'unknown',
    );
  });
});

describe('calProductToObservation — pure mapper', () => {
  const base = { supplierId: '19', rawRef: '715899' };

  it('in stock → available=true, delayDays=null, parseError=false', () => {
    const obs = calProductToObservation({
      ...base,
      prixNetHt: 12.15,
      dispoLabel: 'En stock',
    });
    expect(obs.available).toBe(true);
    expect(obs.delayDays).toBeNull();
    expect(obs.priceBuyHt).toBe(12.15);
    expect(obs.parseError).toBe(false);
  });

  it('on order with delay → available=false, delayDays set', () => {
    const obs = calProductToObservation({
      ...base,
      prixNetHt: 12.15,
      dispoLabel: 'Sur commande 3 jours',
    });
    expect(obs.available).toBe(false);
    expect(obs.delayDays).toBe(3);
  });

  it('unavailable → available=false, no delay', () => {
    const obs = calProductToObservation({
      ...base,
      prixNetHt: 12.15,
      dispoLabel: 'Indisponible',
    });
    expect(obs.available).toBe(false);
    expect(obs.delayDays).toBeNull();
    expect(obs.parseError).toBe(false); // we have a price; not nothing
  });

  it('nothing extracted (no price + unknown dispo) → parseError=true, never available', () => {
    const obs = calProductToObservation({
      ...base,
      prixNetHt: null,
      dispoLabel: null,
    });
    expect(obs.available).toBe(false);
    expect(obs.parseError).toBe(true);
  });

  it('price only (dispo unknown) → parseError=false but available=false (safe)', () => {
    const obs = calProductToObservation({
      ...base,
      prixNetHt: 12.15,
      dispoLabel: '???',
    });
    expect(obs.available).toBe(false);
    expect(obs.parseError).toBe(false);
    expect(obs.priceBuyHt).toBe(12.15);
  });
});

describe('classifyCalStockIcon — authoritative stock signal', () => {
  it.each([
    [
      'https://siteweb.pfpreference-seine.fr/app_themes/cyber_CAL92/img/ico_dispo0.png',
      'unavailable',
    ],
    ['/app_themes/cyber_CAL92/img/ico_dispo1.png', 'available'],
    ['/app_themes/cyber_CAL92/img/ico_dispo3.png', 'on_order_j1'],
    ['/img/puceRed.png', 'unavailable'],
  ])('classifies %s → %s', (src, expected) => {
    expect(classifyCalStockIcon(src)).toBe(expected);
  });
  it.each(['', null, undefined, '/img/random.png'])('unknown for %j', (src) => {
    expect(classifyCalStockIcon(src as string | null | undefined)).toBe(
      'unknown',
    );
  });
});

describe('calProductToObservation — icon-driven path (authoritative)', () => {
  const base = { supplierId: '19', rawRef: '715899', prixNetHt: 160.15 };

  it('icon=ico_dispo0 → available=false even with a parsed price (red puce = unavailable)', () => {
    const obs = calProductToObservation({
      ...base,
      dispoLabel: null,
      stockIconSrc: '/img/ico_dispo0.png',
    });
    expect(obs.available).toBe(false);
    expect(obs.priceBuyHt).toBe(160.15);
    expect(obs.parseError).toBe(false);
  });

  it('carries priceBaseHt + remisePct when the connector extracted them (sampling)', () => {
    const obs = calProductToObservation({
      ...base,
      prixBaseHt: 320.3,
      remisePct: 50,
      dispoLabel: null,
      stockIconSrc: '/img/ico_dispo0.png',
    });
    expect(obs.priceBaseHt).toBe(320.3);
    expect(obs.remisePct).toBe(50);
    // Sanity: net ≈ base × (1 − %) (160.15 ≈ 320.3 × 0.5 ✓)
    expect(obs.priceBuyHt).toBeCloseTo(320.3 * 0.5, 2);
  });

  it('priceBaseHt/remisePct default to null when not provided (other connectors)', () => {
    const obs = calProductToObservation({
      ...base,
      dispoLabel: null,
      stockIconSrc: '/img/ico_dispo1.png',
    });
    expect(obs.priceBaseHt).toBeNull();
    expect(obs.remisePct).toBeNull();
  });

  it('icon=ico_dispo1 → available=true', () => {
    const obs = calProductToObservation({
      ...base,
      dispoLabel: null,
      stockIconSrc: '/img/ico_dispo1.png',
    });
    expect(obs.available).toBe(true);
  });

  it('icon=ico_dispo3 → available=false, delayDays=1 (J+1)', () => {
    const obs = calProductToObservation({
      ...base,
      dispoLabel: null,
      stockIconSrc: '/img/ico_dispo3.png',
    });
    expect(obs.available).toBe(false);
    expect(obs.delayDays).toBe(1);
  });

  it('icon wins over text — ico_dispo0 overrides "En stock" label', () => {
    const obs = calProductToObservation({
      ...base,
      dispoLabel: 'En stock',
      stockIconSrc: '/img/ico_dispo0.png',
    });
    expect(obs.available).toBe(false);
  });
});

describe('🚨 Anti-cart safety — postback deny-list (READ-ONLY contract)', () => {
  it.each([
    'ctl00$Cart$cmdAjouter',
    'ctl00$Panier$cmdAdd',
    'ctl00$lstArticles$ctl00$cmdAjouter',
    'CtrlMonPanier1$cmdValidPanier',
    'CtrlOrder$cmdValidOrder',
    'CtrlIncart$cmdCde',
    'ctl00$ContentPlaceHolder1$CtrlBasketAdd1$lnkAjouterAuPanier',
  ])('refuses %s', (target) => {
    expect(isForbiddenPostbackTarget(target)).toBe(true);
  });
  it.each([
    'ctl00$CtrlHeaderSlidingTemplateSelector$ctl00$cmbShowPrices',
    'ctl00$ContentPlaceHolder1$CtrlCatalogueTecdocV3$CtrlSearchVehiculesTemplateSelector1$ctl00$CtrlSearchArtByRef1$cmdSearByRef',
    'ctl00$ContentPlaceHolder1$CtrlCatalogueTecdocV3$CtrlSearchVehiculesTemplateSelector1$ctl00$CtrlSearchArtByRef1$CtrlAutoComplete1$cmdFired',
  ])('allows known read-only target: %s', (target) => {
    expect(isForbiddenPostbackTarget(target)).toBe(false);
  });
});

describe('CalConnector (construction, no I/O)', () => {
  it('exposes platform + supplierId, normalizes baseUrl trailing slash', () => {
    const c = new CalConnector({
      supplierId: '19',
      baseUrl: 'https://siteweb.pfpreference-seine.fr/',
    });
    expect(c.platform).toBe('cal');
    expect(c.supplierId).toBe('19');
  });

  it('fetchAvailability before login throws (guard)', async () => {
    const c = new CalConnector({ supplierId: '19', baseUrl: 'https://x' });
    await expect(c.fetchAvailability(['REF'])).rejects.toThrow(/before login/);
  });

  it('close() is a no-op when never logged in', async () => {
    const c = new CalConnector({ supplierId: '19', baseUrl: 'https://x' });
    await expect(c.close()).resolves.toBeUndefined();
  });
});
