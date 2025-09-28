import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * 🎯 ALIAS RESOLVER SERVICE V5
 * 
 * Résout les alias URL en vrais IDs pour le cross-selling
 * Exemple: "freins" → pg_id: 15, "bmw" → mf_id: 5
 */

interface ResolvedIds {
  typeId: number;
  pgId: number;
  marqueId: number;
  modeleId: number;
  success: boolean;
  aliases: {
    gamme: string;
    marque: string;  
    modele: string;
    type: string;
  };
}

@Injectable()
export class AliasResolverService extends SupabaseBaseService {
  protected readonly logger = new Logger(AliasResolverService.name);

  /**
   * 🎯 Résout tous les alias en une fois
   */
  async resolveAliases(
    gammeAlias: string,
    marqueAlias: string, 
    modeleAlias: string,
    typeAlias: string
  ): Promise<ResolvedIds> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🔍 Résolution aliases: ${gammeAlias}/${marqueAlias}/${modeleAlias}/${typeAlias}`);
      
      // 🚀 Résolution en parallèle
      const [gammeId, marqueId, typeData] = await Promise.allSettled([
        this.resolveGammeAlias(gammeAlias),
        this.resolveMarqueAlias(marqueAlias),
        this.resolveVehicleAlias(marqueAlias, modeleAlias, typeAlias)
      ]);

      const result: ResolvedIds = {
        pgId: gammeId.status === 'fulfilled' ? gammeId.value : 0,
        marqueId: marqueId.status === 'fulfilled' ? marqueId.value : 0,
        typeId: typeData.status === 'fulfilled' ? typeData.value.typeId : 0,
        modeleId: typeData.status === 'fulfilled' ? typeData.value.modeleId : 0,
        success: gammeId.status === 'fulfilled' && marqueId.status === 'fulfilled' && typeData.status === 'fulfilled',
        aliases: {
          gamme: gammeAlias,
          marque: marqueAlias,
          modele: modeleAlias, 
          type: typeAlias
        }
      };

      const responseTime = Date.now() - startTime;
      this.logger.log(`✅ IDs résolus en ${responseTime}ms: pg=${result.pgId}, type=${result.typeId}, mf=${result.marqueId}`);
      
      return result;

    } catch (error) {
      this.logger.error('❌ Erreur résolution aliases:', error);
      
      return {
        typeId: 0,
        pgId: 0,  
        marqueId: 0,
        modeleId: 0,
        success: false,
        aliases: { gamme: gammeAlias, marque: marqueAlias, modele: modeleAlias, type: typeAlias }
      };
    }
  }

  /**
   * 🎯 Résout alias gamme → pg_id
   */
  private async resolveGammeAlias(alias: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id')
        .eq('pg_alias', alias)
        .single();

      if (error || !data) {
        // Fallback: chercher par nom similaire
        const { data: fallback } = await this.supabase
          .from('pieces_gamme')
          .select('pg_id')
          .ilike('pg_name', `%${alias}%`)
          .limit(1)
          .single();

        return fallback?.pg_id || 0;
      }

      return data.pg_id;

    } catch (error) {
      this.logger.warn(`⚠️ Gamme alias '${alias}' non trouvé`);
      return 0;
    }
  }

  /**
   * 🎯 Résout alias marque → marque_id (logique PHP originale)
   */
  private async resolveMarqueAlias(alias: string): Promise<number> {
    try {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9-]/g, '');
      
      // Recherche dans AUTO_MARQUE (→ auto_marque)
      const { data, error } = await this.supabase
        .from('auto_marque')
        .select('marque_id')
        .or(`marque_name.ilike.%${alias}%,marque_alias.ilike.%${cleanAlias}%`)
        .eq('marque_display', 1)
        .limit(1)
        .single();

      if (error || !data) {
        this.logger.warn(`⚠️ Marque alias '${alias}' non trouvé dans auto_marque`);
        return 0;
      }

      return data.marque_id;

    } catch (error) {
      this.logger.warn(`⚠️ Erreur résolution marque '${alias}':`, error);
      return 0;
    }
  }

  /**
   * 🎯 Résout véhicule complet → type_id + modele_id (logique PHP originale simplifiée)
   */
  private async resolveVehicleAlias(
    marqueAlias: string,
    modeleAlias: string,
    typeAlias: string,
  ): Promise<{ typeId: number; modeleId: number }> {
    try {
      // Étape 1 : Trouver la marque pour filtrer
      const marqueId = await this.resolveMarqueAlias(marqueAlias);
      if (marqueId === 0) {
        return { typeId: 0, modeleId: 0 };
      }

      // Étape 2 : Recherche dans auto_type avec filtrage par marque
      const { data, error } = await this.supabase
        .from('auto_type')
        .select('type_id, type_modele_id, type_name, type_alias')
        .eq('type_display', 1)
        .eq('type_marque_id', marqueId)
        .or(`type_alias.ilike.%${typeAlias}%,type_name.ilike.%${typeAlias}%`)
        .limit(1)
        .single();

      if (error || !data) {
        this.logger.warn(
          `⚠️ Type '${typeAlias}' non trouvé pour marque ${marqueId} dans auto_type`,
        );
        return { typeId: 0, modeleId: 0 };
      }

      return {
        typeId: data.type_id,
        modeleId: data.type_modele_id,
      };
    } catch (error) {
      this.logger.warn(`⚠️ Erreur résolution véhicule:`, error);
      return { typeId: 0, modeleId: 0 };
    }
  }

  /**
   * 🏥 Health check
   */
  async getHealthStatus() {
    try {
      // Test basique des tables principales
      const [gammes, marques, types] = await Promise.allSettled([
        this.supabase.from('pieces_gamme').select('count', { count: 'exact', head: true }),
        this.supabase.from('catalog_marque_fr').select('count', { count: 'exact', head: true }),
        this.supabase.from('catalog_type_2').select('count', { count: 'exact', head: true })
      ]);

      return {
        service: 'AliasResolverService',
        status: 'healthy',
        tables: {
          pieces_gamme: gammes.status === 'fulfilled' ? 'ok' : 'error',
          catalog_marque_fr: marques.status === 'fulfilled' ? 'ok' : 'error', 
          catalog_type_2: types.status === 'fulfilled' ? 'ok' : 'error'
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        service: 'AliasResolverService',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}