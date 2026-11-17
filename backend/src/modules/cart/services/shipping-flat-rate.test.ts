/**
 * Mandat BJ — port de la France métropolitaine : forfait 9,90 € TTC sous 100 € TTC,
 * offert à partir de 100 €, quel que soit le poids. Corse et DOM-TOM : grille au
 * poids, gratuité et repli inchangés.
 */

// getAppConfig() lit process.env à la construction du service.
process.env.SUPABASE_URL ||= 'https://exemple.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'cle-de-service-factice';

import type { PiecePriceDataService } from '@database/services/piece-price-data.service';
import { computeShippingAndTotal } from '../controllers/cart-controller.utils';
import {
  ShippingCalculatorService,
  type ShippingZone,
} from './shipping-calculator.service';

type Ligne = {
  tpg_min: string;
  tpg_max: string;
  tpg_frais_port: string;
  tpg_frais_port_ht: string;
};

const palier = (min: number, max: number, ttc: number): Ligne => ({
  tpg_min: String(min),
  tpg_max: String(max),
  tpg_frais_port: String(ttc),
  tpg_frais_port_ht: String(Math.round((ttc / 1.2) * 100) / 100),
});

/** Grilles factices, distinctes par zone pour qu'une confusion de zone se voie. */
const GRILLES: Record<string, Ligne[]> = {
  ___xtr_delivery_ape_france: [
    palier(0, 1000, 8.8),
    palier(1000, 5000, 11.19),
    palier(5000, 30001, 30.5),
  ],
  ___xtr_delivery_ape_corse: [
    palier(0, 1000, 9.1),
    palier(1000, 5000, 12.3),
    palier(5000, 30001, 33.4),
  ],
  ___xtr_delivery_ape_domtom1: [
    palier(0, 1000, 14.2),
    palier(1000, 5000, 28.6),
    palier(5000, 30001, 95.0),
  ],
  ___xtr_delivery_ape_domtom2: [
    palier(0, 1000, 21.7),
    palier(1000, 5000, 44.9),
    palier(5000, 30001, 180.0),
  ],
};

function sujet(poids: Record<number, number> = {}) {
  const piecePriceData = {
    findWeightsInGrams: jest
      .fn()
      .mockResolvedValue(
        new Map(Object.entries(poids).map(([id, g]) => [Number(id), g])),
      ),
  } as unknown as PiecePriceDataService;
  return new ShippingCalculatorService(piecePriceData);
}

/** Charge les grilles par le chemin réel du service (`loadAllZoneTiers`). */
async function avecGrilles(
  service: ShippingCalculatorService,
  grilles: Record<string, Ligne[] | Error>,
): Promise<ShippingCalculatorService> {
  Object.defineProperty(service, 'isReadOnlyMode', {
    value: false,
    configurable: true,
  });
  Object.defineProperty(service, 'supabase', {
    value: {
      from: (table: string) => ({
        select: () => ({
          order: async () => {
            const grille = grilles[table];
            return grille instanceof Error || grille === undefined
              ? { data: null, error: { message: 'grille illisible' } }
              : { data: grille, error: null };
          },
        }),
      }),
    },
    configurable: true,
  });
  await (
    service as unknown as { loadAllZoneTiers(): Promise<void> }
  ).loadAllZoneTiers();
  return service;
}

describe('Port — France métropolitaine : forfait, le poids ne compte pas', () => {
  it('99,99 € → 9,90 €', async () => {
    const service = await avecGrilles(sujet(), GRILLES);
    expect(service.calculateByWeight(1000, 99.99, 'france')).toBe(9.9);
  });

  it('100,00 € → 0 €', async () => {
    const service = await avecGrilles(sujet(), GRILLES);
    expect(service.calculateByWeight(1000, 100, 'france')).toBe(0);
  });

  it('colis de 2 018 g à 54,38 € → 9,90 € (et non le palier de la grille)', async () => {
    const service = await avecGrilles(sujet(), GRILLES);
    expect(service.calculateByWeight(2018, 54.38, 'france')).toBe(9.9);
  });

  it('pièce sans poids → 9,90 €', async () => {
    const service = await avecGrilles(sujet({}), GRILLES);
    const poids = await service.getCartItemsWeight([
      { productId: '42', quantity: 1 },
    ]);
    expect(service.calculateByWeight(poids, 54.38, 'france')).toBe(9.9);
    // Poids non transmis du tout (0 g) sur un panier qui a un montant.
    expect(service.calculateByWeight(0, 54.38, 'france')).toBe(9.9);
  });

  it('la zone par défaut est la métropole (appels du panier et de la commande)', async () => {
    const service = await avecGrilles(sujet(), GRILLES);
    expect(service.calculateByWeight(2018, 54.38)).toBe(9.9);
    expect(service.calculateByWeight(2018, 100)).toBe(0);
  });

  it('au-delà de 30 kg : toujours 9,90 €, pas de multi-colis', async () => {
    const service = await avecGrilles(sujet(), GRILLES);
    expect(service.calculateByWeight(45000, 80, 'france')).toBe(9.9);
    expect(service.calculateByWeight(95000, 99.99, 'france')).toBe(9.9);
  });

  it('grilles illisibles ou pas encore chargées : 9,90 €, plus jamais 15,90 €', async () => {
    const avantChargement = sujet();
    expect(avantChargement.calculateByWeight(2018, 54.38, 'france')).toBe(9.9);

    const illisible = await avecGrilles(sujet(), {});
    expect(illisible.calculateByWeight(2018, 54.38, 'france')).toBe(9.9);
    expect(illisible.calculateByWeight(2018, 149.99, 'france')).toBe(0);
  });

  it('panier vide : 0 €', async () => {
    const service = await avecGrilles(sujet(), GRILLES);
    expect(service.calculateByWeight(0, 0, 'france')).toBe(0);
  });

  it('un code postal de métropole donne la zone france', () => {
    const service = sujet();
    expect(service.determineZone('75002')).toBe('france');
    expect(service.determineZone('69003')).toBe('france');
  });
});

describe('Port — Corse et DOM-TOM : inchangés', () => {
  const HORS_METROPOLE: Array<[ShippingZone, string, number, number]> = [
    // zone, code postal, palier 1–5 kg, palier 5–30 kg de la grille factice
    ['corse', '20000', 12.3, 33.4],
    ['domtom1', '97400', 28.6, 95.0],
    ['domtom2', '98800', 44.9, 180.0],
  ];

  it.each(HORS_METROPOLE)(
    '%s (%s) : le palier de SA grille au poids',
    async (zone, codePostal, palier1a5kg) => {
      const service = await avecGrilles(sujet(), GRILLES);
      expect(service.determineZone(codePostal)).toBe(zone);
      expect(service.calculateByWeight(2018, 54.38, zone)).toBe(palier1a5kg);
    },
  );

  it.each(HORS_METROPOLE)(
    '%s : le seuil de 100 € de la métropole ne s’y applique pas ; gratuité à 150 € comme avant',
    async (zone, _codePostal, palier1a5kg) => {
      const service = await avecGrilles(sujet(), GRILLES);
      expect(service.calculateByWeight(2018, 100, zone)).toBe(palier1a5kg);
      expect(service.calculateByWeight(2018, 149.99, zone)).toBe(palier1a5kg);
      expect(service.calculateByWeight(2018, 150, zone)).toBe(0);
    },
  );

  it.each(HORS_METROPOLE)(
    '%s : multi-colis au-delà de 30 kg, comme avant',
    async (zone, _codePostal, _palier1a5kg, palier5a30kg) => {
      const service = await avecGrilles(sujet(), GRILLES);
      // 45 kg → 2 colis de 22,5 kg, chacun au palier 5–30 kg.
      expect(service.calculateByWeight(45000, 80, zone)).toBe(
        Math.round(palier5a30kg * 2 * 100) / 100,
      );
    },
  );

  it.each(HORS_METROPOLE)(
    '%s : grille illisible → repli à 15,90 €, comme avant',
    async (zone) => {
      const service = await avecGrilles(sujet(), {});
      expect(service.calculateByWeight(2018, 54.38, zone)).toBe(15.9);
    },
  );

  it.each(HORS_METROPOLE)(
    '%s : panier sans poids → 0 €, comme avant',
    async (zone) => {
      const service = await avecGrilles(sujet(), GRILLES);
      expect(service.calculateByWeight(0, 54.38, zone)).toBe(0);
    },
  );
});

describe('Total du panier = sous-total + port', () => {
  it('54,38 € à 2 018 g → 9,90 € de port, total 64,28 €', async () => {
    const service = await avecGrilles(sujet(), GRILLES);
    const shippingCost = service.calculateByWeight(2018, 54.38);

    expect(computeShippingAndTotal({ subtotal: 54.38, shippingCost })).toEqual({
      shippingFee: 9.9,
      totalWithShipping: 64.28,
    });
  });

  it('100,00 € → port offert, total 100,00 €', async () => {
    const service = await avecGrilles(sujet(), GRILLES);
    const shippingCost = service.calculateByWeight(2018, 100);

    expect(computeShippingAndTotal({ subtotal: 100, shippingCost })).toEqual({
      shippingFee: 0,
      totalWithShipping: 100,
    });
  });
});
