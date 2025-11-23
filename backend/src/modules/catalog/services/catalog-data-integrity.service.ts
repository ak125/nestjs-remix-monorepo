import { TABLES } from '@repo/database-types';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';

/**
 * 🛡️ Service de validation de l'intégrité des données du catalogue
 *
 * Responsabilités :
 * 1. Valider que les type_id existent dans auto_type
 * 2. Valider que les gamme_id existent dans pieces_gamme
 * 3. Détecter les relations orphelines dans pieces_relation_type
 * 4. Fournir des recommandations pour le nettoyage
 * 5. ⚡ Cache Redis pour optimiser les validations répétées (optionnel)
 */
@Injectable()
export class CatalogDataIntegrityService extends SupabaseBaseService {
  protected readonly logger = new Logger(CatalogDataIntegrityService.name);

  constructor(@Optional() private readonly cacheService?: CacheService) {
    super();
    if (!cacheService) {
      this.logger.warn('⚠️ Cache Redis non disponible - validation sans cache');
    } else {
      this.logger.log('✅ Cache Redis activé pour validation (TTL: 1h)');
    }
  }

  // ⚡ Durée de cache: 1 heure (les données véhicules changent rarement)
  private readonly CACHE_TTL = 3600; // 1h en secondes

  /**
   * ✅ Valide qu'un type_id existe dans auto_type
   */
  async validateTypeId(typeId: number): Promise<{
    valid: boolean;
    type_id: number;
    type_name?: string;
    error?: string;
  }> {
    try {
      this.logger.log(`🔍 Validation type_id=${typeId}`);

      // ✅ FIX: Utiliser .maybeSingle() au lieu de .single()
      // .single() lance une erreur si 0 ou 2+ résultats
      // .maybeSingle() retourne data: null si 0 résultats (sans erreur)
      const { data, error } = await this.client
        .from('auto_type')
        .select('type_id, type_name, type_modele_id')
        .eq('type_id', String(typeId))
        .maybeSingle();

      this.logger.log(
        `📊 Result: data=${!!data}, error=${error?.message || 'none'}`,
      );

      if (error) {
        this.logger.error(
          `❌ Erreur Supabase lors de la validation type_id=${typeId}:`,
          error,
        );
        return {
          valid: false,
          type_id: typeId,
          error: `Erreur technique: ${error.message}`,
        };
      }

      if (!data) {
        this.logger.warn(`⚠️ Type ID ${typeId} n'existe pas dans auto_type`);
        return {
          valid: false,
          type_id: typeId,
          error: `Type ID ${typeId} n'existe pas dans auto_type`,
        };
      }

      this.logger.log(`✅ Type ID ${typeId} existe: ${data.type_name}`);
      return {
        valid: true,
        type_id: parseInt(data.type_id) || typeId,
        type_name: data.type_name,
      };
    } catch (error) {
      this.logger.error(
        `❌ Exception lors de la validation type_id ${typeId}:`,
        error,
      );
      return {
        valid: false,
        type_id: typeId,
        error: error.message,
      };
    }
  }

  /**
   * ✅ Valide qu'un gamme_id existe dans pieces_gamme
   */
  async validateGammeId(gammeId: number): Promise<{
    valid: boolean;
    gamme_id: number;
    gamme_name?: string;
    error?: string;
  }> {
    try {
      // ✅ FIX: Utiliser .maybeSingle() au lieu de .single()
      const { data, error } = await this.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name')
        .eq('pg_id', String(gammeId))
        .maybeSingle();

      if (error) {
        this.logger.error(
          `❌ Erreur Supabase lors de la validation gamme_id=${gammeId}:`,
          error,
        );
        return {
          valid: false,
          gamme_id: gammeId,
          error: `Erreur technique: ${error.message}`,
        };
      }

      if (!data) {
        this.logger.warn(
          `⚠️ Gamme ID ${gammeId} n'existe pas dans pieces_gamme`,
        );
        return {
          valid: false,
          gamme_id: gammeId,
          error: `Gamme ID ${gammeId} n'existe pas dans pieces_gamme`,
        };
      }

      return {
        valid: true,
        gamme_id: parseInt(data.pg_id) || gammeId,
        gamme_name: data.pg_name,
      };
    } catch (error) {
      this.logger.error(
        `❌ Exception lors de la validation gamme_id ${gammeId}:`,
        error,
      );
      return {
        valid: false,
        gamme_id: gammeId,
        error: error.message,
      };
    }
  }

  /**
   * 🔍 Vérifie l'intégrité d'une combinaison type_id + gamme_id
   *
   * ⚡ AVEC CACHE REDIS pour optimiser les validations répétées
   * - Clé: catalog:validate:{typeId}:{gammeId}
   * - TTL: 1 heure (les données changent rarement)
   *
   * Retourne :
   * - valid: true si la combinaison est valide
   * - relations_count: nombre de pièces compatibles
   * - data_quality: % de pièces avec marque, prix, image
   * - recommendation: 200 OK, 410 Gone, ou autre
   */
  async validateTypeGammeCompatibility(
    typeId: number,
    gammeId: number,
  ): Promise<{
    valid: boolean;
    type_id: number;
    gamme_id: number;
    type_exists: boolean;
    gamme_exists: boolean;
    relations_count: number;
    data_quality?: {
      pieces_with_brand_percent: number;
      pieces_with_price_percent: number;
      pieces_with_image_percent: number;
    };
    http_status: 200 | 404 | 410;
    recommendation: string;
    error?: string;
  }> {
    // ⚡ 1. Vérifier le cache Redis (si disponible)
    const cacheKey = `catalog:validate:${typeId}:${gammeId}`;
    if (this.cacheService) {
      try {
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
          this.logger.log(
            `⚡ Cache HIT pour type_id=${typeId}, gamme_id=${gammeId}`,
          );
          return JSON.parse(cached as string);
        }
      } catch {
        this.logger.warn('⚠️ Erreur lecture cache Redis, continue sans cache');
      }
    }

    this.logger.log(
      `🔍 Cache MISS pour type_id=${typeId}, gamme_id=${gammeId} - validation DB`,
    );

    // 2. Valider que le type_id existe
    const typeValidation = await this.validateTypeId(typeId);

    // 3. Valider que le gamme_id existe
    const gammeValidation = await this.validateGammeId(gammeId);

    // Si un des deux n'existe pas, retour 404
    if (!typeValidation.valid || !gammeValidation.valid) {
      return {
        valid: false,
        type_id: typeId,
        gamme_id: gammeId,
        type_exists: typeValidation.valid,
        gamme_exists: gammeValidation.valid,
        relations_count: 0,
        http_status: 404,
        recommendation: '404 Not Found - Type ou Gamme inexistant',
        error: [
          !typeValidation.valid && typeValidation.error,
          !gammeValidation.valid && gammeValidation.error,
        ]
          .filter(Boolean)
          .join('; '),
      };
    }

    // 3. Vérifier les relations dans pieces_relation_type AVEC FILTRES PHP
    // Utilise la même RPC function que le catalogue pour garantir la cohérence
    const { data: rpcData, error: rpcError } = await this.client.rpc(
      'get_vehicle_compatible_gammes_php',
      { p_type_id: typeId },
    );

    if (rpcError) {
      return {
        valid: false,
        type_id: typeId,
        gamme_id: gammeId,
        type_exists: true,
        gamme_exists: true,
        relations_count: 0,
        http_status: 404,
        recommendation: 'Erreur lors de la vérification des relations',
        error: rpcError.message,
      };
    }

    // Vérifier si gammeId est dans les résultats RPC
    const gammeInResults = rpcData?.find(
      (row) => row.pg_id === parseInt(String(gammeId)),
    );
    const relationsCount = gammeInResults ? gammeInResults.total_pieces : 0;

    // Si aucune relation, retour 410 Gone
    if (!relationsCount || relationsCount === 0) {
      return {
        valid: false,
        type_id: typeId,
        gamme_id: gammeId,
        type_exists: true,
        gamme_exists: true,
        relations_count: 0,
        http_status: 410,
        recommendation: '410 Gone - Aucune pièce compatible trouvée',
      };
    }

    // 4. Analyser la qualité des données (échantillon rapide)
    const { data: relations } = await this.client
      .from('pieces_relation_type')
      .select('rtp_piece_id, rtp_pm_id')
      .eq('rtp_type_id', String(typeId))
      .eq('rtp_pg_id', String(gammeId))
      .limit(100);
    
    // Compter les pièces avec une marque (rtp_pm_id non null et > 0)
    const piecesWithBrand = relations?.filter(
      (r) => r.rtp_pm_id && parseInt(String(r.rtp_pm_id)) > 0
    ).length || 0;
    
    const brandPercent = relations?.length
      ? (piecesWithBrand / relations.length) * 100
      : 0;

    // Si < 50% ont une marque, retour 410 Gone (données de mauvaise qualité)
    if (brandPercent < 50) {
      return {
        valid: false,
        type_id: typeId,
        gamme_id: gammeId,
        type_exists: true,
        gamme_exists: true,
        relations_count: relationsCount,
        data_quality: {
          pieces_with_brand_percent: Math.round(brandPercent * 10) / 10,
          pieces_with_price_percent: 0, // Pourrait être calculé
          pieces_with_image_percent: 0, // Pourrait être calculé
        },
        http_status: 410,
        recommendation:
          '410 Gone - Qualité des données insuffisante (< 50% avec marque)',
      };
    }

    // ✅ Tout est OK
    const result = {
      valid: true,
      type_id: typeId,
      gamme_id: gammeId,
      type_exists: true,
      gamme_exists: true,
      relations_count: relationsCount,
      data_quality: {
        pieces_with_brand_percent: Math.round(brandPercent * 10) / 10,
        pieces_with_price_percent: 0,
        pieces_with_image_percent: 0,
      },
      http_status: 200 as const,
      recommendation: '200 OK - Données valides et de bonne qualité',
    };

    // ⚡ Sauvegarder dans le cache Redis (1h TTL) - si disponible
    if (this.cacheService) {
      try {
        await this.cacheService.set(
          cacheKey,
          JSON.stringify(result),
          this.CACHE_TTL,
        );
        this.logger.log(
          `💾 Résultat mis en cache pour type_id=${typeId}, gamme_id=${gammeId} (TTL: ${this.CACHE_TTL}s)`,
        );
      } catch {
        this.logger.warn(`⚠️ Erreur écriture cache Redis, continue sans cache`);
      }
    }

    return result;
  }

  /**
   * 🧹 Trouve toutes les relations orphelines dans pieces_relation_type
   * (relations avec des type_id qui n'existent pas dans auto_type)
   */
  async findOrphanTypeRelations(limit = 100): Promise<{
    total_orphans: number;
    orphan_type_ids: number[];
    sample_relations: Array<{
      type_id: number;
      gamme_id: number;
      pieces_count: number;
    }>;
  }> {
    try {
      // 1. Récupérer tous les type_id uniques dans pieces_relation_type
      const { data: relationTypeIds } = await this.client
        .from('pieces_relation_type')
        .select('rtp_type_id')
        .limit(10000);

      const uniqueTypeIds = [
        ...new Set(relationTypeIds?.map((r) => r.rtp_type_id) || []),
      ];

      this.logger.log(
        `🔍 Vérification de ${uniqueTypeIds.length} type_ids uniques...`,
      );

      // 2. Pour chaque type_id, vérifier s'il existe dans auto_type
      const orphanTypeIds: number[] = [];

      // Traiter par batch de 50 pour éviter de surcharger
      for (let i = 0; i < uniqueTypeIds.length; i += 50) {
        const batch = uniqueTypeIds.slice(i, i + 50);

        const { data: existingTypes } = await this.client
          .from('auto_type')
          .select('type_id')
          .in('type_id', batch);

        const existingTypeIds = new Set(
          existingTypes?.map((t) => t.type_id) || [],
        );

        const orphansInBatch = batch.filter((id) => !existingTypeIds.has(id));
        orphanTypeIds.push(...orphansInBatch);

        this.logger.log(
          `📊 Batch ${i / 50 + 1}: ${orphansInBatch.length} orphelins trouvés`,
        );
      }

      // 3. Compter les pièces affectées pour chaque type orphelin
      const sampleRelations = [];
      for (const typeId of orphanTypeIds.slice(0, limit)) {
        const { data: gammes } = await this.client
          .from('pieces_relation_type')
          .select('rtp_pg_id, rtp_piece_id')
          .eq('rtp_type_id', typeId);

        const gammeGroups = new Map<number, number>();
        gammes?.forEach((r) => {
          const count = gammeGroups.get(r.rtp_pg_id) || 0;
          gammeGroups.set(r.rtp_pg_id, count + 1);
        });

        for (const [gammeId, count] of gammeGroups.entries()) {
          sampleRelations.push({
            type_id: typeId,
            gamme_id: gammeId,
            pieces_count: count,
          });
        }
      }

      return {
        total_orphans: orphanTypeIds.length,
        orphan_type_ids: orphanTypeIds,
        sample_relations: sampleRelations.slice(0, limit),
      };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche des orphelins:', error);
      throw error;
    }
  }

  /**
   * 📊 Génère un rapport complet de santé du catalogue
   */
  async generateHealthReport(): Promise<{
    timestamp: string;
    summary: {
      total_types_in_auto_type: number;
      total_gammes_in_pieces_gamme: number;
      total_relations_in_pieces_relation_type: number;
      orphan_relations_count: number;
    };
    top_issues: Array<{
      type_id: number;
      gamme_id: number;
      issue: string;
      severity: 'critical' | 'warning' | 'info';
    }>;
  }> {
    const [typesCount, gammesCount, relationsCount, orphans] =
      await Promise.all([
        this.client
          .from('auto_type')
          .select('type_id', { count: 'exact', head: true }),
        this.client
          .from(TABLES.pieces_gamme)
          .select('pg_id', { count: 'exact', head: true }),
        this.client
          .from('pieces_relation_type')
          .select('rtp_piece_id', { count: 'exact', head: true }),
        this.findOrphanTypeRelations(20),
      ]);

    const topIssues = orphans.sample_relations.map((rel) => ({
      type_id: rel.type_id,
      gamme_id: rel.gamme_id,
      issue: `Type ID ${rel.type_id} n'existe pas dans auto_type mais a ${rel.pieces_count} pièces`,
      severity: 'critical' as const,
    }));

    return {
      timestamp: new Date().toISOString(),
      summary: {
        total_types_in_auto_type: typesCount.count || 0,
        total_gammes_in_pieces_gamme: gammesCount.count || 0,
        total_relations_in_pieces_relation_type: relationsCount.count || 0,
        orphan_relations_count: orphans.total_orphans,
      },
      top_issues: topIssues,
    };
  }
}
