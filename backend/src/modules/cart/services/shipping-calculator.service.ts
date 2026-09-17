/**
 * ShippingCalculatorService — Calcul frais de port basé sur le poids réel
 *
 * Grilles tarifaires Colissimo 2026 stockées en DB :
 *   - ___xtr_delivery_ape_france (France métro + Monaco + Andorre)
 *   - ___xtr_delivery_ape_corse (Corse — mêmes tarifs France métro)
 *   - ___xtr_delivery_ape_domtom1 (DOM-TOM zone OM1)
 *   - ___xtr_delivery_ape_domtom2 (DOM-TOM zone OM2)
 *
 * Poids réel des produits via PiecePriceDataService (autorité unique de la ligne
 * tarifaire et de la conversion GRM/KGM) — ce service ne requête plus pieces_price
 * Seuil livraison gratuite : 150€ TTC
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { PiecePriceDataService } from '@database/services/piece-price-data.service';

interface ShippingTier {
  minWeightG: number;
  maxWeightG: number;
  feeTTC: number;
  feeHT: number;
}

export interface CartItemWeight {
  productId: string;
  quantity: number;
}

export type ShippingZone = 'france' | 'corse' | 'domtom1' | 'domtom2';

const ZONE_TABLES: Record<ShippingZone, string> = {
  france: '___xtr_delivery_ape_france',
  corse: '___xtr_delivery_ape_corse',
  domtom1: '___xtr_delivery_ape_domtom1',
  domtom2: '___xtr_delivery_ape_domtom2',
};

@Injectable()
export class ShippingCalculatorService
  extends SupabaseBaseService
  implements OnModuleInit
{
  protected readonly logger = new Logger(ShippingCalculatorService.name);

  private zoneTiers = new Map<ShippingZone, ShippingTier[]>();
  private readonly FREE_SHIPPING_THRESHOLD = 150;
  private readonly DEFAULT_ITEM_WEIGHT_G = 1000; // 1kg par défaut si poids inconnu
  private readonly MAX_SINGLE_PACKAGE_G = 30000; // Colissimo max 30kg

  constructor(private readonly piecePriceData: PiecePriceDataService) {
    super();
  }

  /**
   * Préchargement non-bloquant des paliers tarifaires.
   *
   * `loadAllZoneTiers()` fait 4 RPCs Supabase séquentielles (1 par zone).
   * Awaiter ici bloquerait `app.listen()` (NestJS exécute tous les
   * `onModuleInit` sérialement durant la phase init). Sur runner CI à
   * froid → `/health` muet → exit 124 sur `perf-gates.yml`.
   *
   * Fire-and-forget : le serveur écoute immédiatement, le cache se peuple
   * en parallèle. Les premiers calculs avant que le cache soit prêt
   * passent par `fallbackTier` (déjà géré ligne 62 — même fallback que
   * pour table vide / erreur RPC).
   *
   * Voir `.claude/rules/backend.md` § "Non-blocking onModuleInit".
   */
  onModuleInit(): void {
    this.logger.log(
      '🚀 Initialisation ShippingCalculatorService — chargement paliers en arrière-plan',
    );
    void this.loadAllZoneTiers();
  }

  /**
   * Charger les paliers de TOUTES les zones depuis la DB (cache mémoire)
   *
   * ADR-028 Option D — dual-fallback distinct (Principe 3) :
   * - `[READ_ONLY]` early-exit : décision environnementale attendue (preprod
   *   anon-only, tables `___xtr_delivery_*` revoked from anon par ADR-021)
   * - `[RLS BLOCKED]` try/catch : erreur DB inattendue, signale un drift
   *
   * Préfixes log distincts → Loki LogQL queries séparées, alerting differential.
   */
  private async loadAllZoneTiers(): Promise<void> {
    const fallbackTier: ShippingTier[] = [
      { minWeightG: 0, maxWeightG: 999999, feeTTC: 15.9, feeHT: 13.25 },
    ];

    // Fallback environnemental — décision READ_ONLY explicite, pas un drift
    if (this.isReadOnlyMode) {
      this.logger.warn(
        {
          metric: 'readonly.skipped',
          operation: 'loadAllZoneTiers',
        },
        '[READ_ONLY] Shipping tiers forced to hardcoded fallback — DB tables RLS service_role-only (ADR-021 + ADR-028 Option D)',
      );
      for (const zone of Object.keys(ZONE_TABLES)) {
        this.zoneTiers.set(zone as ShippingZone, fallbackTier);
      }
      return;
    }

    // Fallback technique — erreur DB inattendue, signale un drift
    for (const [zone, table] of Object.entries(ZONE_TABLES)) {
      try {
        const { data, error } = await this.supabase
          .from(table)
          .select('tpg_min, tpg_max, tpg_frais_port, tpg_frais_port_ht')
          .order('tpg_min', { ascending: true });

        if (error || !data || data.length === 0) {
          this.logger.warn(
            `[RLS BLOCKED] Zone ${zone}: impossible de charger (${error?.message || 'table vide'}). Fallback.`,
          );
          this.zoneTiers.set(zone as ShippingZone, fallbackTier);
          continue;
        }

        const tiers = data.map((row) => ({
          minWeightG: parseFloat(row.tpg_min) || 0,
          maxWeightG: parseFloat(row.tpg_max) || 999999,
          feeTTC: parseFloat(row.tpg_frais_port) || 0,
          feeHT: parseFloat(row.tpg_frais_port_ht) || 0,
        }));

        this.zoneTiers.set(zone as ShippingZone, tiers);
      } catch (err) {
        this.logger.error(
          `Zone ${zone}: erreur chargement: ${err instanceof Error ? err.message : String(err)}`,
        );
        this.zoneTiers.set(zone as ShippingZone, fallbackTier);
      }
    }

    const totalTiers = Array.from(this.zoneTiers.values()).reduce(
      (sum, t) => sum + t.length,
      0,
    );
    this.logger.log(
      `${this.zoneTiers.size} zones chargées, ${totalTiers} paliers total (Colissimo 2026)`,
    );
  }

  /**
   * Déterminer la zone de livraison depuis le code postal
   */
  determineZone(postalCode: string, country: string = 'FR'): ShippingZone {
    if (country !== 'FR') return 'france'; // Fallback international → france

    const prefix2 = postalCode?.substring(0, 2) || '';
    const prefix3 = postalCode?.substring(0, 3) || '';

    // Corse : 20xxx (2A + 2B)
    if (prefix2 === '20') return 'corse';

    // DOM-TOM OM1 : 971 (Guadeloupe), 972 (Martinique), 973 (Guyane),
    //               974 (Réunion), 976 (Mayotte), 975 (St-Pierre-et-Miquelon)
    if (['971', '972', '973', '974', '975', '976'].includes(prefix3)) {
      return 'domtom1';
    }

    // DOM-TOM OM2 : 986 (Wallis-et-Futuna), 987 (Polynésie), 988 (Nouvelle-Calédonie)
    if (['986', '987', '988'].includes(prefix3)) {
      return 'domtom2';
    }

    return 'france';
  }

  /**
   * Calculer les frais de port selon le poids total, le subtotal et la zone
   */
  calculateByWeight(
    totalWeightG: number,
    subtotal: number,
    zone: ShippingZone = 'france',
  ): number {
    // Livraison gratuite >= 150€
    if (subtotal >= this.FREE_SHIPPING_THRESHOLD) {
      return 0;
    }

    // Panier vide
    if (totalWeightG <= 0) {
      return 0;
    }

    // Multi-colis si > 30kg
    if (totalWeightG > this.MAX_SINGLE_PACKAGE_G) {
      const nbPackages = Math.ceil(totalWeightG / this.MAX_SINGLE_PACKAGE_G);
      const weightPerPackage = totalWeightG / nbPackages;
      const feePerPackage = this.lookupTierFee(weightPerPackage, zone);
      const totalFee = feePerPackage * nbPackages;
      this.logger.log(
        `Multi-colis ${zone}: ${nbPackages} × ${feePerPackage}€ = ${totalFee}€ (${totalWeightG}g)`,
      );
      return Math.round(totalFee * 100) / 100;
    }

    return this.lookupTierFee(totalWeightG, zone);
  }

  /**
   * Lookup du tarif dans la grille pour un poids et une zone donnés
   */
  private lookupTierFee(
    weightG: number,
    zone: ShippingZone = 'france',
  ): number {
    const tiers = this.zoneTiers.get(zone) || this.zoneTiers.get('france');

    if (!tiers || tiers.length === 0) {
      return 15.9; // Fallback absolu
    }

    for (const tier of tiers) {
      if (weightG >= tier.minWeightG && weightG < tier.maxWeightG) {
        return tier.feeTTC;
      }
    }

    // Si poids dépasse tous les paliers, prendre le dernier
    return tiers[tiers.length - 1].feeTTC;
  }

  /**
   * Poids total du panier, en grammes, via l'autorité unique du tarif.
   * Lecture groupée (aucun N+1) ; repli au forfait par article si le poids manque.
   */
  async getCartItemsWeight(items: CartItemWeight[]): Promise<number> {
    if (!items || items.length === 0) return 0;

    try {
      // Le poids vient de l'autorité unique : même ligne tarifaire retenue et
      // même conversion GRM/KGM que l'affichage du panier. Ce service avait sa
      // propre requête et sa propre copie de l'heuristique, si bien qu'un même
      // panier pouvait peser deux poids — donc coûter deux frais de port —
      // selon qu'on passait par /cart ou par /cart/shipping.
      //
      // La disponibilité n'entre PAS en compte : une pièce pèse le même poids
      // que son tarif soit à la vente ou non.
      const poidsParPiece = await this.piecePriceData.findWeightsInGrams(
        items.map((item) => Number(item.productId)),
      );

      let totalWeightG = 0;
      let fallbackCount = 0;

      for (const item of items) {
        const poids = poidsParPiece.get(Number(item.productId));
        if (poids === undefined) fallbackCount++;
        totalWeightG += (poids ?? this.DEFAULT_ITEM_WEIGHT_G) * item.quantity;
      }

      if (fallbackCount > 0) {
        this.logger.debug(
          `${fallbackCount}/${items.length} articles sans poids → fallback ${this.DEFAULT_ITEM_WEIGHT_G}g`,
        );
      }

      this.logger.debug(
        `Poids total panier: ${totalWeightG}g (${(totalWeightG / 1000).toFixed(2)}kg)`,
      );
      return totalWeightG;
    } catch (err) {
      // Repli assumé et journalisé : sans poids, aucun palier Colissimo ne peut
      // être choisi. Mieux vaut un port au forfait qu'un panier bloqué.
      this.logger.error(
        `Erreur getCartItemsWeight: ${err instanceof Error ? err.message : String(err)}`,
      );
      return items.reduce(
        (sum, item) => sum + this.DEFAULT_ITEM_WEIGHT_G * item.quantity,
        0,
      );
    }
  }
}
