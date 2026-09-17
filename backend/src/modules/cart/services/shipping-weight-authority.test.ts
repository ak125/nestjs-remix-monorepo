/**
 * Un même panier doit peser le même poids, donc coûter les mêmes frais de port,
 * quel que soit l'endroit qui pose la question.
 *
 * Avant : `ShippingCalculatorService` avait sa propre requête `pieces_price` et sa
 * propre copie de l'heuristique GRM/KGM, tandis que l'affichage du panier en avait
 * une autre. `/cart` et `/cart/shipping` pouvaient répondre deux poids différents.
 */

// getAppConfig() lit process.env à la construction du service.
process.env.SUPABASE_URL ||= 'https://exemple.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'cle-de-service-factice';

import type { PiecePriceDataService } from '@database/services/piece-price-data.service';
import { ShippingCalculatorService } from './shipping-calculator.service';

const FORFAIT_G = 1000;

function sujet(poids: Record<number, number>) {
  const findWeightsInGrams = jest
    .fn()
    .mockResolvedValue(
      new Map(Object.entries(poids).map(([id, g]) => [Number(id), g])),
    );

  const piecePriceData = {
    findWeightsInGrams,
  } as unknown as PiecePriceDataService;

  return {
    service: new ShippingCalculatorService(piecePriceData),
    findWeightsInGrams,
  };
}

describe('ShippingCalculatorService — le poids vient de l’autorité unique', () => {
  it('ne requête pas pieces_price lui-même', async () => {
    const { service, findWeightsInGrams } = sujet({ 42: 2500 });

    await service.getCartItemsWeight([{ productId: '42', quantity: 1 }]);

    expect(findWeightsInGrams).toHaveBeenCalledWith([42]);
  });

  it('multiplie le poids par la quantité', async () => {
    const { service } = sujet({ 42: 2500 });

    const total = await service.getCartItemsWeight([
      { productId: '42', quantity: 3 },
    ]);

    expect(total).toBe(7500);
  });

  it('additionne des articles différents', async () => {
    const { service } = sujet({ 1: 500, 2: 1200 });

    const total = await service.getCartItemsWeight([
      { productId: '1', quantity: 2 },
      { productId: '2', quantity: 1 },
    ]);

    expect(total).toBe(2200);
  });

  it('retombe sur le forfait par article quand le poids est inconnu', async () => {
    const { service } = sujet({});

    const total = await service.getCartItemsWeight([
      { productId: '404', quantity: 2 },
    ]);

    expect(total).toBe(FORFAIT_G * 2);
  });

  it("ne retombe au forfait que pour l'article dont le poids manque", async () => {
    const { service } = sujet({ 1: 300 });

    const total = await service.getCartItemsWeight([
      { productId: '1', quantity: 1 },
      { productId: '2', quantity: 1 },
    ]);

    expect(total).toBe(300 + FORFAIT_G);
  });

  it('rend 0 sur un panier vide, sans interroger la base', async () => {
    const { service, findWeightsInGrams } = sujet({});

    expect(await service.getCartItemsWeight([])).toBe(0);
    expect(findWeightsInGrams).not.toHaveBeenCalled();
  });

  it('retombe au forfait plutôt que de planter si la lecture échoue', async () => {
    // Sans poids, aucun palier Colissimo ne peut être choisi : mieux vaut un port
    // au forfait qu'un panier bloqué. Repli assumé et journalisé.
    const piecePriceData = {
      findWeightsInGrams: jest
        .fn()
        .mockRejectedValue(new Error('connexion interrompue')),
    } as unknown as PiecePriceDataService;
    const service = new ShippingCalculatorService(piecePriceData);

    const total = await service.getCartItemsWeight([
      { productId: '1', quantity: 2 },
    ]);

    expect(total).toBe(FORFAIT_G * 2);
  });
});
