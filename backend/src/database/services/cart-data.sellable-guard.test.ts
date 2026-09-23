/**
 * Le panier ne doit jamais faire payer un prix qu'aucune donnée ne justifie.
 *
 * Un repli à 99,99 € a vécu dans `getProductWithAllData`, commenté « prix par
 * défaut pour tests », sur le vrai chemin d'ajout au panier. Ces tests verrouillent
 * son remplacement : refus explicite à l'ajout, et maintien du chemin interne de
 * modification de quantité, qui ne doit pas se retrouver bloqué.
 */

// getAppConfig() lit process.env à la construction du service.
process.env.SUPABASE_URL ||= 'https://exemple.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'cle-de-service-factice';

import type { HttpException } from '@nestjs/common';
import type { CacheService } from '@cache/cache.service';
import {
  BusinessRuleException,
  DomainNotFoundException,
  ErrorCodes,
} from '@common/exceptions';
import { CartDataService } from './cart-data.service';
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

function tarif(venteTtc: number): SellablePriceRow {
  return {
    pri_piece_id_i: PIECE_ID,
    pri_type: '1',
    pri_dispo: '1',
    pri_vente_ttc_n: venteTtc,
    pri_consigne_ttc_n: 0,
    pri_vente_ht_n: null,
    pri_consigne_ht_n: null,
    pri_qte_vente: '1',
    pri_tva_n: null,
    pri_marge_n: null,
    pri_ref: null,
    pri_des: null,
    pri_poids: null,
    pri_udm_poids: null,
  };
}

/** Client dont la lecture de la pièce renvoie l'erreur PostgREST donnée. */
function clientEnErreur(error: { code: string; message: string }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error }),
        }),
      }),
    }),
  };
}

function sujet(
  tarifRetenu: SellablePriceRow | null,
  client: unknown = clientFactice,
) {
  const piecePriceData = {
    findSellablePrice: jest.fn().mockResolvedValue(tarifRetenu),
    findSellablePrices: jest.fn().mockResolvedValue(new Map()),
  } as unknown as PiecePriceDataService;

  const cacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as unknown as CacheService;

  const service = new CartDataService(cacheService, piecePriceData);
  Object.defineProperty(service, 'client', { get: () => client });
  return service;
}

describe('CartDataService — refus d’un article sans tarif vendable', () => {
  it('marque la pièce non vendable et ne substitue aucun prix', async () => {
    const produit = (await sujet(null).getProductWithAllData(PIECE_ID)) as {
      sellable: boolean;
      price_ttc: number;
    };

    expect(produit.sellable).toBe(false);
    // Le repli historique. S'il réapparaît, ce test tombe.
    expect(produit.price_ttc).not.toBe(99.99);
    expect(produit.price_ttc).toBe(0);
  });

  it('expose le prix du tarif retenu quand il y en a un', async () => {
    const produit = (await sujet(tarif(29.36)).getProductWithAllData(
      PIECE_ID,
    )) as { sellable: boolean; price_ttc: number };

    expect(produit.sellable).toBe(true);
    expect(produit.price_ttc).toBe(29.36);
  });

  it("refuse l'ajout au panier d'une pièce sans tarif vendable", async () => {
    await expect(
      sujet(null).addCartItem('session-test', PIECE_ID, 1),
    ).rejects.toMatchObject({ code: 'CART.NOT_SELLABLE' });
  });

  it('signale ce refus comme une règle métier (422), pas comme une panne (500)', async () => {
    const erreur = await sujet(null)
      .addCartItem('session-test', PIECE_ID, 1)
      .catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(BusinessRuleException);
    expect((erreur as HttpException).getStatus()).toBe(422);
  });

  it("n'ajoute pas l'article à 0 € ni à 99,99 € en repli", async () => {
    const service = sujet(null);

    await expect(
      service.addCartItem('session-test', PIECE_ID, 1),
    ).rejects.toThrow();

    // Rien n'a été écrit : le refus intervient avant toute écriture panier.
    expect(
      (service as unknown as { cacheService: { set: jest.Mock } }).cacheService
        .set,
    ).not.toHaveBeenCalled();
  });

  it('laisse passer la modification de quantité, qui porte le prix déjà convenu', async () => {
    // `customPrice` n'est jamais fourni par un client (autorité serveur côté
    // contrôleur) : seul le chemin interne de mise à jour de quantité le passe.
    // Le bloquer empêcherait un client de retirer un article devenu indisponible.
    const service = sujet(null);

    await expect(
      service.addCartItem('session-test', PIECE_ID, -1, 29.36),
    ).resolves.toBeDefined();
  });
});

describe('CartDataService — produit introuvable à l’ajout', () => {
  it('répond 404 quand la base confirme qu’aucune pièce ne porte cet identifiant', async () => {
    // PGRST116 : `.single()` n'a trouvé aucune ligne.
    const service = sujet(
      tarif(29.36),
      clientEnErreur({ code: 'PGRST116', message: '0 rows' }),
    );

    const erreur = await service
      .addCartItem('session-test', 999, 1)
      .catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(DomainNotFoundException);
    expect((erreur as HttpException).getStatus()).toBe(404);
    expect(erreur).toMatchObject({ code: ErrorCodes.CART.PRODUCT_NOT_FOUND });
  });

  it('ne déguise pas une panne de la base en « produit introuvable »', async () => {
    // Une lecture interrompue ne prouve pas l'absence de la pièce : la
    // présenter en 404 masquerait la panne et ferait croire au client que le
    // produit n'existe pas.
    const service = sujet(
      tarif(29.36),
      clientEnErreur({
        code: '57014',
        message: 'canceling statement due to statement timeout',
      }),
    );

    const erreur = await service
      .addCartItem('session-test', PIECE_ID, 1)
      .catch((e: unknown) => e);

    expect(erreur).toBeDefined();
    expect(erreur).not.toBeInstanceOf(DomainNotFoundException);
    expect(erreur).not.toBeInstanceOf(BusinessRuleException);
  });
});
