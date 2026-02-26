import { Injectable, Logger } from '@nestjs/common';
import { MetaTagsArianeDataService } from '../../../database/services/meta-tags-ariane-data.service';

/**
 * VehicleMetaService
 *
 * Service dédié pour les meta tags des véhicules (ariane/breadcrumb).
 * Extrait de VehiclesService pour respecter le Single Responsibility Principle.
 *
 * @see VehiclesService.getMetaTagsByTypeId() (méthode originale)
 */
@Injectable()
export class VehicleMetaService {
  private readonly logger = new Logger(VehicleMetaService.name);

  constructor(private readonly metaTagsData: MetaTagsArianeDataService) {}

  /**
   * 🏷️ Récupérer les meta tags ariane pour un type de véhicule
   *
   * @param typeId - ID du type de véhicule
   * @returns Meta tags pour le breadcrumb/ariane
   */
  async getMetaTagsByTypeId(typeId: number): Promise<{
    data: Record<string, unknown> | null;
    error: string | null;
  }> {
    try {
      this.logger.log(`🏷️ Recherche meta tags ariane pour type_id: ${typeId}`);

      const result = await this.metaTagsData.getByTypeIdPattern(typeId);

      if (!result) {
        this.logger.log(`ℹ️ Aucun meta tag trouvé pour type_id: ${typeId}`);
        return { data: null, error: null };
      }

      this.logger.log(`✅ Meta tags trouvés pour type_id ${typeId}`);
      return { data: result, error: null };
    } catch (error) {
      this.logger.error('❌ Exception meta tags:', error);
      return { data: null, error: String(error) };
    }
  }

  /**
   * 🏷️ Récupérer les meta tags ariane par alias
   *
   * @param alias - Alias URL du type (ex: "peugeot-308-1-6-hdi-100413")
   * @returns Meta tags pour le breadcrumb/ariane
   */
  async getMetaTagsByAlias(alias: string): Promise<{
    data: Record<string, unknown> | null;
    error: string | null;
  }> {
    try {
      this.logger.log(`🏷️ Recherche meta tags ariane pour alias: ${alias}`);

      const result = await this.metaTagsData.getByAlias(alias);

      if (!result) {
        this.logger.log(`ℹ️ Aucun meta tag trouvé pour alias: ${alias}`);
        return { data: null, error: null };
      }

      this.logger.log(`✅ Meta tags trouvés pour alias ${alias}`);
      return { data: result, error: null };
    } catch (error) {
      this.logger.error('❌ Exception meta tags:', error);
      return { data: null, error: String(error) };
    }
  }
}
