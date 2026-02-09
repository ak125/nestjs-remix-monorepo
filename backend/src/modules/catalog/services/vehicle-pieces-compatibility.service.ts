import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { OemPlatformMappingService } from './oem-platform-mapping.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';

/**
 * 🚗 SERVICE DE COMPATIBILITÉ PIÈCES/VÉHICULES
 *
 * ⚡ OPTIMISÉ V2: Utilise exclusivement la RPC get_pieces_for_type_gamme
 * - 1 seule requête SQL au lieu de 9
 * - Performance: ~30ms au lieu de 2-4 secondes
 * - Images via CDN Supabase direct
 *
 * @see backend/sql/003-create-rpc-get-pieces-for-type-gamme.sql
 */
@Injectable()
export class VehiclePiecesCompatibilityService extends SupabaseBaseService {
  constructor(
    private readonly oemPlatformMappingService: OemPlatformMappingService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }
  /**
   * 🚀 MÉTHODE PRINCIPALE: Appel RPC optimisé
   *
   * Remplace les 9 requêtes REST API par 1 seule requête SQL côté serveur.
   * La RPC gère: relations, pièces, prix, marques, images, positions, groupements.
   *
   * @param typeId - ID du type de véhicule (ex: 33302)
   * @param pgId - ID de la gamme de pièces (ex: 402)
   * @returns Données complètes formatées pour le frontend
   */
  async getPiecesViaRPC(typeId: number, pgId: number): Promise<PiecesResult> {
    const startTime = Date.now();
    this.logger.log(`🚀 [RPC] get_pieces_for_type_gamme(${typeId}, ${pgId})`);

    try {
      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<any>(
        'get_pieces_for_type_gamme',
        {
          p_type_id: typeId,
          p_pg_id: pgId,
        },
        { source: 'api' },
      );

      if (error) {
        this.logger.error(`❌ [RPC] Erreur: ${error.message}`);
        return this.createEmptyResult(error.message);
      }

      const duration = Date.now() - startTime;
      const count = data?.count || 0;
      const minPrice = data?.minPrice || null;

      this.logger.log(
        `✅ [RPC] ${count} pièces, prix min: ${minPrice}€ en ${duration}ms`,
      );

      return {
        ...data,
        duration: `${duration}ms`,
        method: 'RPC_V2',
        success: true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ [RPC] Exception: ${message}`);
      return this.createEmptyResult(message);
    }
  }

  /**
   * Crée un résultat vide avec message d'erreur
   */
  private createEmptyResult(errorMessage?: string): PiecesResult {
    return {
      pieces: [],
      grouped_pieces: [],
      blocs: [],
      count: 0,
      minPrice: null,
      relations_found: 0,
      success: false,
      error: errorMessage || 'Aucune donnée disponible',
      method: 'RPC_V2',
      duration: '0ms',
    };
  }

  /**
   * 🔧 Récupère les refs OEM constructeur pour une page liste
   * Filtrées par la marque du véhicule (ex: RENAULT sur Clio)
   *
   * @param typeId - ID du type de véhicule
   * @param pgId - ID de la gamme de pièces
   * @param marqueName - Nom de la marque du véhicule (ex: "RENAULT")
   * @returns Liste des refs OEM de cette marque
   */
  async getOemRefsForVehicle(
    typeId: number,
    pgId: number,
    marqueName: string,
  ): Promise<OemRefsResult> {
    const startTime = Date.now();
    this.logger.log(
      `🔧 [RPC] get_oem_refs_for_vehicle(${typeId}, ${pgId}, ${marqueName})`,
    );

    try {
      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<any>(
        'get_oem_refs_for_vehicle',
        {
          p_type_id: typeId,
          p_pg_id: pgId,
          p_marque_name: marqueName,
        },
        { source: 'api' },
      );

      if (error) {
        this.logger.warn(`⚠️ [RPC OEM] Erreur: ${error.message}`);
        return {
          vehicleMarque: marqueName.toUpperCase(),
          oemRefs: [],
          count: 0,
          error: error.message,
        };
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ [RPC OEM] ${data?.count || 0} refs ${marqueName} en ${duration}ms`,
      );

      return {
        vehicleMarque: data?.vehicleMarque || marqueName.toUpperCase(),
        oemRefs: data?.oemRefs || [],
        count: data?.count || 0,
        piecesWithOem: data?.piecesWithOem,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ [RPC OEM] Exception: ${message}`);
      return {
        vehicleMarque: marqueName.toUpperCase(),
        oemRefs: [],
        count: 0,
        error: message,
      };
    }
  }

  /**
   * 🚀 Récupère les refs OEM de manière légère (sans RPC lente)
   * Utilise les piece_ids déjà récupérés par getPiecesViaRPC
   *
   * V2: Dédoublonnage avec normalisation via OemPlatformMappingService
   *     Suppression des limites arbitraires (slice/limit)
   *
   * @param pieceIds - Liste des IDs de pièces déjà récupérées
   * @param marqueName - Nom de la marque du véhicule (ex: "RENAULT")
   * @returns Liste des refs OEM filtrées par marque, dédupliquées et normalisées
   */
  async getOemRefsLightweight(
    pieceIds: number[],
    marqueName: string,
  ): Promise<OemRefsResult> {
    const startTime = Date.now();
    this.logger.log(
      `🔧 [OEM-LIGHT] Récupération refs OEM pour ${pieceIds.length} pièces, marque=${marqueName}`,
    );

    if (!pieceIds || pieceIds.length === 0) {
      return {
        vehicleMarque: marqueName.toUpperCase(),
        oemRefs: [],
        count: 0,
      };
    }

    try {
      // 1. Récupérer le brand_id de la marque constructeur
      const { data: brandData, error: brandError } = await this.client
        .from('pieces_ref_brand')
        .select('prb_id')
        .ilike('prb_name', marqueName) // ilike pour ignorer la casse
        .limit(1)
        .single();

      if (brandError || !brandData) {
        this.logger.warn(`⚠️ [OEM-LIGHT] Marque "${marqueName}" non trouvée`);
        return {
          vehicleMarque: marqueName.toUpperCase(),
          oemRefs: [],
          count: 0,
        };
      }

      // 2. Récupérer les refs OEM (kind=3) pour ces pièces et cette marque
      // LIMIT 500 pour couvrir la majorité des cas, le dédoublonnage réduira
      const { data: refData, error: refError } = await this.client
        .from('pieces_ref_search')
        .select('prs_ref')
        .in('prs_piece_id', pieceIds) // Plus de slice arbitraire
        .eq('prs_prb_id', brandData.prb_id)
        .eq('prs_kind', '3') // Type 3 = OEM constructeurs
        .limit(500); // Limite raisonnable, dédoublonnage après

      if (refError) {
        this.logger.warn(
          `⚠️ [OEM-LIGHT] Erreur requête refs: ${refError.message}`,
        );
        return {
          vehicleMarque: marqueName.toUpperCase(),
          oemRefs: [],
          count: 0,
          error: refError.message,
        };
      }

      // 3. Dédoublonner avec normalisation ("77 01 206 343" = "7701206343")
      const rawRefs = (refData || []).map((r) => r.prs_ref);
      const uniqueRefs =
        this.oemPlatformMappingService.deduplicateOemRefs(rawRefs);
      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ [OEM-LIGHT] ${rawRefs.length} refs brutes → ${uniqueRefs.length} uniques (${marqueName}) en ${duration}ms`,
      );

      return {
        vehicleMarque: marqueName.toUpperCase(),
        oemRefs: uniqueRefs,
        count: uniqueRefs.length,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ [OEM-LIGHT] Exception: ${message}`);
      return {
        vehicleMarque: marqueName.toUpperCase(),
        oemRefs: [],
        count: 0,
        error: message,
      };
    }
  }
}

/**
 * Interface pour les résultats de la RPC
 */
export interface PiecesResult {
  pieces: PieceItem[];
  grouped_pieces: GroupedPieces[];
  blocs: GroupedPieces[];
  count: number;
  minPrice: number | null;
  relations_found: number;
  success: boolean;
  error?: string;
  method: string;
  duration: string;
}

/** 🔧 Résultat des refs OEM constructeur */
export interface OemRefsResult {
  vehicleMarque: string;
  oemRefs: string[];
  count: number;
  piecesWithOem?: number;
  error?: string;
}

export interface PieceItem {
  id: number;
  nom: string;
  reference: string;
  reference_clean: string;
  description: string | null;
  marque: string;
  marque_id: number | null;
  marque_logo: string | null;
  nb_stars: number;
  prix_unitaire: number;
  prix_ttc: number;
  prix_consigne: number;
  prix_total: number;
  quantite_vente: number;
  dispo: boolean;
  image: string;
  qualite: string;
  filtre_gamme: string | null;
  filtre_side: string;
  has_image: boolean;
  has_oem: boolean;
  url: string;
}

export interface GroupedPieces {
  filtre_gamme: string;
  filtre_side: string;
  title_h2: string;
  pieces: PieceItem[];
}
