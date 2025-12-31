import { TABLES } from '@repo/database-types';
// 📁 backend/src/modules/catalog/services/gamme-unified.service.ts
// 🎯 Service unifié pour les gammes - remplace gamme.service + catalog-gamme.service + pieces-gamme.service

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import {
  Gamme,
  FamilyWithGammes,
  GammeHierarchyResponse,
} from '../types/gamme.types';

@Injectable()
export class GammeUnifiedService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeUnifiedService.name);

  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * 🎯 Récupère toutes les gammes avec leurs vraies données
   */
  async getAllGammes(): Promise<Gamme[]> {
    try {
      this.logger.log('🎯 Récupération de toutes les gammes...');

      // 1. Récupérer les gammes depuis pieces_gamme (source de vérité pour les noms)
      const { data: piecesGammes, error: piecesError } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select(
          `
          pg_id,
          pg_name,
          pg_alias,
          pg_img,
          pg_display,
          pg_top,
          pg_level,
          pg_parent
        `,
        )
        .eq('pg_display', '1')
        .order('pg_id', { ascending: true });

      if (piecesError) {
        this.logger.error('❌ Erreur pieces_gamme:', piecesError);
        throw new BadRequestException(
          `Erreur récupération gammes: ${piecesError.message}`,
        );
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
      throw new BadRequestException(
        'Erreur lors de la récupération des gammes',
      );
    }
  }

  /**
   * 🏗️ Récupère la hiérarchie familles → gammes unifiée
   * ⚡ Cache Redis: TTL 1h pour optimiser la homepage
   */
  async getHierarchy(): Promise<GammeHierarchyResponse> {
    const cacheKey = 'catalog:hierarchy:full';

    try {
      // 1. Tentative de lecture cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === 'string') {
        this.logger.log('✅ Cache HIT - Hiérarchie depuis Redis (<10ms)');
        return JSON.parse(cached);
      }

      this.logger.log('🔍 Cache MISS - Construction hiérarchie unifiée...');

      // 1. Récupérer les familles
      const { data: families, error: familiesError } = await this.supabase
        .from(TABLES.catalog_family)
        .select('*')
        .eq('mf_display', '1')
        .order('mf_sort', { ascending: true });

      if (familiesError) {
        throw new BadRequestException(
          `Erreur familles: ${familiesError.message}`,
        );
      }

      // 2. Récupérer les gammes avec liaison famille
      const { data: catalogGammes, error: catalogError } = await this.supabase
        .from(TABLES.catalog_gamme)
        .select('*')
        .order('mc_sort', { ascending: true });

      if (catalogError) {
        throw new BadRequestException(
          `Erreur catalog_gamme: ${catalogError.message}`,
        );
      }

      // 3. Récupérer les noms des gammes
      const allGammes = await this.getAllGammes();
      // Créer une Map avec des clés en string pour éviter les problèmes de type
      const gammeNameMap = new Map(allGammes.map((g) => [String(g.id), g]));

      // 4. Construire la hiérarchie
      const familiesWithGammes: FamilyWithGammes[] = (families || [])
        .map((family) => {
          // Filtrer les gammes de cette famille
          const familyGammes = (catalogGammes || [])
            .filter((cg) => cg.mc_mf_prime === family.mf_id)
            .map((cg) => {
              const baseGamme = gammeNameMap.get(String(cg.mc_pg_id));
              if (!baseGamme) {
                this.logger.warn(
                  `⚠️ Gamme ${cg.mc_pg_id} non trouvée dans pieces_gamme`,
                );
              }
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
            sort_order: parseInt(family.mf_sort) || 0,
            gammes: familyGammes,
            stats: {
              total_gammes: familyGammes.length,
              manufacturers_count: new Set(
                catalogGammes
                  ?.filter((cg) => cg.mc_mf_prime === family.mf_id)
                  .map((cg) => cg.mc_mf_id),
              ).size,
            },
          };
        })
        .filter((family) => family.gammes.length > 0)
        .sort((a, b) => a.sort_order - b.sort_order);

      // 5. Calculer les statistiques globales
      const totalGammes = familiesWithGammes.reduce(
        (sum, f) => sum + f.stats.total_gammes,
        0,
      );
      const totalManufacturers = new Set(
        catalogGammes?.map((cg) => cg.mc_mf_id),
      ).size;

      const response: GammeHierarchyResponse = {
        families: familiesWithGammes,
        stats: {
          total_families: familiesWithGammes.length,
          total_gammes: totalGammes,
          total_manufacturers: totalManufacturers,
        },
      };

      this.logger.log(
        `✅ Hiérarchie: ${response.stats.total_families} familles, ${response.stats.total_gammes} gammes`,
      );

      // 2. Mise en cache Redis (TTL: 1h)
      try {
        await this.cacheService.set(cacheKey, JSON.stringify(response), 3600);
        this.logger.log('💾 Hiérarchie mise en cache (TTL: 1h)');
      } catch (cacheError) {
        this.logger.warn('⚠️ Erreur mise en cache:', cacheError);
      }

      return response;
    } catch (error) {
      this.logger.error('❌ Erreur getHierarchy:', error);
      throw new BadRequestException(
        'Erreur lors de la construction de la hiérarchie',
      );
    }
  }

  /**
   * 🎯 Récupère les gammes en vedette pour la homepage
   */
  async getFeaturedGammes(limit = 8): Promise<Gamme[]> {
    try {
      const allGammes = await this.getAllGammes();
      return allGammes.filter((g) => g.is_featured).slice(0, limit);
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
        .filter(
          (g) =>
            g.name.toLowerCase().includes(searchLower) ||
            g.alias?.toLowerCase().includes(searchLower),
        )
        .slice(0, limit);
    } catch (error) {
      this.logger.error('❌ Erreur searchGammes:', error);
      return [];
    }
  }

  /**
   * 🔒 Vérifie si une gamme existe par son ID (pg_id)
   * Utilisé pour la validation SEO des URLs
   */
  async gammeExists(pgId: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select('pg_id')
        .eq('pg_id', pgId)
        .single();

      if (error || !data) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 🔧 Récupère les gammes avec détails pour affichage
   * Format compatible avec l'ancien CatalogGammeService.getGammesForDisplay()
   */
  async getGammesForDisplay(): Promise<{
    manufacturers: { [id: string]: { name: string; gammes: Gamme[] } };
    stats: { total_gammes: number; total_manufacturers: number };
  }> {
    try {
      this.logger.log('🔧 Récupération gammes pour affichage (unifié)...');

      // 1. Récupérer la hiérarchie complète (avec cache Redis)
      const hierarchy = await this.getHierarchy();

      // 2. Transformer vers le format d'affichage par manufacturer
      const manufacturers: {
        [id: string]: { name: string; gammes: Gamme[] };
      } = {};

      // Grouper par famille (qui représente le manufacturer/family)
      for (const family of hierarchy.families) {
        manufacturers[family.id] = {
          name: family.name,
          gammes: family.gammes,
        };
      }

      const stats = {
        total_gammes: hierarchy.stats.total_gammes,
        total_manufacturers: hierarchy.stats.total_families,
      };

      this.logger.log(
        `✅ Affichage préparé (unifié): ${stats.total_gammes} gammes, ${stats.total_manufacturers} fabricants`,
      );

      return { manufacturers, stats };
    } catch (error) {
      this.logger.error('❌ Erreur préparation affichage:', error);
      throw new BadRequestException(
        "Erreur lors de la préparation des données d'affichage",
      );
    }
  }
}
