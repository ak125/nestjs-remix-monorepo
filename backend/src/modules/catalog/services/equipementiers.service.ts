// 📁 backend/src/modules/catalog/services/equipementiers.service.ts
// 🏭 Service pour gérer les équipementiers (table pieces_marque)

import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

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
  /**
   * 🏭 Récupère tous les équipementiers - LOGIQUE PHP REPRODUITE
   * Équivalent PHP: SELECT DISTINCT pm_name, pm_id FROM pieces_marque
   */
  async getEquipementiers(): Promise<{
    data: Equipementier[];
    stats: { total_equipementiers: number };
    success: boolean;
  }> {
    try {
      this.logger.log('🏭 Récupération des équipementiers (pieces_marque)...');

      // Requête EXACTE de la logique PHP - seulement les colonnes de base
      const { data: equipementiers, error } = await this.supabase
        .from('pieces_marque')
        .select('pm_id, pm_name')
        .order('pm_name', { ascending: true });

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
            acc.push(current);
          }
          return acc;
        }, [] as Equipementier[]);

      const result = {
        data: uniqueEquipementiers,
        stats: {
          total_equipementiers: uniqueEquipementiers.length,
        },
        success: true,
      };

      this.logger.log(
        `✅ ${result.stats.total_equipementiers} équipementiers récupérés`,
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
        .from('pieces_marque')
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
        .from('pieces_marque')
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
