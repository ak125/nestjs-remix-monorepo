import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  DatabaseException,
  DomainNotFoundException,
  ErrorCodes,
} from '@common/exceptions';

/**
 * 🔧 ConfigurationService - Service de configuration système
 *
 * Service aligné sur l'approche des modules users/orders/cart :
 * ✅ Hérite de SupabaseBaseService pour accès Supabase
 * ✅ Méthodes async avec gestion d'erreurs
 * ✅ Architecture modulaire et testable
 */
@Injectable()
export class ConfigurationService extends SupabaseBaseService {
  /**
   * Récupère toutes les configurations système
   */
  async getAllConfigurations() {
    try {
      const { data, error } = await this.client
        .from('system_config')
        .select('*')
        .order('key', { ascending: true });

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.SUPABASE_ERROR,
          message: `Erreur lors de la récupération des configurations: ${error.message}`,
          details: error.message,
        });
      }

      return {
        success: true,
        data: data || [],
        message: 'Configurations récupérées avec succès',
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Récupère une configuration par clé
   */
  async getConfigurationByKey(key: string) {
    try {
      const { data, error } = await this.client
        .from('system_config')
        .select('*')
        .eq('key', key)
        .single();

      if (error) {
        throw new DomainNotFoundException({
          code: ErrorCodes.ADMIN.CONFIG_NOT_FOUND,
          message: `Configuration non trouvée: ${error.message}`,
          details: error.message,
        });
      }

      return {
        success: true,
        data,
        message: 'Configuration récupérée avec succès',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Met à jour une configuration
   */
  async updateConfiguration(key: string, value: any) {
    try {
      const { data, error } = await this.client
        .from('system_config')
        .update({
          value,
          updated_at: new Date().toISOString(),
        })
        .eq('key', key)
        .select()
        .single();

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.CONFIG_UPDATE_FAILED,
          message: `Erreur lors de la mise à jour: ${error.message}`,
          details: error.message,
        });
      }

      return {
        success: true,
        data,
        message: 'Configuration mise à jour avec succès',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }
}
