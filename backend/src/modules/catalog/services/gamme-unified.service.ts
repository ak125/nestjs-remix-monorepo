// 📁 backend/src/modules/catalog/services/gamme-unified.service.ts
// 🎯 Service unifié pour les gammes - remplace gamme.service + catalog-gamme.service + pieces-gamme.service

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { Gamme, GammeWithFamily, FamilyWithGammes, GammeHierarchyResponse } from '../types/gamme.types';

@Injectable()
export class GammeUnifiedService extends SupabaseBaseService {
  private readonly logger = new Logger(GammeUnifiedService.name);

  /**
   * 🎯 Récupère toutes les gammes avec leurs vraies données
   */
  async getAllGammes(): Promise<Gamme[]> {
    try {
      this.logger.log('🎯 Récupération de toutes les gammes...');

      // 1. Récupérer les gammes depuis pieces_gamme (source de vérité pour les noms)
      const { data: piecesGammes, error: piecesError } = await this.supabase
        .from('pieces_gamme')
        .select(`
          pg_id,
          pg_name,
          pg_alias,
          pg_img,
          pg_display,
          pg_top,
          pg_level,
          pg_parent
        `)
        .eq('pg_display', '1')
        .order('pg_id', { ascending: true });

      if (piecesError) {
        this.logger.error('❌ Erreur pieces_gamme:', piecesError);
        throw new BadRequestException(`Erreur récupération gammes: ${piecesError.message}`);
      }

      // 2. Transformer vers le format unifié
      const gammes: Gamme[] = (piecesGammes || []).map((pg) => ({
        id: pg.pg_id,
        alias: pg.pg_alias || undefined,
        name: pg.pg_name,
        description: undefined, // Pas de description dans pieces_gamme
        image: pg.pg_img || undefined,
        is_active: true,
        is_featured: pg.pg_top === '1',
        is_displayed: pg.pg_display === '1',
        family_id: undefined, // À enrichir si nécessaire
        level: parseInt(pg.pg_level) || 0,
        sort_order: parseInt(pg.pg_id), // Tri par ID par défaut
        products_count: 0,
      }));

      this.logger.log(`✅ ${gammes.length} gammes récupérées`);
      return gammes;
    } catch (error) {
      this.logger.error('❌ Erreur getAllGammes:', error);
      throw new BadRequestException('Erreur lors de la récupération des gammes');
    }
  }

  /**
   * 🏗️ Récupère la hiérarchie familles → gammes unifiée
   */
  async getHierarchy(): Promise<GammeHierarchyResponse> {
    try {
      this.logger.log('🏗️ Construction hiérarchie unifiée...');

      // 1. Récupérer les familles
      const { data: families, error: familiesError } = await this.supabase
        .from('catalog_family')
        .select('*')
        .eq('mf_display', '1')
        .order('mf_sort', { ascending: true });

      if (familiesError) {
        throw new BadRequestException(`Erreur familles: ${familiesError.message}`);
      }

      // 2. Récupérer les gammes avec liaison famille
      const { data: catalogGammes, error: catalogError } = await this.supabase
        .from('catalog_gamme')
        .select('*')
        .order('mc_sort', { ascending: true });

      if (catalogError) {
        throw new BadRequestException(`Erreur catalog_gamme: ${catalogError.message}`);
      }

      // 3. Récupérer les noms des gammes
      const allGammes = await this.getAllGammes();
      const gammeNameMap = new Map(allGammes.map(g => [g.id, g]));

      // 4. Construire la hiérarchie
      const familiesWithGammes: FamilyWithGammes[] = (families || []).map((family) => {
        // Filtrer les gammes de cette famille
        const familyGammes = (catalogGammes || [])
          .filter(cg => cg.mc_mf_prime === family.mf_id)
          .map((cg) => {
            const baseGamme = gammeNameMap.get(cg.mc_pg_id);
            return {
              id: cg.mc_pg_id,
              alias: baseGamme?.alias,
              name: baseGamme?.name || `Gamme #${cg.mc_pg_id}`,
              description: baseGamme?.description,
              image: baseGamme?.image,
              is_active: true,
              is_featured: baseGamme?.is_featured || false,
              is_displayed: true,
              family_id: family.mf_id,
              level: baseGamme?.level || 0,
              sort_order: parseInt(cg.mc_sort),
              products_count: 0,
            };
          })
          .sort((a, b) => a.sort_order - b.sort_order);

        return {
          id: family.mf_id,
          name: family.mf_name,
          system_name: family.mf_name_system,
          description: family.mf_description,
          image: family.mf_pic,
          gammes: familyGammes,
          stats: {
            total_gammes: familyGammes.length,
            manufacturers_count: new Set(catalogGammes?.filter(cg => cg.mc_mf_prime === family.mf_id).map(cg => cg.mc_mf_id)).size,
          },
        };
      }).filter(family => family.gammes.length > 0);

      // 5. Calculer les statistiques globales
      const totalGammes = familiesWithGammes.reduce((sum, f) => sum + f.stats.total_gammes, 0);
      const totalManufacturers = new Set(catalogGammes?.map(cg => cg.mc_mf_id)).size;

      const response: GammeHierarchyResponse = {
        families: familiesWithGammes,
        stats: {
          total_families: familiesWithGammes.length,
          total_gammes: totalGammes,
          total_manufacturers: totalManufacturers,
        },
      };

      this.logger.log(`✅ Hiérarchie: ${response.stats.total_families} familles, ${response.stats.total_gammes} gammes`);
      return response;
    } catch (error) {
      this.logger.error('❌ Erreur getHierarchy:', error);
      throw new BadRequestException('Erreur lors de la construction de la hiérarchie');
    }
  }

  /**
   * 🎯 Récupère les gammes en vedette pour la homepage
   */
  async getFeaturedGammes(limit = 8): Promise<Gamme[]> {
    try {
      const allGammes = await this.getAllGammes();
      return allGammes
        .filter(g => g.is_featured)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('❌ Erreur getFeaturedGammes:', error);
      return [];
    }
  }

  /**
   * 🔍 Recherche de gammes par nom
   */
  async searchGammes(query: string, limit = 20): Promise<Gamme[]> {
    try {
      const allGammes = await this.getAllGammes();
      const searchLower = query.toLowerCase();
      
      return allGammes
        .filter(g => 
          g.name.toLowerCase().includes(searchLower) ||
          g.alias?.toLowerCase().includes(searchLower)
        )
        .slice(0, limit);
    } catch (error) {
      this.logger.error('❌ Erreur searchGammes:', error);
      return [];
    }
  }
}