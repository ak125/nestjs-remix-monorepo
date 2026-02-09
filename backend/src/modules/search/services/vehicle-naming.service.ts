import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * 🚗 Service de construction des noms complets de véhicules
 *
 * Format cible : "MARQUE MODELE MOTORISATION PUISSANCE PÉRIODE"
 * Exemple : "AUDI A3 II 2.0 TDI 140 ch de 2005 à 2008"
 */
@Injectable()
export class VehicleNamingService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleNamingService.name);

  constructor() {
    super();
  }

  /**
   * 🏗️ Construire le nom complet d'un véhicule
   * Format: MARQUE MODELE MOTORISATION PUISSANCE PÉRIODE
   */
  buildFullVehicleName(vehicle: {
    marque_name?: string;
    modele_name?: string;
    type_name?: string;
    type_power_ps?: string;
    type_power_kw?: string;
    type_fuel?: string;
    type_year_from?: string;
    type_year_to?: string;
    type_month_from?: string;
    type_month_to?: string;
  }): string {
    const parts = [];

    // 1. MARQUE (obligatoire)
    if (vehicle.marque_name) {
      parts.push(vehicle.marque_name.toUpperCase());
    }

    // 2. MODELE (obligatoire)
    if (vehicle.modele_name) {
      parts.push(vehicle.modele_name.toUpperCase());
    }

    // 3. MOTORISATION (type_name contient déjà la motorisation)
    if (vehicle.type_name) {
      parts.push(vehicle.type_name);
    }

    // 4. PUISSANCE
    const power = this.formatPower(
      vehicle.type_power_ps,
      vehicle.type_power_kw,
    );
    if (power) {
      parts.push(power);
    }

    // 5. PÉRIODE
    const period = this.formatPeriod(
      vehicle.type_year_from,
      vehicle.type_year_to,
    );
    if (period) {
      parts.push(period);
    }

    return parts.join(' ');
  }

  /**
   * ⚡ Formater la puissance (privilégier CH, puis KW)
   */
  private formatPower(powerPs?: string, powerKw?: string): string | null {
    if (powerPs && powerPs !== '0') {
      return `${powerPs} ch`;
    }
    if (powerKw && powerKw !== '0') {
      return `${powerKw} kw`;
    }
    return null;
  }

  /**
   * 📅 Formater la période (années et mois si disponibles)
   */
  private formatPeriod(yearFrom?: string, yearTo?: string): string | null {
    if (!yearFrom) return null;

    const startYear = yearFrom;
    const endYear = yearTo || 'présent';

    // Si même année
    if (yearFrom === yearTo) {
      return `en ${startYear}`;
    }

    // Période normale
    return `de ${startYear} à ${endYear}`;
  }

  /**
   * 🔍 Récupérer véhicules avec noms complets
   */
  async getVehiclesWithFullNames(limit = 100): Promise<any[]> {
    try {
      // 1. Récupérer les types actifs
      const { data: types, error: typesError } = await this.client
        .from(TABLES.auto_type)
        .select(
          `
          type_id,
          type_name,
          type_modele_id,
          type_marque_id,
          type_fuel,
          type_power_ps,
          type_power_kw,
          type_year_from,
          type_year_to,
          type_month_from,
          type_month_to,
          type_display
        `,
        )
        .eq('type_display', '1')
        .limit(limit);

      if (typesError) {
        this.logger.error('❌ Erreur récupération types:', typesError);
        return [];
      }

      // 2. Récupérer modèles
      const modeleIds = [
        ...new Set(
          types?.map((t) => parseInt(t.type_modele_id)).filter(Boolean),
        ),
      ];
      const { data: modeles, error: modelesError } = await this.client
        .from(TABLES.auto_modele)
        .select('modele_id, modele_name, modele_ful_name')
        .in('modele_id', modeleIds);

      if (modelesError) {
        this.logger.error('❌ Erreur récupération modèles:', modelesError);
        return [];
      }

      // 3. Récupérer marques
      const marqueIds = [
        ...new Set(
          types?.map((t) => parseInt(t.type_marque_id)).filter(Boolean),
        ),
      ];
      const { data: marques, error: marquesError } = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name')
        .in('marque_id', marqueIds);

      if (marquesError) {
        this.logger.error('❌ Erreur récupération marques:', marquesError);
        return [];
      }

      // 4. Construire les véhicules avec noms complets
      const vehiclesWithFullNames =
        types?.map((type) => {
          const modele = modeles?.find(
            (m) => m.modele_id === parseInt(type.type_modele_id),
          );
          const marque = marques?.find(
            (m) => m.marque_id === parseInt(type.type_marque_id),
          );

          const vehicleData = {
            ...type,
            marque_name: marque?.marque_name,
            modele_name: modele?.modele_name,
          };

          const fullName = this.buildFullVehicleName(vehicleData);

          return {
            id: `vehicle_${type.type_id}`,
            type: 'vehicle',
            typeId: type.type_id,
            name: type.type_name, // Nom court (motorisation)
            fullName: fullName, // Nom complet formaté
            displayName: fullName, // Nom d'affichage

            // Données structurées
            marque: {
              id: marque?.marque_id,
              name: marque?.marque_name,
            },
            modele: {
              id: modele?.modele_id,
              name: modele?.modele_name,
            },
            motorisation: {
              name: type.type_name,
              fuel: type.type_fuel,
              powerPs: type.type_power_ps,
              powerKw: type.type_power_kw,
            },
            period: {
              yearFrom: type.type_year_from,
              yearTo: type.type_year_to,
              monthFrom: type.type_month_from,
              monthTo: type.type_month_to,
            },

            // Termes de recherche
            searchTerms: [
              fullName,
              type.type_name,
              marque?.marque_name,
              modele?.modele_name,
              type.type_fuel,
            ].filter(Boolean),

            // Métadonnées
            isActive: type.type_display === '1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }) || [];

      this.logger.log(
        `✅ Construits ${vehiclesWithFullNames.length} noms de véhicules complets`,
      );
      return vehiclesWithFullNames;
    } catch (error) {
      this.logger.error('❌ Erreur getVehiclesWithFullNames:', error);
      return [];
    }
  }

  /**
   * 🧪 Test avec quelques exemples
   */
  async testVehicleNaming(): Promise<{
    success: boolean;
    total?: number;
    examples?: {
      typeId: unknown;
      shortName: unknown;
      fullName: unknown;
      marque: unknown;
      modele: unknown;
    }[];
    message?: string;
    error?: string;
  }> {
    try {
      const vehicles = await this.getVehiclesWithFullNames(10);

      const examples = vehicles.slice(0, 5).map((v) => ({
        typeId: v.typeId,
        shortName: v.name,
        fullName: v.fullName,
        marque: v.marque.name,
        modele: v.modele.name,
      }));

      return {
        success: true,
        total: vehicles.length,
        examples: examples,
        message: `Générés ${vehicles.length} noms complets de véhicules`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}
