import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

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
      const { data, error } = await this.client.rpc('get_pieces_for_type_gamme', {
        p_type_id: typeId,
        p_pg_id: pgId,
      });

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
    } catch (error: any) {
      this.logger.error(`❌ [RPC] Exception: ${error.message}`);
      return this.createEmptyResult(error.message);
    }
  }

  /**
   * @deprecated Utiliser getPiecesViaRPC() à la place
   * Maintenu pour rétrocompatibilité - redirige vers RPC
   */
  async getPiecesExactPHP(typeId: number, pgId: number): Promise<PiecesResult> {
    this.logger.warn('⚠️ [DEPRECATED] getPiecesExactPHP appelé → RPC');
    return this.getPiecesViaRPC(typeId, pgId);
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
