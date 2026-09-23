import type { ConfigService } from '@nestjs/config';
import {
  PiecePriceDataService,
  type SellablePriceRow,
} from './piece-price-data.service';

/**
 * Deux règles vivent ici et ne doivent jamais fusionner : le PRIX exige une ligne
 * vendable, le POIDS non — une pièce pèse le même poids que son tarif soit à la
 * vente ou non. Ces tests décrivent ce que le client paie et ce qu'il fait peser,
 * sans toucher la base.
 */

const CONFIG_FACTICE = {
  get: (cle: string) =>
    cle === 'SUPABASE_URL'
      ? 'https://exemple.supabase.co'
      : 'cle-de-service-factice',
} as unknown as ConfigService;

/** Client Supabase factice : rejoue des lignes et enregistre les lots demandés. */
function clientFactice(
  lignesParAppel: SellablePriceRow[][] | { erreur: string },
): { client: unknown; lots: number[][] } {
  const lots: number[][] = [];
  let rang = 0;

  const client = {
    from: () => ({
      select: () => ({
        in: (_colonne: string, ids: number[]) => {
          lots.push(ids);
          if ('erreur' in lignesParAppel) {
            return Promise.resolve({
              data: null,
              error: { message: lignesParAppel.erreur },
            });
          }
          return Promise.resolve({
            data: lignesParAppel[rang++] ?? [],
            error: null,
          });
        },
      }),
    }),
  };

  return { client, lots };
}

function ligne(over: Partial<SellablePriceRow> = {}): SellablePriceRow {
  return {
    pri_piece_id_i: 42,
    pri_type: '0',
    pri_dispo: '1',
    pri_vente_ttc_n: 10,
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
    ...over,
  };
}

function service(lignesParAppel: SellablePriceRow[][] | { erreur: string }) {
  const sujet = new PiecePriceDataService(CONFIG_FACTICE);
  const { client, lots } = clientFactice(lignesParAppel);
  Object.defineProperty(sujet, 'client', { get: () => client });
  return { sujet, lots };
}

describe('PiecePriceDataService — choix de la ligne de prix', () => {
  it('retient le pri_type le plus élevé parmi les lignes vendables', async () => {
    const { sujet } = service([
      [
        ligne({ pri_type: '0', pri_vente_ttc_n: 10 }),
        ligne({ pri_type: '1', pri_vente_ttc_n: 25 }),
      ],
    ]);

    expect((await sujet.findSellablePrice(42))?.pri_vente_ttc_n).toBe(25);
  });

  it("ne dépend pas de l'ordre dans lequel la base rend les lignes", async () => {
    const { sujet } = service([
      [
        ligne({ pri_type: '1', pri_vente_ttc_n: 25 }),
        ligne({ pri_type: '0', pri_vente_ttc_n: 10 }),
      ],
    ]);

    expect((await sujet.findSellablePrice(42))?.pri_vente_ttc_n).toBe(25);
  });

  it('compare pri_type numériquement, pas comme du texte', async () => {
    // Un tri texte placerait '9' devant '10'. La RPC catalogue compare en entier.
    const { sujet } = service([
      [
        ligne({ pri_type: '9', pri_vente_ttc_n: 10 }),
        ligne({ pri_type: '10', pri_vente_ttc_n: 30 }),
      ],
    ]);

    expect((await sujet.findSellablePrice(42))?.pri_type).toBe('10');
  });

  it('écarte une ligne non disponible, même si son pri_type est plus élevé', async () => {
    const { sujet } = service([
      [
        ligne({ pri_type: '0', pri_dispo: '1', pri_vente_ttc_n: 10 }),
        ligne({ pri_type: '1', pri_dispo: '0', pri_vente_ttc_n: 999 }),
      ],
    ]);

    expect((await sujet.findSellablePrice(42))?.pri_vente_ttc_n).toBe(10);
  });

  it('écarte un prix nul ou absent', async () => {
    const { sujet } = service([
      [
        ligne({ pri_type: '1', pri_vente_ttc_n: 0 }),
        ligne({ pri_type: '2', pri_vente_ttc_n: null }),
      ],
    ]);

    expect(await sujet.findSellablePrice(42)).toBeNull();
  });

  it("n'invente aucun prix : une pièce sans ligne vendable rend null", async () => {
    const { sujet } = service([[]]);

    expect(await sujet.findSellablePrice(404)).toBeNull();
  });

  it('laisse absente de la Map une pièce sans ligne vendable', async () => {
    const { sujet } = service([[ligne({ pri_piece_id_i: 1 })]]);

    const vendables = await sujet.findSellablePrices([1, 2]);

    expect(vendables.has(1)).toBe(true);
    expect(vendables.has(2)).toBe(false);
  });
});

describe('PiecePriceDataService — poids', () => {
  it('convertit les kilogrammes en grammes', () => {
    expect(
      PiecePriceDataService.poidsEnGrammes({
        pri_poids: '4.5',
        pri_udm_poids: 'KGM',
      }),
    ).toBe(4500);
  });

  it('laisse tels quels des grammes mal étiquetés KGM', () => {
    // Des disques de frein portent « 9445 KGM » : ce sont des grammes.
    expect(
      PiecePriceDataService.poidsEnGrammes({
        pri_poids: '9445',
        pri_udm_poids: 'KGM',
      }),
    ).toBe(9445);
  });

  it('traite GRM et une unité absente comme des grammes', () => {
    expect(
      PiecePriceDataService.poidsEnGrammes({
        pri_poids: '850',
        pri_udm_poids: 'GRM',
      }),
    ).toBe(850);
    expect(
      PiecePriceDataService.poidsEnGrammes({
        pri_poids: '850',
        pri_udm_poids: null,
      }),
    ).toBe(850);
  });

  it('rend null sur un poids absent, nul ou illisible', () => {
    for (const valeur of [null, '', '0', '-3', 'lourd']) {
      expect(
        PiecePriceDataService.poidsEnGrammes({
          pri_poids: valeur,
          pri_udm_poids: 'GRM',
        }),
      ).toBeNull();
    }
  });

  it("retient le poids d'une ligne NON disponible — le poids n'est pas une question de vente", async () => {
    // Mesuré le 2026-09-17 : 59 643 pièces ont un poids exploitable sans aucune
    // ligne disponible. Les compter à zéro sous-estimerait les frais de port.
    const { sujet } = service([
      [ligne({ pri_dispo: '0', pri_poids: '2.5', pri_udm_poids: 'KGM' })],
    ]);

    const { vendables, poidsEnGrammes } = await sujet.findTariffs([42]);

    expect(vendables.has(42)).toBe(false);
    expect(poidsEnGrammes.get(42)).toBe(2500);
  });

  it('ignore une ligne sans poids et retient celle qui en porte un', async () => {
    const { sujet } = service([
      [
        ligne({ pri_type: '1', pri_poids: null }),
        ligne({ pri_type: '0', pri_poids: '700', pri_udm_poids: 'GRM' }),
      ],
    ]);

    expect((await sujet.findWeightsInGrams([42])).get(42)).toBe(700);
  });

  it('laisse absente une pièce sans aucun poids exploitable', async () => {
    const { sujet } = service([[ligne({ pri_poids: null })]]);

    expect((await sujet.findWeightsInGrams([42])).has(42)).toBe(false);
  });
});

describe('PiecePriceDataService — lecture', () => {
  it('sert le prix et le poids en une seule requête', async () => {
    const { sujet, lots } = service([
      [ligne({ pri_poids: '500', pri_udm_poids: 'GRM' })],
    ]);

    await sujet.findTariffs([42]);

    expect(lots).toHaveLength(1);
  });

  it('dédoublonne et écarte les identifiants invalides', async () => {
    const { sujet, lots } = service([[]]);

    await sujet.findSellablePrices([5, 5, 0, -3, 1.5, 8]);

    expect(lots[0]).toEqual([5, 8]);
  });

  it('ne requête pas la base quand aucun identifiant exploitable', async () => {
    const { sujet, lots } = service([[]]);

    const vendables = await sujet.findSellablePrices([0, -1]);

    expect(vendables.size).toBe(0);
    expect(lots).toHaveLength(0);
  });

  it('découpe en lots pour rester sous la borne de 1000 lignes de PostgREST', async () => {
    const ids = Array.from({ length: 1200 }, (_, i) => i + 1);
    const { sujet, lots } = service([[], [], []]);

    await sujet.findTariffs(ids);

    expect(lots.map((l) => l.length)).toEqual([500, 500, 200]);
  });

  it('remonte une erreur de lecture au lieu de rendre un lot incomplet', async () => {
    // Un lot tronqué se lirait chez l'appelant comme « ces pièces ne sont pas
    // vendables » : des articles disparaîtraient du panier sans raison visible.
    const { sujet } = service({ erreur: 'connexion interrompue' });

    await expect(sujet.findTariffs([1])).rejects.toThrow(
      /Lecture des tarifs impossible/,
    );
  });
});
