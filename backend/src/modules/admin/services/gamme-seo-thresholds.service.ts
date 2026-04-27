/**
 * 🎯 GAMME SEO THRESHOLDS SERVICE
 *
 * Service pour gérer les seuils configurables du système Smart Actions
 * - Stockage dans ___config avec cache Redis
 * - Seuils par défaut validés par l'expert SEO
 * - Audit des modifications de seuils
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import {
  DomainValidationException,
  DatabaseException,
  ErrorCodes,
} from '@common/exceptions';

// Interface des seuils Smart Action
export interface SmartActionThresholds {
  trends_high: number; // Default: 50 - Seuil "fort volume" (INDEX_G1, INDEX, INVESTIGUER)
  trends_medium: number; // Default: 20 - Seuil "volume moyen" (OBSERVER, EVALUER)
  seo_excellent: number; // Default: 75 - Seuil "excellente valeur" (INDEX_G1, OBSERVER, PARENT)
  seo_good: number; // Default: 45 - Seuil "bonne valeur" (INDEX, EVALUER)
}

// Seuils par défaut (basés sur l'analyse experte)
export const DEFAULT_THRESHOLDS: SmartActionThresholds = {
  trends_high: 50,
  trends_medium: 20,
  seo_excellent: 75,
  seo_good: 45,
};

// Clé de configuration dans ___config
const CONFIG_KEY = 'gammes_seo.smart_action_thresholds';
const CACHE_KEY = 'gammes-seo:thresholds';
const CACHE_TTL = 3600; // 1 heure

@Injectable()
export class GammeSeoThresholdsService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeSeoThresholdsService.name);

  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * 📥 Récupère les seuils actuels (cache → DB → defaults)
   */
  async getThresholds(): Promise<SmartActionThresholds> {
    try {
      // 1. Check cache
      const cached =
        await this.cacheService.get<SmartActionThresholds>(CACHE_KEY);
      if (cached) {
        this.logger.log('📦 Thresholds from cache');
        return cached;
      }

      // 2. Check database
      const { data, error } = await this.supabase
        .from('___config')
        .select('config_value')
        .eq('config_key', CONFIG_KEY)
        .single();

      if (error || !data) {
        // No config found, return defaults
        this.logger.log('🔧 Using default thresholds (not yet configured)');
        return DEFAULT_THRESHOLDS;
      }

      // 3. Parse and validate
      let thresholds: SmartActionThresholds;
      try {
        thresholds = JSON.parse(data.config_value);
        // Validate all fields exist
        thresholds = {
          trends_high: thresholds.trends_high ?? DEFAULT_THRESHOLDS.trends_high,
          trends_medium:
            thresholds.trends_medium ?? DEFAULT_THRESHOLDS.trends_medium,
          seo_excellent:
            thresholds.seo_excellent ?? DEFAULT_THRESHOLDS.seo_excellent,
          seo_good: thresholds.seo_good ?? DEFAULT_THRESHOLDS.seo_good,
        };
      } catch {
        this.logger.warn('⚠️ Invalid thresholds in DB, using defaults');
        return DEFAULT_THRESHOLDS;
      }

      // 4. Cache and return
      await this.cacheService.set(CACHE_KEY, thresholds, CACHE_TTL);
      this.logger.log('✅ Thresholds loaded from database');
      return thresholds;
    } catch (error) {
      this.logger.error('❌ Error getting thresholds:', error);
      return DEFAULT_THRESHOLDS;
    }
  }

  /**
   * 💾 Met à jour les seuils
   * @returns Les anciens seuils (pour l'audit)
   */
  async updateThresholds(
    newThresholds: Partial<SmartActionThresholds>,
  ): Promise<{
    success: boolean;
    message: string;
    oldThresholds: SmartActionThresholds;
    newThresholds: SmartActionThresholds;
  }> {
    try {
      this.logger.log('💾 Updating thresholds...');

      // Get current thresholds
      const oldThresholds = await this.getThresholds();

      // Merge with new values
      const merged: SmartActionThresholds = {
        trends_high: newThresholds.trends_high ?? oldThresholds.trends_high,
        trends_medium:
          newThresholds.trends_medium ?? oldThresholds.trends_medium,
        seo_excellent:
          newThresholds.seo_excellent ?? oldThresholds.seo_excellent,
        seo_good: newThresholds.seo_good ?? oldThresholds.seo_good,
      };

      // Validate values
      if (merged.trends_high < merged.trends_medium) {
        throw new DomainValidationException({
          code: ErrorCodes.ADMIN.THRESHOLD_INVALID,
          message: 'trends_high doit être >= trends_medium',
          field: 'trends_high',
        });
      }
      if (merged.seo_excellent < merged.seo_good) {
        throw new DomainValidationException({
          code: ErrorCodes.ADMIN.THRESHOLD_INVALID,
          message: 'seo_excellent doit être >= seo_good',
          field: 'seo_excellent',
        });
      }
      if (merged.trends_high < 0 || merged.trends_high > 100) {
        throw new DomainValidationException({
          code: ErrorCodes.ADMIN.THRESHOLD_INVALID,
          message: 'trends_high doit être entre 0 et 100',
          field: 'trends_high',
        });
      }
      if (merged.trends_medium < 0 || merged.trends_medium > 100) {
        throw new DomainValidationException({
          code: ErrorCodes.ADMIN.THRESHOLD_INVALID,
          message: 'trends_medium doit être entre 0 et 100',
          field: 'trends_medium',
        });
      }
      if (merged.seo_excellent < 0 || merged.seo_excellent > 100) {
        throw new DomainValidationException({
          code: ErrorCodes.ADMIN.THRESHOLD_INVALID,
          message: 'seo_excellent doit être entre 0 et 100',
          field: 'seo_excellent',
        });
      }
      if (merged.seo_good < 0 || merged.seo_good > 100) {
        throw new DomainValidationException({
          code: ErrorCodes.ADMIN.THRESHOLD_INVALID,
          message: 'seo_good doit être entre 0 et 100',
          field: 'seo_good',
        });
      }

      // Upsert in database
      const { error } = await this.supabase.from('___config').upsert(
        {
          config_key: CONFIG_KEY,
          config_value: JSON.stringify(merged),
          description:
            'Seuils Smart Actions pour classification SEO des gammes',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'config_key',
        },
      );

      if (error) {
        this.logger.error('❌ Error saving thresholds:', error);
        throw new DatabaseException({
          code: ErrorCodes.ADMIN.SUPABASE_ERROR,
          message: 'Erreur lors de la sauvegarde des seuils',
          details: error.message,
        });
      }

      // Clear cache
      await this.cacheService.del(CACHE_KEY);
      // Also clear gammes stats cache (they need to be recalculated)
      await this.cacheService.del('admin:gammes-seo-stats');

      this.logger.log('✅ Thresholds updated successfully');
      return {
        success: true,
        message: 'Seuils mis à jour avec succès',
        oldThresholds,
        newThresholds: merged,
      };
    } catch (error) {
      this.logger.error('❌ Error updating thresholds:', error);
      throw error;
    }
  }

  /**
   * 🔄 Réinitialise aux valeurs par défaut
   */
  async resetToDefaults(): Promise<{
    success: boolean;
    message: string;
    oldThresholds: SmartActionThresholds;
    newThresholds: SmartActionThresholds;
  }> {
    try {
      this.logger.log('🔄 Resetting thresholds to defaults...');

      const oldThresholds = await this.getThresholds();

      // Delete from database (will fall back to defaults)
      await this.supabase
        .from('___config')
        .delete()
        .eq('config_key', CONFIG_KEY);

      // Clear cache
      await this.cacheService.del(CACHE_KEY);
      await this.cacheService.del('admin:gammes-seo-stats');

      this.logger.log('✅ Thresholds reset to defaults');
      return {
        success: true,
        message: 'Seuils réinitialisés aux valeurs par défaut',
        oldThresholds,
        newThresholds: DEFAULT_THRESHOLDS,
      };
    } catch (error) {
      this.logger.error('❌ Error resetting thresholds:', error);
      throw error;
    }
  }

  /**
   * 📊 Retourne la matrice de décision pour affichage
   */
  async getDecisionMatrix(): Promise<{
    thresholds: SmartActionThresholds;
    matrix: Array<{
      action: string;
      emoji: string;
      condition: string;
      description: string;
    }>;
  }> {
    const thresholds = await this.getThresholds();

    return {
      thresholds,
      matrix: [
        {
          action: 'INDEX_G1',
          emoji: '🚀',
          condition: `Trends ≥ ${thresholds.trends_high} ET SEO ≥ ${thresholds.seo_excellent}`,
          description:
            'Page dédiée prioritaire - Fort volume + forte valeur commerciale',
        },
        {
          action: 'INDEX',
          emoji: '📈',
          condition: `Trends ≥ ${thresholds.trends_high} ET SEO ≥ ${thresholds.seo_good}`,
          description: 'Page dédiée standard - Fort volume',
        },
        {
          action: 'INVESTIGUER',
          emoji: '🔍',
          condition: `Trends ≥ ${thresholds.trends_high} ET SEO < ${thresholds.seo_good}`,
          description:
            'Fort volume mais faible valeur commerciale - À vérifier',
        },
        {
          action: 'OBSERVER',
          emoji: '⭐',
          condition: `Trends ${thresholds.trends_medium}-${thresholds.trends_high - 1} ET SEO ≥ ${thresholds.seo_excellent}`,
          description: "Potentiel élevé - Surveiller l'évolution des tendances",
        },
        {
          action: 'PARENT',
          emoji: '🔗',
          condition: `Trends < ${thresholds.trends_medium} ET SEO ≥ ${thresholds.seo_excellent}`,
          description:
            'Forte valeur mais faible volume - Intégrer dans page parente',
        },
        {
          action: 'EVALUER',
          emoji: '📊',
          condition: `Trends ${thresholds.trends_medium}-${thresholds.trends_high - 1} ET SEO ${thresholds.seo_good}-${thresholds.seo_excellent - 1}`,
          description: 'Potentiel moyen - Décision manuelle requise',
        },
        {
          action: 'NOINDEX',
          emoji: '❌',
          condition: 'Faible potentiel global',
          description: 'Faible volume + faible valeur - Garder non-indexé',
        },
      ],
    };
  }
}
