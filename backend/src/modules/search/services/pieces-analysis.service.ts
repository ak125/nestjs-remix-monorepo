import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * 🔍 PiecesAnalysisService - Analyse de la table pieces
 */
@Injectable()
export class PiecesAnalysisService extends SupabaseBaseService {
  protected readonly logger = new Logger(PiecesAnalysisService.name);

  /**
   * 🔍 Analyser la table pieces pour comprendre son contenu
   */
  async analyzePiecesTable() {
    try {
      this.logger.log('🔍 Début analyse table pieces...');

      // 1. Compter les pièces totales
      const { count: totalCount } = await this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true });

      // 2. Compter les pièces actives (piece_display = true)
      const { count: activeCount } = await this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true);

      // 3. Échantillon de pièces
      const { data: samplePieces } = await this.client
        .from(TABLES.pieces)
        .select('piece_id, piece_name, piece_ref, piece_des, piece_display')
        .eq('piece_display', true)
        .not('piece_name', 'is', null)
        .limit(20);

      // 4. Rechercher tous les filtres (actifs et inactifs)
      const { data: allFilters } = await this.client
        .from(TABLES.pieces)
        .select('piece_name, piece_ref, piece_des, piece_display')
        .ilike('piece_name', '%filtre%')
        .limit(50);

      // 5. Rechercher spécifiquement les filtres à air
      const { data: airFilters } = await this.client
        .from(TABLES.pieces)
        .select('piece_name, piece_ref, piece_des, piece_display')
        .or('piece_name.ilike.%filtre*air%,piece_name.ilike.%air*filtre%')
        .limit(20);

      // 6. Analyser les types de pièces les plus courants (sans GROUP BY)
      const { data: commonTypes } = await this.client
        .from(TABLES.pieces)
        .select('piece_name')
        .eq('piece_display', true)
        .not('piece_name', 'is', null)
        .order('piece_name')
        .limit(50);

      this.logger.log(`📊 Résultats analyse pieces:`);
      this.logger.log(`   - Total: ${totalCount} pièces`);
      this.logger.log(`   - Actives: ${activeCount} pièces`);
      this.logger.log(`   - Filtres: ${allFilters?.length || 0} trouvés`);
      this.logger.log(`   - Filtres à air: ${airFilters?.length || 0} trouvés`);

      return {
        success: true,
        data: {
          counts: {
            total: totalCount,
            active: activeCount,
            inactive: (totalCount || 0) - (activeCount || 0),
          },
          samplePieces,
          filters: {
            all: allFilters,
            airFilters,
            hasFilters: (allFilters?.length || 0) > 0,
            hasAirFilters: (airFilters?.length || 0) > 0,
          },
          commonTypes: commonTypes?.slice(0, 10),
          analysis: {
            activeRatio:
              activeCount && totalCount
                ? ((activeCount / totalCount) * 100).toFixed(2)
                : '0',
            recommendIndexActive: (activeCount || 0) > 0,
            totalFiltersAvailable: allFilters?.length || 0,
          },
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur analyse pieces:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * 🔍 Rechercher des pièces par nom
   */
  async searchPiecesByName(query: string, limit: number = 20) {
    try {
      const { data: pieces } = await this.client
        .from(TABLES.pieces)
        .select('piece_id, piece_name, piece_ref, piece_des, piece_display')
        .ilike('piece_name', `%${query}%`)
        .limit(limit);

      return {
        success: true,
        query,
        count: pieces?.length || 0,
        pieces: pieces || [],
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche pieces "${query}":`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * 🔍 Obtenir la structure complète de la table pieces
   */
  /**
   * Alias pour getCompleteStructure - compatibilité contrôleur
   */
  async getPiecesStructure() {
    return this.getCompleteStructure();
  }

  async getCompleteStructure() {
    try {
      // Récupérer un échantillon avec toutes les colonnes
      const { data: sample, error } = await this.client
        .from(TABLES.pieces)
        .select('*')
        .limit(1);

      if (error) {
        throw new Error(`Erreur structure: ${error.message}`);
      }

      return {
        sampleRecord: sample?.[0] || null,
        availableColumns: sample?.[0] ? Object.keys(sample[0]) : [],
        columnCount: sample?.[0] ? Object.keys(sample[0]).length : 0,
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération structure:', error);
      throw error;
    }
  }

  /**
   * 🔍 Recherche complète des filtres à air avec toutes les colonnes
   */
  async searchCompleteAirFilters(limit: number = 50) {
    try {
      // Recherche exacte pour "Filtre à air" avec toutes les colonnes
      const { data: exactMatches, error: exactError } = await this.client
        .from(TABLES.pieces)
        .select('*')
        .eq('piece_name', 'Filtre à air')
        .limit(limit);

      if (exactError) {
        throw new Error(`Erreur recherche exacte: ${exactError.message}`);
      }

      // Recherche des variantes
      const { data: variants, error: variantError } = await this.client
        .from(TABLES.pieces)
        .select('*')
        .or(
          'piece_name.eq.Filtre à air secondaire,piece_name.ilike.Filtre à air%',
        )
        .limit(limit);

      if (variantError) {
        throw new Error(`Erreur recherche variantes: ${variantError.message}`);
      }

      // Combiner et dédupliquer par piece_id
      const combined = [...(exactMatches || []), ...(variants || [])];
      const deduplicated = combined.filter(
        (item, index) =>
          combined.findIndex((i) => i.piece_id === item.piece_id) === index,
      );

      // Limiter aux premiers résultats
      const results = deduplicated.slice(0, limit);

      // Statistiques
      const exact = results.filter(
        (r) => r.piece_name === 'Filtre à air',
      ).length;
      const variantes = results.length;
      const actifs = results.filter((r) => r.piece_display === true).length;
      const inactifs = results.filter((r) => r.piece_display === false).length;

      // Analyser les colonnes d'équipementiers/marques disponibles
      const columns = results.length > 0 ? Object.keys(results[0]) : [];
      const brandColumns = columns.filter(
        (col) =>
          col.toLowerCase().includes('brand') ||
          col.toLowerCase().includes('marque') ||
          col.toLowerCase().includes('fabricant') ||
          col.toLowerCase().includes('equipementier'),
      );

      return {
        count: results.length,
        filtres: results,
        stats: {
          exact,
          variantes,
          actifs,
          inactifs,
        },
        metadata: {
          totalColumns: columns.length,
          allColumns: columns,
          brandColumns,
          hasBrandInfo: brandColumns.length > 0,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur recherche filtres à air complète:', error);
      throw error;
    }
  }

  /**
   * 🏭 Analyser les informations sur les marques/équipementiers
   */
  async getBrandInfo() {
    try {
      // D'abord, récupérer les IDs uniques pour comprendre les relations
      const { data: brandIds, error: idsError } = await this.client
        .from(TABLES.pieces)
        .select('piece_pm_id, piece_pg_id, piece_ga_id')
        .not('piece_pm_id', 'is', null)
        .limit(100);

      if (idsError) throw idsError;

      // Analyser la distribution des IDs
      const pmIds = [
        ...new Set(brandIds?.map((p) => p.piece_pm_id).filter((id) => id)),
      ];
      const pgIds = [
        ...new Set(brandIds?.map((p) => p.piece_pg_id).filter((id) => id)),
      ];
      const gaIds = [
        ...new Set(brandIds?.map((p) => p.piece_ga_id).filter((id) => id)),
      ];

      // Essayer de trouver les tables de correspondance
      const tableAttempts = [
        'piece_marques',
        'marques',
        'brands',
        'fabricants',
        'piece_brands',
        'piece_fabricants',
        'equipmentiers',
        'piece_pm',
        'piece_pg',
        'piece_ga',
        'pm',
        'pg',
        'ga',
      ];

      const foundTables = {};

      for (const tableName of tableAttempts) {
        try {
          const { data, error } = await this.client
            .from(tableName)
            .select('*')
            .limit(5);

          if (!error && data?.length > 0) {
            foundTables[tableName] = {
              sample: data.slice(0, 3),
              columns: Object.keys(data[0]),
              recordCount: data.length,
            };
          }
        } catch {
          // Table n'existe pas, continuer
        }
      }

      // Récupérer quelques pièces avec leurs IDs pour analyse
      const { data: samplePieces } = await this.client
        .from(TABLES.pieces)
        .select(
          'piece_id, piece_name, piece_ref, piece_pm_id, piece_pg_id, piece_ga_id',
        )
        .not('piece_pm_id', 'is', null)
        .limit(20);

      return {
        brandIdDistribution: {
          piece_pm_ids: pmIds.slice(0, 10),
          piece_pg_ids: pgIds.slice(0, 10),
          piece_ga_ids: gaIds.slice(0, 10),
          total_pm_ids: pmIds.length,
          total_pg_ids: pgIds.length,
          total_ga_ids: gaIds.length,
        },
        foundTables,
        samplePiecesWithBrands: samplePieces || [],
        tablesSearched: tableAttempts,
        analysis: {
          hasFoundTables: Object.keys(foundTables).length > 0,
          potentialBrandTables: Object.keys(foundTables),
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur analyse marques:', error);
      throw error;
    }
  }
}
