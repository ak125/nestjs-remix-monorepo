import { CalConnector } from './connectors/cal.connector';
import { InoshopConnector } from './connectors/inoshop.connector';
import type { SearchRow } from './connectors/inoshop-search-parse';
import type { SupplierObservation } from './connectors/supplier-connector.interface';
import {
  SupplierLiveQuoteService,
  type FabriqueConnecteur,
} from './supplier-live-quote.service';

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
    const s = new SupplierLiveQuoteService(fabrique, CREDS, FIXE);
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
    const r = await new SupplierLiveQuoteService(fabrique, CREDS, FIXE).lire(
      '71',
      '13.0460-2726.2',
      'ATE',
    );
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
    const r = await new SupplierLiveQuoteService(fabrique, CREDS, FIXE).lire(
      '19',
      '500 0728 10',
      'LUK',
    );
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
    const r = await new SupplierLiveQuoteService(fabrique, CREDS, FIXE).lire(
      '19',
      'X',
      'LUK',
    );
    expect(r).toMatchObject({ ok: false, motif: 'PORTAIL_EN_ERREUR' });
    expect(appels).toContain('close');
  });

  it('sans connecteur ni identifiants : aucun portail ouvert', async () => {
    const fabrique = jest.fn();
    const sansCreds = new SupplierLiveQuoteService(fabrique, () => null, FIXE);
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
