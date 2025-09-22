// 📁 backend/src/modules/catalog/services/catalog-gamme.service.ts
// 🏭 Service pour gérer les gammes de catalogue (table catalog_gamme)

import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface CatalogGamme {
  mc_id: string;
  mc_mf_id: string; // ID fabricant/marque
  mc_mf_prime: string; // Priorité fabricant
  mc_pg_id: string; // ID gamme produit
  mc_sort: string; // Ordre de tri
  // Champs enrichis après jointure avec pieces_gamme
  pg_id?: string; // ID réel de pieces_gamme (pour les liens)
  pg_name?: string; // Nom de la gamme (ex: "Filtre à huile")
  pg_alias?: string; // Alias pour URL (ex: "filtre-huile")
  pg_image?: string; // Image de la gamme (ex: "filtre-huile.webp")
  manufacturer_name?: string;
}

export interface CatalogGammeWithDetails extends CatalogGamme {
  manufacturer_name?: string;
  product_group_name?: string;
  sort_order?: number;
}

@Injectable()
export class CatalogGammeService extends SupabaseBaseService {
  /**
   * 🔧 Récupère toutes les gammes du catalogue avec leurs noms
   */
  async getAllGammes(): Promise<CatalogGamme[]> {
    try {
      this.logger.log('🔧 Récupération des gammes de catalogue...');

      // OPTIMISATION 1: Récupérer d'abord pieces_gamme avec filtres (plus restrictif)
      const { data: piecesGammes, error: piecesError } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias, pg_img')
        .eq('pg_display', '1')
        .eq('pg_level', '1');

      if (piecesError) {
        this.logger.error('❌ Erreur récupération pieces_gamme:', piecesError);
        throw new BadRequestException(
          `Erreur pieces_gamme: ${piecesError.message}`,
        );
      }

      // Créer un Set pour des lookups plus rapides
      const validPgIds = new Set((piecesGammes || []).map((p) => p.pg_id));

      // OPTIMISATION 2: Filtrer catalog_gamme pour ne prendre que ceux avec pg_id valides
      const { data: catalogGammes, error: catalogError } = await this.supabase
        .from('catalog_gamme')
        .select('mc_id, mc_mf_id, mc_mf_prime, mc_pg_id, mc_sort')
        .in('mc_pg_id', Array.from(validPgIds))
        .order('mc_sort', { ascending: true });

      if (catalogError) {
        this.logger.error(
          '❌ Erreur récupération catalog_gamme:',
          catalogError,
        );
        throw new BadRequestException(
          `Erreur catalog_gamme: ${catalogError.message}`,
        );
      }

      // 3. Jointure optimisée avec Map pour O(1) lookup
      const piecesMap = new Map();
      (piecesGammes || []).forEach((piece) => {
        piecesMap.set(piece.pg_id, piece);
      });

      // 4. Construire le résultat (tous les catalog ont une correspondance maintenant)
      const enrichedGammes: CatalogGamme[] = (catalogGammes || []).map(
        (catalog) => {
          const piece = piecesMap.get(catalog.mc_pg_id);
          return {
            mc_id: catalog.mc_id,
            mc_mf_id: catalog.mc_mf_id,
            mc_mf_prime: catalog.mc_mf_prime,
            mc_pg_id: catalog.mc_pg_id,
            mc_sort: catalog.mc_sort,
            // Données enrichies de pieces_gamme
            pg_id: piece.pg_id,
            pg_name: piece.pg_name,
            pg_alias: piece.pg_alias,
            pg_image: piece.pg_img,
          } as CatalogGamme;
        },
      );

      this.logger.log(
        `✅ ${enrichedGammes?.length || 0} gammes récupérées (optimisé: ${piecesGammes?.length || 0} pieces, ${catalogGammes?.length || 0} catalog)`,
      );
      return enrichedGammes;
    } catch (error) {
      this.logger.error('❌ Erreur gammes catalogue:', error);
      throw new BadRequestException(
        'Erreur lors de la récupération des gammes',
      );
    }
  }

  /**
   * 🔧 Récupère les gammes groupées par fabricant
   */
  async getGammesByManufacturer(): Promise<{
    [manufacturerId: string]: CatalogGamme[];
  }> {
    try {
      this.logger.log('🔧 Récupération gammes par fabricant...');

      const gammes = await this.getAllGammes();

      // Grouper par fabricant
      const grouped = gammes.reduce(
        (acc, gamme) => {
          const manufacturerId = gamme.mc_mf_id;
          if (!acc[manufacturerId]) {
            acc[manufacturerId] = [];
          }
          acc[manufacturerId].push(gamme);
          return acc;
        },
        {} as { [key: string]: CatalogGamme[] },
      );

      this.logger.log(
        `✅ Gammes groupées par ${Object.keys(grouped).length} fabricants`,
      );
      return grouped;
    } catch (error) {
      this.logger.error('❌ Erreur groupement gammes:', error);
      throw new BadRequestException('Erreur lors du groupement des gammes');
    }
  }

  /**
   * 🔧 Récupère les gammes avec détails pour affichage
   */
  async getGammesForDisplay(): Promise<{
    manufacturers: { [id: string]: { name: string; gammes: CatalogGamme[] } };
    stats: { total_gammes: number; total_manufacturers: number };
  }> {
    try {
      this.logger.log('🔧 Récupération gammes pour affichage...');

      const gammesByManufacturer = await this.getGammesByManufacturer();

      // Créer la structure d'affichage
      const manufacturers: {
        [id: string]: { name: string; gammes: CatalogGamme[] };
      } = {};
      let totalGammes = 0;

      for (const [manufacturerId, gammes] of Object.entries(
        gammesByManufacturer,
      )) {
        manufacturers[manufacturerId] = {
          name: `Fabricant ${manufacturerId}`, // Peut être enrichi avec vraie données
          gammes: gammes.sort((a, b) => {
            const sortA = parseInt(a.mc_sort) || 0;
            const sortB = parseInt(b.mc_sort) || 0;
            return sortA - sortB;
          }),
        };
        totalGammes += gammes.length;
      }

      const stats = {
        total_gammes: totalGammes,
        total_manufacturers: Object.keys(manufacturers).length,
      };

      this.logger.log(
        `✅ Affichage préparé: ${stats.total_gammes} gammes, ${stats.total_manufacturers} fabricants`,
      );

      return { manufacturers, stats };
    } catch (error) {
      this.logger.error('❌ Erreur préparation affichage:', error);
      throw new BadRequestException(
        "Erreur lors de la préparation des données d'affichage",
      );
    }
  }

  /**
   * 🔧 Récupère une gamme spécifique par ID
   */
  async getGammeById(gammeId: string): Promise<CatalogGamme | null> {
    try {
      this.logger.log(`🔧 Récupération gamme ID: ${gammeId}`);

      const { data: gamme, error } = await this.supabase
        .from('catalog_gamme')
        .select('*')
        .eq('mc_id', gammeId)
        .single();

      if (error) {
        this.logger.error('❌ Erreur récupération gamme:', error);
        return null;
      }

      this.logger.log(`✅ Gamme ${gammeId} trouvée`);
      return gamme;
    } catch (error) {
      this.logger.error('❌ Erreur gamme par ID:', error);
      return null;
    }
  }

  /**
   * 🔧 Récupère les gammes d'un fabricant spécifique
   */
  async getGammesByManufacturerId(
    manufacturerId: string,
  ): Promise<CatalogGamme[]> {
    try {
      this.logger.log(`🔧 Récupération gammes fabricant: ${manufacturerId}`);

      const { data: gammes, error } = await this.supabase
        .from('catalog_gamme')
        .select('*')
        .eq('mc_mf_id', manufacturerId)
        .order('mc_sort', { ascending: true });

      if (error) {
        this.logger.error('❌ Erreur récupération gammes fabricant:', error);
        throw new BadRequestException(
          `Erreur lors de la récupération des gammes du fabricant: ${error.message}`,
        );
      }

      this.logger.log(
        `✅ ${gammes?.length || 0} gammes trouvées pour fabricant ${manufacturerId}`,
      );
      return gammes || [];
    } catch (error) {
      this.logger.error('❌ Erreur gammes fabricant:', error);
      throw new BadRequestException(
        'Erreur lors de la récupération des gammes du fabricant',
      );
    }
  }

  /**
   * 🌟 Récupère les gammes TOP (PG_TOP = 1) - LOGIQUE PHP REPRODUITE
   * Équivalent PHP: SELECT DISTINCT pg_name, pg_alias, pg_id FROM pieces_gamme WHERE pg_top = 1
   */
  async getTopGammes(): Promise<{
    data: {
      pg_id: string;
      pg_name: string;
      pg_alias: string;
      pg_img?: string;
    }[];
    stats: { total_top_gammes: number };
    success: boolean;
  }> {
    try {
      this.logger.log('🌟 Récupération des gammes TOP (pg_top = 1)...');

      // Requête EXACTE de la logique PHP
      const { data: topGammes, error } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias, pg_img')
        .eq('pg_top', '1') // Équivalent WHERE pg_top = 1
        .eq('pg_display', '1') // Bonus: seulement les gammes affichables
        .order('pg_name', { ascending: true });

      if (error) {
        this.logger.error('❌ Erreur récupération TOP gammes:', error);
        throw new BadRequestException(
          `Erreur lors de la récupération des TOP gammes: ${error.message}`,
        );
      }

      const result = {
        data: topGammes || [],
        stats: {
          total_top_gammes: (topGammes || []).length,
        },
        success: true,
      };

      this.logger.log(
        `✅ ${result.stats.total_top_gammes} TOP gammes récupérées`,
      );
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur TOP gammes:', error);
      return {
        data: [],
        stats: { total_top_gammes: 0 },
        success: false,
      };
    }
  }
}
