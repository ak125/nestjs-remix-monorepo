import type { ConfigService } from '@nestjs/config';
import {
  PiecePriceDataService,
  type SellablePriceRow,
} from './piece-price-data.service';

/**
 * La règle de sélection du tarif est la seule chose que ce service porte. Ces
 * tests la verrouillent sans toucher la base : ils décrivent ce que le client doit
 * payer, pas la façon dont la requête est écrite.
 */

const CONFIG_FACTICE = {
  get: (cle: string) =>
    cle === 'SUPABASE_URL'
      ? 'https://exemple.supabase.co'
      : 'cle-de-service-factice',
} as unknown as ConfigService;

type Appel = { ids: number[]; dispo?: unknown; prixMin?: unknown };

/** Client Supabase factice : rejoue des lignes et enregistre ce qui a été demandé. */
function clientFactice(
  lignesParAppel: SellablePriceRow[][] | { erreur: string },
): { client: unknown; appels: Appel[] } {
  const appels: Appel[] = [];
  let rang = 0;

  const client = {
    from: () => ({
      select: () => ({
        in: (_colonne: string, ids: number[]) => {
          const appel: Appel = { ids };
          appels.push(appel);
          return {
            eq: (_c: string, valeur: unknown) => {
              appel.dispo = valeur;
              return {
                gt: (_c2: string, borne: unknown) => {
                  appel.prixMin = borne;
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
              };
            },
          };
        },
      }),
    }),
  };

  return { client, appels };
}

function ligne(
  pieceId: number,
  priType: string | null,
  venteTtc: number,
): SellablePriceRow {
  return {
    pri_piece_id_i: pieceId,
    pri_type: priType,
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

function service(
  lignesParAppel: SellablePriceRow[][] | { erreur: string },
): { sujet: PiecePriceDataService; appels: Appel[] } {
  const sujet = new PiecePriceDataService(CONFIG_FACTICE);
  const { client, appels } = clientFactice(lignesParAppel);
  Object.defineProperty(sujet, 'client', { get: () => client });
  return { sujet, appels };
}

describe('PiecePriceDataService', () => {
  it('retient le pri_type le plus élevé quand une pièce a plusieurs tarifs vendables', async () => {
    const { sujet } = service([[ligne(42, '0', 10), ligne(42, '1', 25)]]);

    const retenu = await sujet.findSellablePrice(42);

    expect(retenu?.pri_type).toBe('1');
    expect(retenu?.pri_vente_ttc_n).toBe(25);
  });

  it("ne dépend pas de l'ordre dans lequel la base rend les lignes", async () => {
    const { sujet } = service([[ligne(42, '1', 25), ligne(42, '0', 10)]]);

    expect((await sujet.findSellablePrice(42))?.pri_vente_ttc_n).toBe(25);
  });

  it('compare pri_type numériquement, pas comme du texte', async () => {
    // Un tri texte placerait '9' devant '10'. La RPC catalogue compare en entier :
    // ce test échouerait si la règle repassait un jour au tri lexicographique.
    const { sujet } = service([[ligne(7, '9', 10), ligne(7, '10', 30)]]);

    expect((await sujet.findSellablePrice(7))?.pri_type).toBe('10');
  });

  it('classe un pri_type vide ou non numérique en dernier', async () => {
    const { sujet } = service([[ligne(7, '', 99), ligne(7, '0', 12)]]);

    expect((await sujet.findSellablePrice(7))?.pri_vente_ttc_n).toBe(12);
  });

  it("n'invente aucun prix : une pièce sans tarif vendable rend null", async () => {
    const { sujet } = service([[]]);

    expect(await sujet.findSellablePrice(404)).toBeNull();
  });

  it('laisse absente de la Map une pièce sans tarif vendable', async () => {
    const { sujet } = service([[ligne(1, '0', 10)]]);

    const tarifs = await sujet.findSellablePrices([1, 2]);

    expect(tarifs.has(1)).toBe(true);
    expect(tarifs.has(2)).toBe(false);
    expect(tarifs.size).toBe(1);
  });

  it('ne demande que les lignes disponibles et à prix strictement positif', async () => {
    const { sujet, appels } = service([[]]);

    await sujet.findSellablePrices([1]);

    expect(appels[0].dispo).toBe('1');
    expect(appels[0].prixMin).toBe(0);
  });

  it('dédoublonne et écarte les identifiants invalides', async () => {
    const { sujet, appels } = service([[]]);

    await sujet.findSellablePrices([5, 5, 0, -3, 1.5, 8]);

    expect(appels[0].ids).toEqual([5, 8]);
  });

  it('ne requête pas la base quand aucun identifiant exploitable', async () => {
    const { sujet, appels } = service([[]]);

    const tarifs = await sujet.findSellablePrices([0, -1]);

    expect(tarifs.size).toBe(0);
    expect(appels).toHaveLength(0);
  });

  it('découpe en lots pour rester sous la borne de 1000 lignes de PostgREST', async () => {
    const ids = Array.from({ length: 1200 }, (_, i) => i + 1);
    const { sujet, appels } = service([[], [], []]);

    await sujet.findSellablePrices(ids);

    expect(appels).toHaveLength(3);
    expect(appels[0].ids).toHaveLength(500);
    expect(appels[1].ids).toHaveLength(500);
    expect(appels[2].ids).toHaveLength(200);
  });

  it('remonte une erreur de lecture au lieu de rendre un lot incomplet', async () => {
    // Un lot tronqué se lirait chez l'appelant comme « ces pièces ne sont pas
    // vendables » : des articles disparaîtraient du panier sans raison visible.
    const { sujet } = service({ erreur: 'connexion interrompue' });

    await expect(sujet.findSellablePrices([1])).rejects.toThrow(
      /Lecture des tarifs impossible/,
    );
  });
});
