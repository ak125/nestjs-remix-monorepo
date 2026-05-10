// 📁 backend/src/modules/catalog/controllers/vehicle-hierarchy.controller.ts
// 🚗 Contrôleur pour la hiérarchie véhicules (marques → modèles → types/motorisations)

import { Controller, Get, Query, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RateLimitModerate } from '../../../common/decorators/rate-limit.decorator';

@RateLimitModerate() // 🛡️ 30 req/min - Vehicle hierarchy lookups
@Controller('api/hierarchy')
export class VehicleHierarchyController extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleHierarchyController.name);

  constructor() {
    super();
  }

  /**
   * 🚗 GET /api/hierarchy/types - Retourne les motorisations/types d'un modèle
   * Utilisé par constructeurs.$.tsx pour afficher les motorisations disponibles
   *
   * @param modele_id - ID du modèle (ex: 140002 pour CLIO I)
   * @returns Liste des types/motorisations disponibles
   */
  @Get('types')
  async getTypesByModele(@Query('modele_id') modeleId: string) {
    this.logger.log(`🚗 [GET] /api/hierarchy/types?modele_id=${modeleId}`);

    if (!modeleId) {
      return {
        success: false,
        data: [],
        error: 'modele_id est requis',
      };
    }

    try {
      const { data: types, error } = await this.supabase
        .from('auto_type')
        .select(
          'type_id, type_name, type_alias, type_fuel, type_power_ps, type_year_from, type_year_to, type_body',
        )
        .eq('type_modele_id', modeleId)
        .eq('type_display', '1') // Filtrer uniquement les types actifs
        .order('type_name', { ascending: true })
        .limit(50);

      if (error) {
        this.logger.error(`❌ Erreur Supabase: ${error.message}`);
        return {
          success: false,
          data: [],
          error: error.message,
        };
      }

      this.logger.log(
        `✅ ${types?.length || 0} types trouvés pour modele_id=${modeleId}`,
      );

      return {
        success: true,
        data: types || [],
        count: types?.length || 0,
        modele_id: modeleId,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Exception: ${message}`);
      return {
        success: false,
        data: [],
        error: message,
      };
    }
  }

  /**
   * 🚗 GET /api/hierarchy/modeles - Retourne les modèles d'une marque
   *
   * @param marque_id - ID de la marque (ex: 140 pour Renault)
   * @returns Liste des modèles disponibles
   */
  @Get('modeles')
  async getModelesByMarque(@Query('marque_id') marqueId: string) {
    this.logger.log(`🚗 [GET] /api/hierarchy/modeles?marque_id=${marqueId}`);

    if (!marqueId) {
      return {
        success: false,
        data: [],
        error: 'marque_id est requis',
      };
    }

    try {
      const { data: modeles, error } = await this.supabase
        .from('auto_modele')
        .select('modele_id, modele_name, modele_alias')
        .eq('modele_marque_id', marqueId)
        .eq('modele_display', '1') // Filtrer uniquement les modèles actifs
        .order('modele_name', { ascending: true })
        .limit(100);

      if (error) {
        this.logger.error(`❌ Erreur Supabase: ${error.message}`);
        return {
          success: false,
          data: [],
          error: error.message,
        };
      }

      this.logger.log(
        `✅ ${modeles?.length || 0} modèles trouvés pour marque_id=${marqueId}`,
      );

      return {
        success: true,
        data: modeles || [],
        count: modeles?.length || 0,
        marque_id: marqueId,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Exception: ${message}`);
      return {
        success: false,
        data: [],
        error: message,
      };
    }
  }
}
