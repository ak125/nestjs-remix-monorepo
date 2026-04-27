import { TABLES } from '@repo/database-types';
// 📁 backend/src/modules/catalog/services/gamme-unified.service.ts
// 🎯 Service unifié pour les gammes - remplace gamme.service + catalog-gamme.service + pieces-gamme.service

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import { Gamme } from '../types/gamme.types';

@Injectable()
export class GammeUnifiedService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeUnifiedService.name);

  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * 🎯 Récupère toutes les gammes avec leurs vraies données
   */
  async getAllGammes(): Promise<Gamme[]> {
    try {
      this.logger.log('🎯 Récupération de toutes les gammes...');

      // 1. Récupérer les gammes depuis pieces_gamme (source de vérité pour les noms)
      const { data: piecesGammes, error: piecesError } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select(
          `
          pg_id,
          pg_name,
          pg_alias,
          pg_img,
          pg_display,
          pg_top,
          pg_level,
          pg_parent
        `,
        )
        .eq('pg_display', '1')
        .order('pg_id', { ascending: true });

      if (piecesError) {
        this.logger.error('❌ Erreur pieces_gamme:', piecesError);
        throw new BadRequestException(
          `Erreur récupération gammes: ${piecesError.message}`,
        );
      }

      // 2. Transformer vers le format unifié
      const gammes: Gamme[] = (piecesGammes || []).map((pg) => ({
        id: pg.pg_id,
        alias: pg.pg_alias || undefined,
        name: pg.pg_name,
        description: undefined, // Pas de description dans pieces_gamme
        image: pg.pg_img || undefined,
        is_active: true,
        is_featured: pg.pg_top === '1',
        is_displayed: pg.pg_display === '1',
        family_id: undefined, // À enrichir si nécessaire
        level: parseInt(pg.pg_level) || 0,
        sort_order: parseInt(pg.pg_id), // Tri par ID par défaut
        products_count: 0,
      }));

      this.logger.log(`✅ ${gammes.length} gammes récupérées`);
      return gammes;
    } catch (error) {
      this.logger.error('❌ Erreur getAllGammes:', error);
      throw new BadRequestException(
        'Erreur lors de la récupération des gammes',
      );
    }
  }

  /**
   * 🎯 Récupère les gammes en vedette pour la homepage
   */
  async getFeaturedGammes(limit = 8): Promise<Gamme[]> {
    try {
      const allGammes = await this.getAllGammes();
      return allGammes.filter((g) => g.is_featured).slice(0, limit);
    } catch (error) {
      this.logger.error('❌ Erreur getFeaturedGammes:', error);
      return [];
    }
  }

  /**
   * 🔍 Recherche de gammes par nom
   */
  async searchGammes(query: string, limit = 20): Promise<Gamme[]> {
    try {
      const allGammes = await this.getAllGammes();
      const searchLower = query.toLowerCase();

      return allGammes
        .filter(
          (g) =>
            g.name.toLowerCase().includes(searchLower) ||
            g.alias?.toLowerCase().includes(searchLower),
        )
        .slice(0, limit);
    } catch (error) {
      this.logger.error('❌ Erreur searchGammes:', error);
      return [];
    }
  }

  /**
   * 🔍 Récupère une gamme par son alias (pour migration SEO)
   * Retourne l'ID de la gamme si trouvée, null sinon
   */
  async getGammeByAlias(
    alias: string,
  ): Promise<{ id: number; name: string; alias: string } | null> {
    try {
      this.logger.log(`🔍 Recherche gamme par alias: ${alias}`);

      const { data, error } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name, pg_alias')
        .eq('pg_alias', alias)
        .eq('pg_display', '1')
        .limit(1)
        .single();

      if (error || !data) {
        this.logger.warn(`⚠️ Gamme non trouvée pour alias: ${alias}`);
        return null;
      }

      this.logger.log(`✅ Gamme trouvée: ${data.pg_name} (ID: ${data.pg_id})`);
      return {
        id: data.pg_id,
        name: data.pg_name,
        alias: data.pg_alias,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur getGammeByAlias(${alias}):`, error);
      return null;
    }
  }

  /**
   * 🔒 Vérifie si une gamme existe par son ID (pg_id)
   * Utilisé pour la validation SEO des URLs
   */
  async gammeExists(pgId: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select('pg_id')
        .eq('pg_id', pgId)
        .single();

      if (error || !data) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
