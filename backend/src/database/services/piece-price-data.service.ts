import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from './supabase-base.service';

/**
 * 💶 SÉLECTION DU TARIF VENDABLE D'UNE PIÈCE — autorité unique
 *
 * Pourquoi ce service existe
 * --------------------------
 * `pieces_price` porte plusieurs lignes par pièce, et chaque consommateur avait
 * écrit sa propre façon d'en choisir une. Les règles divergeaient, donc une même
 * pièce pouvait s'afficher à trois prix différents selon l'endroit du site :
 *
 *   - page catalogue (RPC `get_pieces_for_type_gamme_v3`) : lignes disponibles
 *     uniquement, `pri_type` le plus élevé ;
 *   - ajout au panier (`CartDataService.getProductWithAllData`) : `.limit(1)`
 *     sans tri ni filtre de disponibilité, puis repli sur un prix en dur ;
 *   - affichage du panier (`CartDataService.enrichCartItemsBatch`) : première
 *     ligne rencontrée, sans filtre de disponibilité.
 *
 * La règle appliquée ici est celle **réellement servie au client** sur la page
 * catalogue : c'est le prix qu'il a vu avant de cliquer, donc c'est lui qui fait
 * foi. Tout consommateur du tarif passe par ce service, aucun ne réécrit la règle.
 *
 * Ce service ne calcule rien : il choisit une ligne. Les calculs (quantités, TVA,
 * frais de port) restent chez l'appelant.
 */

/** Seule valeur de `pri_dispo` qui autorise la vente. Les autres ('0', '2', '3')
 * et l'absence de valeur désignent une ligne non vendable. */
const DISPO_VENDABLE = '1';

/**
 * Découpage des lots. La borne implicite de PostgREST est de 1000 lignes ; une
 * pièce pouvant porter plusieurs lignes vendables, on borne les identifiants à la
 * moitié pour que le nombre de LIGNES rendues ne puisse pas l'atteindre.
 * Même cause que `.ast-grep/rules/supabase-js-bulk-select-paginate.yml`.
 */
const CHUNK_IDS = 500;

/** Colonnes du tarif dont dépendent le panier et la fiche produit. Une seule
 * liste : un consommateur qui a besoin d'une colonne de plus l'ajoute ici, il ne
 * refait pas sa propre requête. */
const COLONNES_TARIF = [
  'pri_piece_id_i',
  'pri_type',
  'pri_dispo',
  'pri_vente_ttc_n',
  'pri_consigne_ttc_n',
  'pri_vente_ht_n',
  'pri_consigne_ht_n',
  'pri_qte_vente',
  'pri_tva_n',
  'pri_marge_n',
  'pri_ref',
  'pri_des',
  'pri_poids',
  'pri_udm_poids',
].join(', ');

/** Ligne de tarif retenue pour une pièce. */
export interface SellablePriceRow {
  pri_piece_id_i: number;
  pri_type: string | null;
  pri_dispo: string | null;
  pri_vente_ttc_n: number | null;
  pri_consigne_ttc_n: number | null;
  pri_vente_ht_n: number | null;
  pri_consigne_ht_n: number | null;
  pri_qte_vente: string | null;
  pri_tva_n: number | null;
  pri_marge_n: number | null;
  pri_ref: string | null;
  pri_des: string | null;
  pri_poids: string | null;
  pri_udm_poids: string | null;
}

@Injectable()
export class PiecePriceDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(PiecePriceDataService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Tarif vendable d'une pièce, ou `null` s'il n'en existe aucun.
   *
   * `null` signifie « cette pièce n'est pas vendable en l'état ». L'appelant doit
   * le traiter comme tel : ne jamais lui substituer un prix par défaut, ce qui
   * ferait payer au client un montant qu'aucune donnée ne justifie.
   */
  async findSellablePrice(pieceId: number): Promise<SellablePriceRow | null> {
    const parTarif = await this.findSellablePrices([pieceId]);
    return parTarif.get(pieceId) ?? null;
  }

  /**
   * Tarifs vendables d'un lot de pièces, indexés par `pri_piece_id_i`.
   *
   * Une pièce sans tarif vendable est **absente** de la Map — elle n'y figure pas
   * avec une valeur nulle ou un prix de remplacement.
   */
  async findSellablePrices(
    pieceIds: number[],
  ): Promise<Map<number, SellablePriceRow>> {
    const retenus = new Map<number, SellablePriceRow>();

    const identifiants = [...new Set(pieceIds)].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    if (identifiants.length === 0) return retenus;

    for (let i = 0; i < identifiants.length; i += CHUNK_IDS) {
      const lot = identifiants.slice(i, i + CHUNK_IDS);

      const { data, error } = await this.client
        .from(TABLES.pieces_price)
        .select(COLONNES_TARIF)
        .in('pri_piece_id_i', lot)
        .eq('pri_dispo', DISPO_VENDABLE)
        // `> 0` écarte aussi les NULL (NULL > 0 vaut NULL en SQL). Aucune ligne
        // disponible n'est à 0 aujourd'hui ; la borne protège d'une vente à 0 €
        // si une future écriture en introduisait une.
        .gt('pri_vente_ttc_n', 0);

      if (error) {
        // Remonter l'échec plutôt que rendre un lot incomplet : un tarif manquant
        // silencieusement se traduirait chez l'appelant par « pièce non vendable »,
        // donc par un article qui disparaît du panier sans explication.
        this.logger.error(
          `Lecture des tarifs impossible (${lot.length} pièces) : ${error.message}`,
        );
        throw new Error(`Lecture des tarifs impossible : ${error.message}`);
      }

      for (const ligne of (data ?? []) as unknown as SellablePriceRow[]) {
        const pieceId = Number(ligne.pri_piece_id_i);
        if (!Number.isFinite(pieceId)) continue;

        const dejaRetenue = retenus.get(pieceId);
        if (!dejaRetenue || this.supplante(ligne, dejaRetenue)) {
          retenus.set(pieceId, ligne);
        }
      }
    }

    return retenus;
  }

  /**
   * Départage deux lignes vendables de la même pièce : le `pri_type` le plus élevé
   * l'emporte, comparé **numériquement**.
   *
   * La comparaison numérique reproduit `ORDER BY NULLIF(pri_type,'')::INTEGER DESC
   * NULLS LAST` de la RPC catalogue. Un tri texte donnerait le même résultat tant
   * que `pri_type` ne vaut que '0' ou '1' — c'est le cas aujourd'hui — mais
   * classerait '9' avant '10' le jour où une troisième valeur apparaîtrait.
   */
  private supplante(
    candidate: SellablePriceRow,
    enPlace: SellablePriceRow,
  ): boolean {
    return this.rangDeType(candidate) > this.rangDeType(enPlace);
  }

  /** `pri_type` en nombre ; une valeur vide ou non numérique passe en dernier. */
  private rangDeType(ligne: SellablePriceRow): number {
    const brut = (ligne.pri_type ?? '').trim();
    if (brut === '') return Number.NEGATIVE_INFINITY;
    const valeur = Number(brut);
    return Number.isFinite(valeur) ? valeur : Number.NEGATIVE_INFINITY;
  }
}
