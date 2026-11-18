import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from './supabase-base.service';
import { estVendable } from './vendable';

/**
 * 💶 LIGNES TARIFAIRES D'UNE PIÈCE — autorité unique
 *
 * Pourquoi ce service existe
 * --------------------------
 * `pieces_price` porte plusieurs lignes par pièce, et chaque consommateur avait
 * écrit sa propre façon d'en choisir une. Les règles divergeaient, donc une même
 * pièce pouvait valoir trois prix et deux poids selon l'endroit du site :
 *
 *   - page catalogue (RPC `get_pieces_for_type_gamme_v3`) : lignes disponibles
 *     uniquement, `pri_type` le plus élevé ;
 *   - ajout au panier (`CartDataService.getProductWithAllData`) : `.limit(1)`
 *     sans tri ni filtre, puis repli sur un prix en dur ;
 *   - affichage du panier (`CartDataService.enrichCartItemsBatch`) : première
 *     ligne rencontrée ;
 *   - frais de port et commandes (`ShippingCalculatorService`) : sa propre
 *     requête et sa propre copie de l'heuristique de poids.
 *
 * DEUX questions, DEUX règles — ne pas les confondre
 * --------------------------------------------------
 * **Le prix** est une décision commerciale : seule une ligne vendable compte,
 * au sens de la définition unique des décisions 51 et 118 (`./vendable.ts` :
 * `pri_dispo` '1', '2' ou '3', ligne non gelée, pièce affichée, prix
 * strictement positif).
 *
 * **Le poids** est une propriété physique. Une pièce pèse le même poids que son
 * tarif soit vendable ou non. Le filtrer sur la disponibilité jetterait un poids
 * parfaitement valide : mesuré le 2026-09-17, **59 643 pièces** ont un poids
 * exploitable sans aucune ligne disponible, et leur attribuer un poids nul
 * sous-estimerait les frais de port.
 *
 * Ce service ne calcule pas de prix : il choisit une ligne et convertit un poids.
 * Les calculs (quantités, TVA, paliers de port) restent chez l'appelant.
 */

/**
 * Découpage des lots. La borne implicite de PostgREST est de 1000 lignes.
 * Mesuré le 2026-09-17 : une pièce porte **au plus 2 lignes** (92 pièces sur
 * 476 000 en ont plus d'une, moyenne 1,000), donc 500 identifiants rendent au pire
 * ~592 lignes. Même cause que `.ast-grep/rules/supabase-js-bulk-select-paginate.yml`.
 */
const CHUNK_IDS = 500;

/**
 * Seuil de l'heuristique de poids. Au-delà, une valeur étiquetée KGM est en
 * réalité exprimée en grammes (des disques de frein portent « 9445 KGM »).
 */
const SEUIL_KGM = 100;

/** Colonnes du tarif dont dépendent le panier, la fiche produit et les frais de
 * port. Une seule liste : un consommateur qui a besoin d'une colonne de plus
 * l'ajoute ici, il ne refait pas sa propre requête. */
const COLONNES_TARIF = [
  'pri_piece_id_i',
  'pri_type',
  'pri_dispo',
  'pri_vente_ttc_n',
  'pri_consigne_ttc_n',
  'pri_vente_ht_n',
  'pri_achat_ht_n',
  'pri_consigne_ht_n',
  'pri_qte_vente',
  'pri_tva_n',
  'pri_marge_n',
  'pri_ref',
  'pri_des',
  'pri_poids',
  'pri_udm_poids',
  // Décision 51 : l'état de gel et l'affichage de la pièce entrent dans la
  // définition de « vendable » ; le fournisseur sert la proposition d'achat
  // d'une ligne de commande (décision 50).
  'pricing_state',
  'pri_frs',
  // Complément BK n° 4 : date du tarif, montrée par la proposition d'achat quand
  // aucun relevé fournisseur frais n'existe (« tarif du 01/07/2022 »).
  'pri_date_from',
  'pieces!fk_pieces_price_piece_i(piece_display)',
].join(', ');

/** Ligne de tarif de `pieces_price`. */
export interface SellablePriceRow {
  pri_piece_id_i: number;
  pri_type: string | null;
  pri_dispo: string | null;
  pri_vente_ttc_n: number | null;
  pri_consigne_ttc_n: number | null;
  pri_vente_ht_n: number | null;
  pri_achat_ht_n: number | null;
  pri_consigne_ht_n: number | null;
  pri_qte_vente: string | null;
  pri_tva_n: number | null;
  pri_marge_n: number | null;
  pri_ref: string | null;
  pri_des: string | null;
  pri_poids: string | null;
  pri_udm_poids: string | null;
  pricing_state: string | null;
  /** Libellé fournisseur de la ligne (`ACR`, `DCA`…), cf. `___xtr_supplier`. */
  pri_frs: string | null;
  /** Date de début du tarif (texte ISO ou historique) ; lue pour l'affichage seulement. */
  pri_date_from?: string | null;
  /** Jointure `pieces` (clé `fk_pieces_price_piece_i`) : seul `piece_display`. */
  pieces: { piece_display: boolean | null } | null;
}

/** Ce qu'une lecture de tarifs rend, en une seule requête. */
export interface TarifsParPiece {
  /** Ligne vendable retenue. Une pièce sans tarif vendable est ABSENTE. */
  vendables: Map<number, SellablePriceRow>;
  /** Toutes les lignes vendables de chaque pièce (une par fournisseur au plus
   * souvent) : base de la proposition fournisseur d'une ligne de commande. */
  offresVendables: Map<number, SellablePriceRow[]>;
  /** Poids en grammes, disponibilité non requise. Absent si aucun poids exploitable. */
  poidsEnGrammes: Map<number, number>;
}

@Injectable()
export class PiecePriceDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(PiecePriceDataService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Convertit `pri_poids` / `pri_udm_poids` en grammes, ou `null` si la valeur
   * n'est pas exploitable.
   *
   * Heuristique, unique implémentation :
   *   - GRM (ou unité absente) : la valeur est déjà en grammes ;
   *   - KGM ≤ 100 : de vrais kilogrammes (plaquettes, amortisseurs) → ×1000 ;
   *   - KGM > 100 : des grammes mal étiquetés → tels quels.
   */
  static poidsEnGrammes(ligne: {
    pri_poids: string | null;
    pri_udm_poids: string | null;
  }): number | null {
    const brut = parseFloat(ligne.pri_poids ?? '');
    if (!Number.isFinite(brut) || brut <= 0) return null;

    const unite = (ligne.pri_udm_poids ?? '').toUpperCase();
    return unite === 'KGM' && brut <= SEUIL_KGM ? brut * 1000 : brut;
  }

  /**
   * Tarif vendable d'une pièce, ou `null` s'il n'en existe aucun.
   *
   * `null` signifie « cette pièce n'est pas vendable en l'état ». L'appelant doit
   * le traiter comme tel : ne jamais lui substituer un prix par défaut, ce qui
   * ferait payer au client un montant qu'aucune donnée ne justifie.
   */
  async findSellablePrice(pieceId: number): Promise<SellablePriceRow | null> {
    const { vendables } = await this.findTariffs([pieceId]);
    return vendables.get(pieceId) ?? null;
  }

  /** Tarifs vendables d'un lot de pièces, indexés par `pri_piece_id_i`. */
  async findSellablePrices(
    pieceIds: number[],
  ): Promise<Map<number, SellablePriceRow>> {
    return (await this.findTariffs(pieceIds)).vendables;
  }

  /**
   * Poids en grammes d'un lot de pièces, disponibilité NON requise.
   *
   * Séparé du prix à dessein : un tarif non vendable porte quand même un poids
   * valide, et les frais de port ne doivent pas s'effondrer parce qu'une ligne
   * n'est plus à la vente.
   */
  async findWeightsInGrams(pieceIds: number[]): Promise<Map<number, number>> {
    return (await this.findTariffs(pieceIds)).poidsEnGrammes;
  }

  /**
   * Toutes les lignes vendables d'une pièce (décision 50 : proposer le
   * fournisseur de la ligne de commande). Liste vide = aucune offre vendable.
   */
  async findSellableOffers(pieceId: number): Promise<SellablePriceRow[]> {
    const { offresVendables } = await this.findTariffs([pieceId]);
    return offresVendables.get(pieceId) ?? [];
  }

  /**
   * Lecture unique : une seule requête sert le prix ET le poids.
   *
   * La requête ne filtre pas sur `pri_dispo` ni sur le prix. Les deux règles sont
   * appliquées ici, en un seul endroit testable sans base — et c'est ce qui permet
   * de ne pas refaire un aller-retour pour le poids, dont la règle diffère. Le
   * surcoût est borné : au plus 2 lignes par pièce.
   */
  async findTariffs(pieceIds: number[]): Promise<TarifsParPiece> {
    const vendables = new Map<number, SellablePriceRow>();
    const offresVendables = new Map<number, SellablePriceRow[]>();
    const poids = new Map<number, number>();
    const meilleureLignePoids = new Map<number, SellablePriceRow>();

    const identifiants = [...new Set(pieceIds)].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    if (identifiants.length === 0) {
      return { vendables, offresVendables, poidsEnGrammes: poids };
    }

    for (let i = 0; i < identifiants.length; i += CHUNK_IDS) {
      const lot = identifiants.slice(i, i + CHUNK_IDS);

      const { data, error } = await this.client
        .from(TABLES.pieces_price)
        .select(COLONNES_TARIF)
        .in('pri_piece_id_i', lot);

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

        if (PiecePriceDataService.estVendable(ligne)) {
          const offres = offresVendables.get(pieceId) ?? [];
          offres.push(ligne);
          offresVendables.set(pieceId, offres);
          const enPlace = vendables.get(pieceId);
          if (!enPlace || this.supplante(ligne, enPlace)) {
            vendables.set(pieceId, ligne);
          }
        }

        if (PiecePriceDataService.poidsEnGrammes(ligne) !== null) {
          const enPlace = meilleureLignePoids.get(pieceId);
          if (!enPlace || this.supplante(ligne, enPlace)) {
            meilleureLignePoids.set(pieceId, ligne);
          }
        }
      }
    }

    for (const [pieceId, ligne] of meilleureLignePoids) {
      const grammes = PiecePriceDataService.poidsEnGrammes(ligne);
      if (grammes !== null) poids.set(pieceId, grammes);
    }

    return { vendables, offresVendables, poidsEnGrammes: poids };
  }

  /** Décisions 51 et 118 appliquées à une ligne lue par {@link findTariffs}. */
  static estVendable(ligne: SellablePriceRow): boolean {
    return estVendable({
      dispo: ligne.pri_dispo,
      etatTarif: ligne.pricing_state,
      venteTtc: ligne.pri_vente_ttc_n,
      pieceAffichee: ligne.pieces?.piece_display,
    });
  }

  /**
   * Départage deux lignes de la même pièce : le `pri_type` le plus élevé l'emporte,
   * comparé **numériquement**.
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
