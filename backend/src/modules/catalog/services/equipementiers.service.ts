import { TABLES } from '@repo/database-types';
// 📁 backend/src/modules/catalog/services/equipementiers.service.ts
// 🏭 Service pour gérer les équipementiers (table pieces_marque)

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';

export interface Equipementier {
  pm_id: string;
  pm_name: string;
  // Colonnes optionnelles qui peuvent ne pas exister
  pm_logo?: string;
  pm_website?: string;
  pm_description?: string;
}

@Injectable()
export class EquipementiersService extends SupabaseBaseService {
  protected readonly logger = new Logger(EquipementiersService.name);

  constructor(private readonly cacheService: CacheService) {
    super();
  }
  // Liste de marques premium pour optimisation SEO (classées par notoriété)
  private readonly PREMIUM_BRANDS = [
    'BOSCH',
    'VALEO',
    'MANN FILTER',
    'GATES',
    'DELPHI',
    'DENSO',
    'BREMBO',
    'ATE',
    'BILSTEIN',
    'SACHS',
    'TRW',
    'FERODO',
    'TEXTAR',
    'SKF',
    'FAG',
    'LUK',
    'INA',
    'LEMFORDER',
    'NRF',
    'PIERBURG',
    'FEBI',
    'CORTECO',
    'ELRING',
    'LUCAS',
    'ZIMMERMANN',
  ];

  /**
   * 🏭 Récupère tous les équipementiers - LOGIQUE PHP REPRODUITE avec filtrage display et tri optimisé SEO
   * ⚡ Cache Redis: TTL 1h pour éviter requêtes répétées homepage (6+ appels identiques)
   * Équivalent PHP: SELECT DISTINCT pm_name, pm_id FROM pieces_marque WHERE pm_display = 1
   * + Tri par notoriété de marque pour SEO
   */
  async getEquipementiers(): Promise<{
    data: Equipementier[];
    stats: { total_equipementiers: number };
    success: boolean;
  }> {
    const cacheKey = 'catalog:equipementiers:all:display';

    try {
      // 1. Tentative lecture cache Redis
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === 'string') {
        this.logger.log('⚡ Cache HIT - Équipementiers depuis Redis (<5ms)');
        return JSON.parse(cached);
      }

      this.logger.log(
        '🔍 Cache MISS - Récupération équipementiers (pieces_marque avec pm_display=1)...',
      );

      // Requête optimisée avec filtrage pm_display = 1
      const { data: equipementiers, error } = await this.supabase
        .from(TABLES.pieces_marque)
        .select('pm_id, pm_name, pm_top, pm_sort')
        .eq('pm_display', '1'); // Filtrer seulement les équipementiers à afficher (string car text field)

      if (error) {
        this.logger.error('❌ Erreur récupération équipementiers:', error);
        throw new BadRequestException(
          `Erreur lors de la récupération des équipementiers: ${error.message}`,
        );
      }

      // Filtrer pour avoir seulement les DISTINCT avec nom non vide
      const uniqueEquipementiers = (equipementiers || [])
        .filter((eq) => eq.pm_name && eq.pm_name.trim() !== '') // Nom non vide
        .reduce((acc, current) => {
          // Déduplication par nom (DISTINCT)
          if (!acc.find((item) => item.pm_name === current.pm_name)) {
            acc.push({
              pm_id: current.pm_id,
              pm_name: current.pm_name,
            });
          }
          return acc;
        }, [] as Equipementier[]);

      // Tri par notoriété de marque pour optimisation SEO
      uniqueEquipementiers.sort((a, b) => {
        const indexA = this.PREMIUM_BRANDS.indexOf(a.pm_name);
        const indexB = this.PREMIUM_BRANDS.indexOf(b.pm_name);

        // Si les deux sont premium, trier par index dans la liste
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }

        // Si seulement A est premium, A vient en premier
        if (indexA !== -1) return -1;

        // Si seulement B est premium, B vient en premier
        if (indexB !== -1) return 1;

        // Si aucun n'est premium, tri alphabétique
        return a.pm_name.localeCompare(b.pm_name);
      });

      const result = {
        data: uniqueEquipementiers,
        stats: {
          total_equipementiers: uniqueEquipementiers.length,
        },
        success: true,
      };

      this.logger.log(
        `✅ ${result.stats.total_equipementiers} équipementiers récupérés (triés par notoriété SEO)`,
      );
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur équipementiers:', error);
      return {
        data: [],
        stats: { total_equipementiers: 0 },
        success: false,
      };
    }
  }

  /**
   * 🏭 Récupère un équipementier par ID
   */
  async getEquipementierById(
    equipementierId: string,
  ): Promise<Equipementier | null> {
    try {
      this.logger.log(`🏭 Récupération équipementier ID: ${equipementierId}`);

      const { data: equipementier, error } = await this.supabase
        .from(TABLES.pieces_marque)
        .select('pm_id, pm_name')
        .eq('pm_id', equipementierId)
        .single();

      if (error || !equipementier) {
        this.logger.warn(`⚠️ Équipementier ${equipementierId} non trouvé`);
        return null;
      }

      this.logger.log(
        `✅ Équipementier ${equipementierId} trouvé: ${equipementier.pm_name}`,
      );
      return equipementier;
    } catch (error) {
      this.logger.error('❌ Erreur équipementier par ID:', error);
      return null;
    }
  }

  /**
   * 🏭 Recherche d'équipementiers par nom
   */
  async searchEquipementiers(searchTerm: string): Promise<{
    data: Equipementier[];
    stats: { results_count: number };
    success: boolean;
  }> {
    try {
      this.logger.log(`🔍 Recherche équipementiers: "${searchTerm}"`);

      const { data: equipementiers, error } = await this.supabase
        .from(TABLES.pieces_marque)
        .select('pm_id, pm_name')
        .ilike('pm_name', `%${searchTerm}%`)
        .order('pm_name', { ascending: true });

      if (error) {
        this.logger.error('❌ Erreur recherche équipementiers:', error);
        throw new BadRequestException(
          `Erreur lors de la recherche d'équipementiers: ${error.message}`,
        );
      }

      const result = {
        data: equipementiers || [],
        stats: {
          results_count: (equipementiers || []).length,
        },
        success: true,
      };

      this.logger.log(
        `✅ ${result.stats.results_count} équipementiers trouvés pour "${searchTerm}"`,
      );
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur recherche équipementiers:', error);
      return {
        data: [],
        stats: { results_count: 0 },
        success: false,
      };
    }
  }
}
