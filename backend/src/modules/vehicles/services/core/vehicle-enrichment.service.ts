import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { VehicleCacheService, CacheType } from './vehicle-cache.service';

/**
 * 🔧 VEHICLE ENRICHMENT SERVICE - Enrichissement des données véhicules
 * 
 * Responsabilités :
 * - Mapping avec table cars_engine
 * - Enrichissement des codes moteur
 * - Fallback automatique si code moteur absent
 * - Cache des données enrichies
 * 
 * Mapping disponible :
 * - Par eng_id (ID moteur cars_engine)
 * - Par eng_code (codes moteur réels)
 * - Par type_id (fallback pour types spécifiques)
 */

export interface EngineInfo {
  id: string;
  mfaId: string;
  code: string;
}

export interface EnrichedEngineDetails {
  engineId?: string;
  engineMfaId?: string;
  engineCode: string;
  enriched: boolean;
}

@Injectable()
export class VehicleEnrichmentService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleEnrichmentService.name);
  
  // 🔧 MAPPING CARS_ENGINE - Codes moteur réels
  private readonly engineMapping = new Map<string, EngineInfo>([
    // Mapping par eng_id (ID du moteur)
    ['100', { id: '100', mfaId: '2', code: 'AR 31010' }],
    ['10007', { id: '10007', mfaId: '36', code: 'F4A' }],
    ['10048', { id: '10048', mfaId: '92', code: '930.50' }],
    ['1006', { id: '1006', mfaId: '35', code: '159 A3.046' }],
    ['10067', { id: '10067', mfaId: '36', code: 'RTK' }],
    ['10068', { id: '10068', mfaId: '36', code: 'RTJ' }],
    ['10069', { id: '10069', mfaId: '36', code: 'L1F' }],
    ['1007', { id: '1007', mfaId: '35', code: '159 A3.048' }],
    ['1008', { id: '1008', mfaId: '35', code: '159 A4.000' }],
    ['10087', { id: '10087', mfaId: '2', code: 'AR 10832' }],
    ['1009', { id: '1009', mfaId: '35', code: '159 A4.046' }],
    ['101', { id: '101', mfaId: '2', code: 'AR 31016' }],
    ['1011', { id: '1011', mfaId: '35', code: '159 A5.046' }],
    ['1012', { id: '1012', mfaId: '35', code: '159 A6.046' }],
    
    // Mapping par eng_code (vrais codes moteur de la table cars_engine)
    ['AR 31010', { id: '100', mfaId: '2', code: 'AR 31010' }],
    ['F4A', { id: '10007', mfaId: '36', code: 'F4A' }],
    ['930.50', { id: '10048', mfaId: '92', code: '930.50' }],
    ['159 A3.046', { id: '1006', mfaId: '35', code: '159 A3.046' }],
    ['RTK', { id: '10067', mfaId: '36', code: 'RTK' }],
    ['RTJ', { id: '10068', mfaId: '36', code: 'RTJ' }],
    ['L1F', { id: '10069', mfaId: '36', code: 'L1F' }],
    ['159 A3.048', { id: '1007', mfaId: '35', code: '159 A3.048' }],
    ['159 A4.000', { id: '1008', mfaId: '35', code: '159 A4.000' }],
    ['AR 10832', { id: '10087', mfaId: '2', code: 'AR 10832' }],
    ['159 A4.046', { id: '1009', mfaId: '35', code: '159 A4.046' }],
    ['AR 31016', { id: '101', mfaId: '2', code: 'AR 31016' }],
    ['159 A5.046', { id: '1011', mfaId: '35', code: '159 A5.046' }],
    ['159 A6.046', { id: '1012', mfaId: '35', code: '159 A6.046' }],
    
    // Mapping par type_id pour enrichissement direct (exemples)
    ['112018', { id: '112018', mfaId: 'AUDI', code: 'TFSI 1.0L TURBO' }],
    ['112021', { id: '112021', mfaId: 'AUDI', code: 'TFSI 1.0L TURBO' }],
  ]);

  constructor(
    private cacheService: VehicleCacheService,
  ) {
    super();
    this.logger.log('🔧 VehicleEnrichmentService initialisé');
    this.logger.log(`📊 Mapping moteur initialisé avec ${this.engineMapping.size} codes`);
  }

  /**
   * 🔧 Enrichir un véhicule avec les données moteur
   */
  async enrichVehicle(vehicleData: any): Promise<any> {
    if (!vehicleData) return vehicleData;

    try {
      // Génération de la clé de cache pour cet enrichissement
      const cacheKey = this.generateEnrichmentCacheKey(vehicleData);
      
      // Vérifier le cache d'abord
      const cached = await this.cacheService.get<any>(CacheType.ENRICHMENT, cacheKey);
      if (cached) {
        return cached;
      }

      // Enrichissement
      const enriched = {
        ...vehicleData,
        engineDetails: await this.getEngineDetails(vehicleData)
      };

      // Mise en cache du résultat
      await this.cacheService.set(CacheType.ENRICHMENT, cacheKey, enriched);

      return enriched;
    } catch (error) {
      this.logger.error('Erreur enrichissement véhicule:', error);
      return vehicleData; // Retour du véhicule non enrichi en cas d'erreur
    }
  }

  /**
   * 🔧 Enrichir une liste de véhicules
   */
  async enrichVehicles(vehicles: any[]): Promise<any[]> {
    if (!vehicles?.length) return vehicles;

    try {
      const enrichmentPromises = vehicles.map(vehicle => this.enrichVehicle(vehicle));
      return await Promise.all(enrichmentPromises);
    } catch (error) {
      this.logger.error('Erreur enrichissement véhicules:', error);
      return vehicles; // Retour de la liste non enrichie en cas d'erreur
    }
  }

  /**
   * 🔍 Obtenir les détails moteur pour un véhicule
   */
  private async getEngineDetails(vehicleData: any): Promise<EnrichedEngineDetails> {
    let engineInfo: EngineInfo | null = null;

    // Stratégie 1: Chercher par type_engine_code
    if (vehicleData.type_engine_code) {
      engineInfo = this.engineMapping.get(vehicleData.type_engine_code);
    }

    // Stratégie 2: Chercher par code moteur alternatif
    if (!engineInfo && vehicleData.type_engine) {
      engineInfo = this.engineMapping.get(vehicleData.type_engine);
    }

    // Stratégie 3: Chercher par type_id comme fallback
    if (!engineInfo && vehicleData.type_id) {
      engineInfo = this.engineMapping.get(vehicleData.type_id.toString());
    }

    // Retourner les détails enrichis ou le fallback
    if (engineInfo) {
      return {
        engineId: engineInfo.id,
        engineMfaId: engineInfo.mfaId,
        engineCode: engineInfo.code,
        enriched: true
      };
    } else {
      return {
        engineCode: vehicleData.type_engine || vehicleData.type_name || 'N/A',
        enriched: false
      };
    }
  }

  /**
   * 🔑 Générer une clé de cache pour l'enrichissement
   */
  private generateEnrichmentCacheKey(vehicleData: any): string {
    const identifiers = [
      vehicleData.type_id,
      vehicleData.type_engine_code,
      vehicleData.type_engine
    ].filter(Boolean);
    
    return identifiers.join('|') || 'unknown';
  }

  /**
   * 🔍 Rechercher un moteur par code
   */
  async findEngineByCode(engineCode: string): Promise<EngineInfo | null> {
    if (!engineCode) return null;

    const cacheKey = `engine_code:${engineCode}`;
    
    return await this.cacheService.getOrSet(
      CacheType.ENGINE,
      cacheKey,
      async () => {
        return this.engineMapping.get(engineCode) || null;
      }
    );
  }

  /**
   * 📊 Obtenir les statistiques du mapping
   */
  getMappingStats(): {
    totalMappings: number;
    byType: { engineIds: number; engineCodes: number; typeIds: number };
  } {
    const mappings = Array.from(this.engineMapping.keys());
    
    return {
      totalMappings: mappings.length,
      byType: {
        engineIds: mappings.filter(key => /^\d+$/.test(key)).length,
        engineCodes: mappings.filter(key => /^[A-Z]/.test(key)).length,
        typeIds: mappings.filter(key => key.length > 6).length
      }
    };
  }

  /**
   * 🔄 Recharger le mapping depuis la base de données
   * (Méthode future pour synchroniser avec cars_engine)
   */
  async reloadMapping(): Promise<void> {
    try {
      this.logger.log('🔄 Rechargement du mapping moteur...');
      
      // TODO: Implémenter la synchronisation avec cars_engine
      const { data: engines, error } = await this.client
        .from('cars_engine')
        .select('eng_id, mfa_id, eng_code')
        .limit(1000);

      if (error) {
        this.logger.error('Erreur rechargement mapping:', error);
        return;
      }

      if (engines?.length) {
        this.logger.log(`🔄 ${engines.length} moteurs chargés depuis la DB`);
        // Mise à jour du mapping en mémoire
        // engineMapping.clear() et reconstruction...
      }
    } catch (error) {
      this.logger.error('Erreur critique rechargement mapping:', error);
    }
  }
}