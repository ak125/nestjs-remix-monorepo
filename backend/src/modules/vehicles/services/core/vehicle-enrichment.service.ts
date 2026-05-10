import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { VehicleCacheService, CacheType } from './vehicle-cache.service';

/**
 * 🔧 VEHICLE ENRICHMENT SERVICE - Enrichissement des données véhicules
 *
 * ⚠️ STATUS: Service simplifié - Codes moteurs désactivés
 *
 * Raison: Pas de liaison directe entre auto_type et cars_engine.eng_id
 * - auto_type.type_engine contient le type de carburant (Diesel/Essence), pas le code moteur
 * - auto_type.type_tmf_id → cars_engine.eng_mfa_id donne le fabricant du moteur, pas le code spécifique
 * - Nécessite une table de liaison (ex: auto_type_engine) qui n'existe pas actuellement
 *
 * Fonctionnalités actuelles :
 * - Cache des données véhicules
 * - Structure prête pour l'enrichissement futur
 *
 * TODO: Implémenter quand la liaison sera disponible
 */

export interface EnrichedEngineDetails {
  engineCode: string;
  enriched: boolean;
}

@Injectable()
export class VehicleEnrichmentService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleEnrichmentService.name);

  // 🔧 NOTE: Le mapping hardcodé a été supprimé.
  // Les codes moteurs sont actuellement désactivés car :
  // - auto_type.type_engine contient "Diesel"/"Essence" (type de carburant)
  // - Pas de liaison directe vers cars_engine.eng_code
  //
  // TODO: Implémenter quand la table de liaison sera créée

  constructor(private readonly cacheService: VehicleCacheService) {
    super();
    this.logger.log(
      '🔧 VehicleEnrichmentService initialisé (codes moteurs désactivés)',
    );
  }

  /**
   * 🔧 Enrichir un véhicule avec les données moteur
   */
  async enrichVehicle(
    vehicleData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!vehicleData) return vehicleData;

    try {
      // Génération de la clé de cache pour cet enrichissement
      const cacheKey = this.generateEnrichmentCacheKey(vehicleData);

      // Vérifier le cache d'abord
      const cached = await this.cacheService.get<Record<string, unknown>>(
        CacheType.ENRICHMENT,
        cacheKey,
      );
      if (cached) {
        return cached;
      }

      // Enrichissement
      const enriched = {
        ...vehicleData,
        engineDetails: await this.getEngineDetails(vehicleData),
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
      const enrichmentPromises = vehicles.map((vehicle) =>
        this.enrichVehicle(vehicle),
      );
      return await Promise.all(enrichmentPromises);
    } catch (error) {
      this.logger.error('Erreur enrichissement véhicules:', error);
      return vehicles; // Retour de la liste non enrichie en cas d'erreur
    }
  }

  /**
   * 🔍 Obtenir les détails moteur pour un véhicule
   * Simplifié : utilise directement type_engine depuis la base de données
   */
  private async getEngineDetails(
    vehicleData: any,
  ): Promise<EnrichedEngineDetails> {
    // Les codes moteurs sont maintenant récupérés directement depuis auto_type.type_engine
    const engineCode =
      vehicleData.type_engine || vehicleData.type_name || 'N/A';

    return {
      engineCode,
      enriched: !!vehicleData.type_engine,
    };
  }

  /**
   * 🔑 Générer une clé de cache pour l'enrichissement
   */
  private generateEnrichmentCacheKey(vehicleData: any): string {
    const identifiers = [
      vehicleData.type_id,
      vehicleData.type_engine_code,
      vehicleData.type_engine,
    ].filter(Boolean);

    return identifiers.join('|') || 'unknown';
  }

  /**
   * � Recharger le mapping depuis la base de données
   *
   * FUTUR: Cette méthode sera implémentée quand la liaison entre auto_type
   * et cars_engine sera établie (via table de liaison ou colonne FK).
   *
   * Options possibles :
   * 1. Créer une table : auto_type_engine (type_id, eng_id)
   * 2. Ajouter une colonne : auto_type.type_eng_id → cars_engine.eng_id
   * 3. Utiliser une autre source de données pour les codes moteurs
   */
  async reloadEngineMapping(): Promise<void> {
    this.logger.warn(
      '⚠️ reloadEngineMapping non implémenté - Nécessite table de liaison',
    );

    // TODO: Implémenter quand la liaison sera disponible
    // Exemple :
    // const { data } = await this.client
    //   .from('auto_type_engine')
    //   .select('type_id, eng_id, cars_engine(eng_code)')
    //   .limit(10000);
  }
}
