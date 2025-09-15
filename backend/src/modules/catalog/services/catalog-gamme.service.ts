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
  // Champs enrichis après jointure
  pg_name?: string; // Nom de la gamme (ex: "Filtre à huile")
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

      // 1. Récupérer les gammes catalog_gamme
      const { data: gammes, error: gammesError } = await this.supabase
        .from('catalog_gamme')
        .select('*')
        .order('mc_sort', { ascending: true });

      if (gammesError) {
        this.logger.error('❌ Erreur récupération gammes:', gammesError);
        throw new BadRequestException(
          `Erreur lors de la récupération des gammes: ${gammesError.message}`,
        );
      }

      // 2. Récupérer les noms de gammes pieces_gamme avec images
      const { data: piecesGamme, error: piecesError } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_img')
        .eq('pg_display', '1'); // Seulement les gammes affichées

      if (piecesError) {
        this.logger.warn('⚠️ Erreur récupération noms gammes:', piecesError);
      }

      // 3. Créer un map des noms et images de gammes
      const nameMap = new Map<string, { name: string; image?: string }>();
      (piecesGamme || []).forEach((piece) => {
        nameMap.set(piece.pg_id, {
          name: piece.pg_name,
          image: piece.pg_img || undefined,
        });
      });

      // 4. Enrichir les gammes avec les noms et images
      const enrichedGammes = (gammes || []).map((gamme) => {
        const pieceData = nameMap.get(gamme.mc_pg_id);
        return {
          ...gamme,
          pg_name: pieceData?.name || `Gamme #${gamme.mc_pg_id}`,
          pg_image: pieceData?.image,
        };
      });

      this.logger.log(
        `✅ ${enrichedGammes?.length || 0} gammes trouvées avec noms (${nameMap.size} noms disponibles)`,
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
  async getGammesByManufacturer(): Promise<{ [manufacturerId: string]: CatalogGamme[] }> {
    try {
      this.logger.log('🔧 Récupération gammes par fabricant...');

      const gammes = await this.getAllGammes();
      
      // Grouper par fabricant
      const grouped = gammes.reduce((acc, gamme) => {
        const manufacturerId = gamme.mc_mf_id;
        if (!acc[manufacturerId]) {
          acc[manufacturerId] = [];
        }
        acc[manufacturerId].push(gamme);
        return acc;
      }, {} as { [key: string]: CatalogGamme[] });

      this.logger.log(`✅ Gammes groupées par ${Object.keys(grouped).length} fabricants`);
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
      const manufacturers: { [id: string]: { name: string; gammes: CatalogGamme[] } } = {};
      let totalGammes = 0;

      for (const [manufacturerId, gammes] of Object.entries(gammesByManufacturer)) {
        manufacturers[manufacturerId] = {
          name: `Fabricant ${manufacturerId}`, // Peut être enrichi avec vraie données
          gammes: gammes.sort((a, b) => {
            const sortA = parseInt(a.mc_sort) || 0;
            const sortB = parseInt(b.mc_sort) || 0;
            return sortA - sortB;
          })
        };
        totalGammes += gammes.length;
      }

      const stats = {
        total_gammes: totalGammes,
        total_manufacturers: Object.keys(manufacturers).length
      };

      this.logger.log(`✅ Affichage préparé: ${stats.total_gammes} gammes, ${stats.total_manufacturers} fabricants`);
      
      return { manufacturers, stats };

    } catch (error) {
      this.logger.error('❌ Erreur préparation affichage:', error);
      throw new BadRequestException('Erreur lors de la préparation des données d\'affichage');
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
  async getGammesByManufacturerId(manufacturerId: string): Promise<CatalogGamme[]> {
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

      this.logger.log(`✅ ${gammes?.length || 0} gammes trouvées pour fabricant ${manufacturerId}`);
      return gammes || [];

    } catch (error) {
      this.logger.error('❌ Erreur gammes fabricant:', error);
      throw new BadRequestException('Erreur lors de la récupération des gammes du fabricant');
    }
  }
}