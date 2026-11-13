/**
 * Attribution F1 : chaque ligne du panier porte la page d'où l'article a été
 * ajouté (`website_url`), recopiée ensuite dans `___xtr_order_line.orl_website_url`.
 *
 * Ces tests verrouillent la règle « premier ajout » sur les deux chemins qui
 * touchent une ligne déjà présente : le ré-ajout d'un article et la fusion
 * d'un panier invité dans le panier du compte. La page déjà connue n'est
 * jamais écrasée ; une ligne qui n'en a pas reçoit celle qui arrive.
 */

// getAppConfig() lit process.env à la construction du service.
process.env.SUPABASE_URL ||= 'https://exemple.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'cle-de-service-factice';

import type { CacheService } from '@cache/cache.service';
import { CartDataService, type CartItem } from './cart-data.service';
import type {
  PiecePriceDataService,
  SellablePriceRow,
} from './piece-price-data.service';

const PIECE_ID = 1946026;

const PIECE = {
  piece_id: PIECE_ID,
  piece_name: 'Disque de frein',
  piece_ref: 'REF-1',
  piece_des: 'avant ventilé',
  piece_pm_id: null,
  piece_has_img: false,
  piece_weight_kgm: 4,
};

const TARIF: SellablePriceRow = {
  pri_piece_id_i: PIECE_ID,
  pri_type: '1',
  pri_dispo: '1',
  pri_vente_ttc_n: 29.36,
  pri_consigne_ttc_n: 0,
  pri_vente_ht_n: null,
  pri_achat_ht_n: null,
  pri_consigne_ht_n: null,
  pri_qte_vente: '1',
  pri_tva_n: null,
  pri_marge_n: null,
  pri_ref: null,
  pri_des: null,
  pri_poids: null,
  pri_udm_poids: null,
};

/** Client Supabase factice : seule la lecture de la pièce est atteinte ici. */
const clientFactice = {
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: PIECE, error: null }),
      }),
    }),
  }),
};

/** Cache en mémoire : le panier relu est bien celui qui a été écrit. */
function sujet() {
  const store = new Map<string, unknown>();
  const cacheService = {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn((key: string, value: unknown) => {
      store.set(key, structuredClone(value));
      return Promise.resolve(undefined);
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(undefined);
    }),
  } as unknown as CacheService;

  const piecePriceData = {
    findSellablePrice: jest.fn().mockResolvedValue(TARIF),
    findSellablePrices: jest.fn().mockResolvedValue(new Map()),
  } as unknown as PiecePriceDataService;

  const service = new CartDataService(cacheService, piecePriceData);
  Object.defineProperty(service, 'client', { get: () => clientFactice });
  return service;
}

function lignePanier(sessionId: string, website_url?: string): CartItem {
  return {
    id: `${sessionId}-${PIECE_ID}-1`,
    user_id: sessionId,
    product_id: String(PIECE_ID),
    quantity: 1,
    price: 29.36,
    created_at: '2026-11-13T00:00:00.000Z',
    updated_at: '2026-11-13T00:00:00.000Z',
    product_name: PIECE.piece_name,
    ...(website_url && { website_url }),
  } as CartItem;
}

/** Écrit un panier tel que Redis le contient, via le même service. */
async function semer(
  service: CartDataService,
  sessionId: string,
  items: CartItem[],
) {
  await (
    service as unknown as {
      saveCartToRedis: (s: string, i: CartItem[]) => Promise<void>;
    }
  ).saveCartToRedis(sessionId, items);
}

async function lire(service: CartDataService, sessionId: string) {
  return (
    service as unknown as {
      getCartFromRedis: (s: string) => Promise<CartItem[]>;
    }
  ).getCartFromRedis(sessionId);
}

describe('CartDataService.addCartItem — page d’ajout d’une ligne existante', () => {
  it('conserve la page du premier ajout quand l’article est ré-ajouté ailleurs', async () => {
    const service = sujet();
    await service.addCartItem(
      's1',
      PIECE_ID,
      1,
      undefined,
      false,
      undefined,
      '/pieces/a',
    );
    await service.addCartItem(
      's1',
      PIECE_ID,
      1,
      undefined,
      false,
      undefined,
      '/pieces/b',
    );

    const [ligne] = await lire(service, 's1');
    expect(ligne.quantity).toBe(2);
    expect(ligne.website_url).toBe('/pieces/a');
  });

  it('renseigne la page d’une ligne qui n’en portait pas', async () => {
    const service = sujet();
    await semer(service, 's1', [lignePanier('s1')]);

    await service.addCartItem(
      's1',
      PIECE_ID,
      1,
      undefined,
      false,
      undefined,
      '/pieces/b',
    );

    const [ligne] = await lire(service, 's1');
    expect(ligne.website_url).toBe('/pieces/b');
  });

  it('garde la page connue quand la quantité change sans page (contrôles +/-)', async () => {
    const service = sujet();
    await semer(service, 's1', [lignePanier('s1', '/pieces/a')]);

    // Chemin interne de mise à jour : prix convenu, remplacement, sans page.
    await service.addCartItem('s1', PIECE_ID, 3, 29.36, true);

    const [ligne] = await lire(service, 's1');
    expect(ligne.quantity).toBe(3);
    expect(ligne.website_url).toBe('/pieces/a');
  });
});

describe('CartDataService.mergeCart — page d’ajout à la fusion', () => {
  it('garde la page du panier cible quand les deux en portent une', async () => {
    const service = sujet();
    await semer(service, 'invite', [lignePanier('invite', '/pieces/invite')]);
    await semer(service, 'compte', [lignePanier('compte', '/pieces/compte')]);

    await service.mergeCart('invite', 'compte');

    const [ligne] = await lire(service, 'compte');
    expect(ligne.quantity).toBe(2);
    expect(ligne.website_url).toBe('/pieces/compte');
  });

  it('reprend la page du panier source quand la ligne cible n’en a pas', async () => {
    const service = sujet();
    await semer(service, 'invite', [lignePanier('invite', '/pieces/invite')]);
    await semer(service, 'compte', [lignePanier('compte')]);

    await service.mergeCart('invite', 'compte');

    const [ligne] = await lire(service, 'compte');
    expect(ligne.website_url).toBe('/pieces/invite');
  });

  it('transporte la page d’un article absent du panier cible', async () => {
    const service = sujet();
    await semer(service, 'invite', [lignePanier('invite', '/pieces/invite')]);

    await service.mergeCart('invite', 'compte');

    const [ligne] = await lire(service, 'compte');
    expect(ligne.website_url).toBe('/pieces/invite');
  });
});
