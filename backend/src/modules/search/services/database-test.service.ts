import { Injectable, Logger } from '@nestjs/common';
import { SupabaseIndexationService } from './supabase-indexation.service';

/**
 * 🧪 SERVICE DE TEST DES APPROCHES
 *
 * Teste différentes méthodes pour récupérer les relations véhicules
 */
@Injectable()
export class DatabaseTestService {
  private readonly logger = new Logger(DatabaseTestService.name);

  constructor(private readonly supabaseService: SupabaseIndexationService) {}

  /**
   * 🎯 APPROCHE 1 : Fonction RPC PostgreSQL
   */
  async testRpcApproach() {
    try {
      const client = this.supabaseService.getClient();
      const start = Date.now();

      const { data, error } = await client.rpc('get_vehicles_with_relations', {
        limit_param: 10,
      });

      const duration = Date.now() - start;

      if (error) {
        this.logger.error('❌ RPC Approach failed:', error);
        return { success: false, error: error.message, approach: 'RPC' };
      }

      this.logger.log(
        `✅ RPC Approach: ${data?.length} vehicles in ${duration}ms`,
      );
      return {
        success: true,
        approach: 'RPC',
        count: data?.length || 0,
        duration,
        sample: data?.[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        approach: 'RPC',
      };
    }
  }

  /**
   * 🎯 APPROCHE 2 : Requêtes séparées + jointure côté app
   */
  async testApplicationJoinApproach() {
    try {
      const client = this.supabaseService.getClient();
      const start = Date.now();

      // 1. Récupérer les types
      const { data: types, error: typesError } = await client
        .from('auto_type')
        .select(
          'type_id, type_name, type_modele_id, type_marque_id, type_fuel, type_power_ps',
        )
        .eq('type_display', '1')
        .limit(10);

      if (typesError) throw typesError;

      // 2. Récupérer les modèles nécessaires
      const modeleIds = [
        ...new Set(
          types?.map((t) => parseInt(t.type_modele_id)).filter(Boolean),
        ),
      ];
      const { data: modeles, error: modelesError } = await client
        .from('auto_modele')
        .select('modele_id, modele_name, modele_marque_id')
        .in('modele_id', modeleIds);

      if (modelesError) throw modelesError;

      // 3. Récupérer les marques nécessaires
      const marqueIds = [
        ...new Set([
          ...types?.map((t) => parseInt(t.type_marque_id)).filter(Boolean),
          ...modeles?.map((m) => m.modele_marque_id).filter(Boolean),
        ]),
      ];
      const { data: marques, error: marquesError } = await client
        .from('auto_marque')
        .select('marque_id, marque_name, marque_logo')
        .in('marque_id', marqueIds);

      if (marquesError) throw marquesError;

      // 4. Jointure côté application
      const vehiclesWithRelations = types?.map((type) => {
        const modele = modeles?.find(
          (m) => m.modele_id === parseInt(type.type_modele_id),
        );
        const marque = marques?.find(
          (m) => m.marque_id === parseInt(type.type_marque_id),
        );

        return {
          ...type,
          modele_name: modele?.modele_name || null,
          marque_name: marque?.marque_name || null,
          marque_logo: marque?.marque_logo || null,
        };
      });

      const duration = Date.now() - start;

      this.logger.log(
        `✅ App Join Approach: ${vehiclesWithRelations?.length} vehicles in ${duration}ms`,
      );
      return {
        success: true,
        approach: 'APPLICATION_JOIN',
        count: vehiclesWithRelations?.length || 0,
        duration,
        sample: vehiclesWithRelations?.[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        approach: 'APPLICATION_JOIN',
      };
    }
  }

  /**
   * 🎯 APPROCHE 3 : Requête SQL brute
   */
  async testRawSqlApproach() {
    try {
      const client = this.supabaseService.getClient();
      const start = Date.now();

      // Utiliser une requête SQL brute via une vue temporaire
      const query = `
        SELECT 
          at.type_id,
          at.type_name,
          at.type_fuel,
          at.type_power_ps,
          am.modele_name,
          ab.marque_name,
          ab.marque_logo
        FROM auto_type at
        LEFT JOIN auto_modele am ON at.type_modele_id::INTEGER = am.modele_id
        LEFT JOIN auto_marque ab ON at.type_marque_id::INTEGER = ab.marque_id
        WHERE at.type_display = '1'
        LIMIT 10
      `;

      // Note: Supabase ne permet pas les requêtes SQL brutes directement
      // Cette approche nécessiterait une fonction RPC ou une vue

      const duration = Date.now() - start;

      this.logger.warn('⚠️ Raw SQL requires RPC function or view');
      return {
        success: false,
        approach: 'RAW_SQL',
        error: 'Requires RPC function or database view',
        duration,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        approach: 'RAW_SQL',
      };
    }
  }

  /**
   * 🏁 COMPARAISON DE TOUTES LES APPROCHES
   */
  async compareAllApproaches() {
    this.logger.log('🧪 Testing all database relationship approaches...');

    const results = {
      timestamp: new Date().toISOString(),
      approaches: [],
    };

    // Test RPC
    const rpcResult = await this.testRpcApproach();
    results.approaches.push(rpcResult);

    // Test Application Join
    const appJoinResult = await this.testApplicationJoinApproach();
    results.approaches.push(appJoinResult);

    // Test Raw SQL
    const rawSqlResult = await this.testRawSqlApproach();
    results.approaches.push(rawSqlResult);

    // Analyse des résultats
    const successful = results.approaches.filter((a) => a.success);
    const fastest =
      successful.length > 0
        ? successful.reduce((prev, curr) =>
            prev.duration < curr.duration ? prev : curr,
          )
        : null;

    return {
      ...results,
      summary: {
        total_approaches: results.approaches.length,
        successful_approaches: successful.length,
        fastest_approach: fastest?.approach || 'NONE',
        fastest_duration: fastest?.duration || null,
        recommendation: this.getRecommendation(successful),
      },
    };
  }

  private getRecommendation(successfulApproaches: any[]) {
    if (successfulApproaches.length === 0) {
      return 'CREATE_DATABASE_VIEW';
    }

    const hasRpc = successfulApproaches.some((a) => a.approach === 'RPC');
    const hasAppJoin = successfulApproaches.some(
      (a) => a.approach === 'APPLICATION_JOIN',
    );

    if (hasRpc) {
      return 'USE_RPC_FUNCTIONS';
    } else if (hasAppJoin) {
      return 'USE_APPLICATION_JOIN';
    } else {
      return 'CREATE_DATABASE_VIEW';
    }
  }
}
