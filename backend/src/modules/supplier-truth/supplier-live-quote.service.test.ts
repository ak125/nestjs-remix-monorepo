import { CalConnector } from './connectors/cal.connector';
import { InoshopConnector } from './connectors/inoshop.connector';
import type { SearchRow } from './connectors/inoshop-search-parse';
import type { SupplierObservation } from './connectors/supplier-connector.interface';
import {
  SupplierLiveQuoteService,
  type FabriqueConnecteur,
} from './supplier-live-quote.service';
import { defaultConnectorFactory } from './supplier-sync.runner';
import {
  SUPPLIER_OFFER_RELEVE_ENABLED,
  assertLecturePortailsAutorisee,
  isSupplierOfferReleveEnabled,
} from './supplier-sync.flag';
import { getSupplierConnectorConfig } from './connectors/supplier-registry';

/**
 * Preuve « rien ne peut partir » : le connecteur factice est un Proxy qui LÈVE
 * sur toute méthode autre que la surface de lecture. Si le service tentait une
 * mise au panier, une validation ou n'importe quel autre appel, le test échoue.
 */
const LECTURE = new Set([
  'login',
  'fetchAvailability',
  'getCsrfToken',
  'fetchSearchRows',
  'close',
]);

function connecteurLectureSeule<T extends object>(
  proto: T,
  impl: Partial<Record<string, (...a: unknown[]) => unknown>>,
  appels: string[],
): T {
  return new Proxy(Object.create(proto) as T, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol' || prop === 'then') {
        return Reflect.get(target, prop, receiver);
      }
      if (!LECTURE.has(prop)) {
        throw new Error(`appel interdit au connecteur : ${prop}`);
      }
      return (...args: unknown[]) => {
        appels.push(prop);
        return Promise.resolve(impl[prop]?.(...args));
      };
    },
  });
}

const CREDS = () => ({ user: 'u', password: 'p' });
const FIXE = () => new Date('2026-11-17T18:00:00.000Z');
/** Processus autorisé à lire (DEV, `SUPPLIER_OFFER_RELEVE_ENABLED=true`). */
const AUTORISE = () => true;

const LIGNE_LUK: SearchRow = {
  refFournisseur: '500072810',
  marque: 'LUK',
  libelle: 'Kit embrayage',
  ean: null,
  dispoType: 'ag',
  stock: '1',
  prixPublic: 63.23,
  remise1: 63,
  remise2: 0,
  prixAchat: 23.4,
} as unknown as SearchRow;

describe('SupplierLiveQuoteService — lecture seule', () => {
  it('inoshop (DCA) : prix public, remise, net et dispo de la ligne exacte', async () => {
    const appels: string[] = [];
    const fabrique: FabriqueConnecteur = () =>
      connecteurLectureSeule(
        InoshopConnector.prototype,
        {
          getCsrfToken: () => 'jeton',
          fetchSearchRows: () => [LIGNE_LUK],
        },
        appels,
      );
    const s = new SupplierLiveQuoteService(fabrique, CREDS, FIXE, AUTORISE);
    const r = await s.lire('71', '500 0728 10', 'LUK');
    expect(r).toMatchObject({
      ok: true,
      correspondance: 'EXACTE',
      prixPublicHt: 63.23,
      remisePct: 63,
      prixNetHt: 23.4,
      lueA: '2026-11-17T18:00:00.000Z',
    });
    expect(appels).toEqual([
      'login',
      'getCsrfToken',
      'fetchSearchRows',
      'close',
    ]);
  });

  it('inoshop : une autre référence de la marque n’est jamais retenue', async () => {
    const fabrique: FabriqueConnecteur = () =>
      connecteurLectureSeule(
        InoshopConnector.prototype,
        {
          fetchSearchRows: () => [
            { ...LIGNE_LUK, refFournisseur: '602726', marque: 'ATE' },
          ],
        },
        [],
      );
    const r = await new SupplierLiveQuoteService(
      fabrique,
      CREDS,
      FIXE,
      AUTORISE,
    ).lire('71', '13.0460-2726.2', 'ATE');
    expect(r).toMatchObject({
      ok: true,
      correspondance: 'NON_EXACTE',
      refFournisseur: '602726',
      disponible: false,
    });
  });

  it('CAL : observation lue, connecteur toujours fermé', async () => {
    const appels: string[] = [];
    const obs: SupplierObservation = {
      ref: '500 0728 10',
      priceBuyHt: 24.66,
      priceBaseHt: 63.23,
      remisePct: 61,
      available: false,
      delayDays: 1,
      parseError: null,
    } as unknown as SupplierObservation;
    const fabrique: FabriqueConnecteur = () =>
      connecteurLectureSeule(
        CalConnector.prototype,
        { fetchAvailability: () => [obs] },
        appels,
      );
    const r = await new SupplierLiveQuoteService(
      fabrique,
      CREDS,
      FIXE,
      AUTORISE,
    ).lire('19', '500 0728 10', 'LUK');
    expect(r).toMatchObject({
      ok: true,
      prixNetHt: 24.66,
      disponible: false,
      delaiJours: 1,
      detailDispo: 'sur commande, délai 1 j',
      lueA: '2026-11-17T18:00:00.000Z',
    });
    expect(appels).toEqual(['login', 'fetchAvailability', 'close']);
  });

  it('erreur du portail : résultat explicite, jamais un succès, et fermeture', async () => {
    const appels: string[] = [];
    const fabrique: FabriqueConnecteur = () =>
      connecteurLectureSeule(
        CalConnector.prototype,
        {
          fetchAvailability: () => {
            throw new Error('timeout');
          },
        },
        appels,
      );
    const r = await new SupplierLiveQuoteService(
      fabrique,
      CREDS,
      FIXE,
      AUTORISE,
    ).lire('19', 'X', 'LUK');
    expect(r).toMatchObject({ ok: false, motif: 'PORTAIL_EN_ERREUR' });
    expect(appels).toContain('close');
  });

  it('sans connecteur ni identifiants : aucun portail ouvert', async () => {
    const fabrique = jest.fn();
    const sansCreds = new SupplierLiveQuoteService(
      fabrique,
      () => null,
      FIXE,
      AUTORISE,
    );
    expect(await sansCreds.lire('999', 'X', 'Y')).toMatchObject({
      ok: false,
      motif: 'SANS_CONNECTEUR',
    });
    expect(await sansCreds.lire('19', 'X', 'Y')).toMatchObject({
      ok: false,
      motif: 'IDENTIFIANTS_ABSENTS',
    });
    expect(fabrique).not.toHaveBeenCalled();
  });

  it('le Proxy lève bien sur une tentative de mise au panier', () => {
    const c = connecteurLectureSeule(
      InoshopConnector.prototype,
      {},
      [],
    ) as unknown as Record<string, unknown>;
    expect(() => c.addToCart).toThrow(/appel interdit.*addToCart/);
    expect(() => c.submitOrder).toThrow(/appel interdit/);
  });
});

describe('lireLot : une connexion par marque (anti-bannissement)', () => {
  it('deux réf. LUK + une réf. ATE ⇒ deux connexions, trois lectures dans l’ordre', async () => {
    const appels: string[] = [];
    const marques: string[] = [];
    const fabrique: FabriqueConnecteur = (_cfg, marque) => {
      marques.push(marque);
      return connecteurLectureSeule(
        CalConnector.prototype,
        {
          fetchAvailability: (refs: unknown) => [
            {
              ref: (refs as string[])[0],
              priceBuyHt: 10,
              priceBaseHt: 20,
              remisePct: 50,
              available: true,
              delayDays: null,
              parseError: null,
            },
          ],
        },
        appels,
      );
    };
    const r = await new SupplierLiveQuoteService(
      fabrique,
      CREDS,
      FIXE,
      AUTORISE,
    ).lireLot('19', [
      { ref: 'A1', marque: 'LUK' },
      { ref: 'B1', marque: 'ATE' },
      { ref: 'A2', marque: 'LUK' },
    ]);
    expect(marques).toEqual(['LUK', 'ATE']);
    expect(appels.filter((a) => a === 'login')).toHaveLength(2);
    expect(appels.filter((a) => a === 'close')).toHaveLength(2);
    expect(r.map((x) => (x.ok ? x.refDemandee : null))).toEqual([
      'A1',
      'B1',
      'A2',
    ]);
  });
});

describe('garde PROD : aucune lecture de portail sans SUPPLIER_OFFER_RELEVE_ENABLED=true', () => {
  const avant = process.env[SUPPLIER_OFFER_RELEVE_ENABLED];
  beforeEach(() => {
    delete process.env[SUPPLIER_OFFER_RELEVE_ENABLED];
  });
  afterAll(() => {
    if (avant === undefined) delete process.env[SUPPLIER_OFFER_RELEVE_ENABLED];
    else process.env[SUPPLIER_OFFER_RELEVE_ENABLED] = avant;
  });

  it('drapeau strict : seul « true » autorise', () => {
    for (const v of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
      expect(isSupplierOfferReleveEnabled(() => v)).toBe(false);
    }
    expect(isSupplierOfferReleveEnabled(() => 'true')).toBe(true);
  });

  it('identifiants présents mais drapeau absent : aucun connecteur construit', async () => {
    const fabrique = jest.fn();
    const r = await new SupplierLiveQuoteService(
      fabrique,
      CREDS, // identifiants factices « présents »
      FIXE,
      () => isSupplierOfferReleveEnabled(),
    ).lire('19', '500 0728 10', 'LUK');
    expect(r).toMatchObject({ ok: false, motif: 'LECTURE_PORTAIL_INTERDITE' });
    expect(fabrique).not.toHaveBeenCalled();
  });

  it('seconde barrière : la fabrique réelle refuse aussi, sans réseau', async () => {
    // Même si l'autorisation du service était contournée, la fabrique par
    // défaut lève avant de construire le connecteur.
    const r = await new SupplierLiveQuoteService(
      undefined,
      CREDS,
      FIXE,
      AUTORISE,
    ).lire('19', '500 0728 10', 'LUK');
    expect(r).toMatchObject({ ok: false, motif: 'PORTAIL_EN_ERREUR' });
    expect(r.ok === false && r.detail).toMatch(/interdite/);
  });

  it('la fabrique de la synchro catalogue refuse aussi', () => {
    const cfg = getSupplierConnectorConfig('19');
    expect(cfg).toBeDefined();
    expect(() => defaultConnectorFactory(cfg!)).toThrow(
      /SUPPLIER_OFFER_RELEVE_ENABLED/,
    );
    expect(() => assertLecturePortailsAutorisee(() => 'true')).not.toThrow();
  });
});

describe('aucun code d’envoi dans les connecteurs', () => {
  it.each([
    ['CalConnector', CalConnector.prototype],
    ['InoshopConnector', InoshopConnector.prototype],
  ])('%s n’expose aucune méthode panier / commande', (_n, proto) => {
    const methodes = Object.getOwnPropertyNames(proto);
    expect(methodes).toContain('fetchAvailability');
    expect(
      methodes.filter((m) =>
        /cart|panier|basket|checkout|order|commande|submit|valid|devis/i.test(
          m,
        ),
      ),
    ).toEqual([]);
  });
});
