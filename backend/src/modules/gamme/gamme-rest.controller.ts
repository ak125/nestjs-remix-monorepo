/**
 * 🎯 GAMME REST CONTROLLER - API Simple et directe
 *
 * Utilise les vraies tables de la base de données :
 * - pieces_gamme : table des gammes/catégories
 * - pieces : table des produits avec piece_pg_id
 * - catalog_gamme : table de liaison pour la hiérarchie
 */

import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Controller('api/gammes')
export class GammeRestController {
  private readonly logger = new Logger(GammeRestController.name);
  private readonly supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || '',
    );
  }

  /**
   * GET /api/gammes/:id/products - Récupérer les produits d'une gamme
   */
  @Get(':id/products')
  async getProductsByGamme(
    @Param('id') gammeId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '24',
    @Query('search') search = '',
    @Query('sortBy') sortBy = 'piece_name',
    @Query('sortOrder') sortOrder = 'asc',
  ) {
    try {
      this.logger.log(
        `🔍 Recherche produits gamme ${gammeId} avec piece_pg_id`,
      );

      // 1. Vérifier que la gamme existe
      const { data: gammeInfo, error: gammeError } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_lib_fr as pg_name, pg_alias, pg_pic, pg_display')
        .eq('pg_id', gammeId)
        .single();

      if (gammeError || !gammeInfo) {
        this.logger.warn(`Gamme ${gammeId} non trouvée:`, gammeError);
        return {
          statusCode: 404,
          message: `Gamme ${gammeId} non trouvée`,
        };
      }

      // 2. Construire la requête des produits
      let query = this.supabase
        .from('pieces')
        .select('*', { count: 'exact' })
        .eq('piece_pg_id', gammeId);

      // Filtrer par affichage si la colonne existe
      try {
        query = query.eq('piece_display', true);
      } catch {
        // Ignorer si la colonne n'existe pas
      }

      // 3. Ajouter la recherche si fournie
      if (search && search.trim()) {
        query = query.or(
          `piece_name.ilike.%${search}%,piece_ref.ilike.%${search}%,piece_des.ilike.%${search}%`,
        );
      }

      // 4. Ajouter le tri
      const sortDirection = sortOrder.toLowerCase() === 'desc' ? false : true;
      query = query.order(sortBy, { ascending: sortDirection });

      // 5. Ajouter la pagination
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 24;
      const offset = (pageNum - 1) * limitNum;
      query = query.range(offset, offset + limitNum - 1);

      // 6. Exécuter la requête
      const { data: products, error: productsError, count } = await query;

      if (productsError) {
        this.logger.error('Erreur requête produits:', productsError);
        return {
          statusCode: 400,
          message: 'Erreur lors de la récupération des produits',
          error: productsError.message,
        };
      }

      // 7. Formater la réponse
      const totalPages = Math.ceil((count || 0) / limitNum);

      const response = {
        gamme: {
          id: gammeInfo.pg_id,
          name: gammeInfo.pg_name || `Gamme ${gammeId}`,
          alias: gammeInfo.pg_alias,
          image: gammeInfo.pg_pic,
          is_active: Boolean(gammeInfo.pg_display),
        },
        products: products || [],
        pagination: {
          total: count || 0,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
        filters: {
          search,
          sortBy,
          sortOrder,
        },
      };

      this.logger.log(`✅ Trouvé ${count} produits pour gamme ${gammeId}`);
      return response;
    } catch (error) {
      this.logger.error('Erreur dans getProductsByGamme:', error);
      return {
        statusCode: 500,
        message: 'Erreur interne du serveur',
        error: error.message,
      };
    }
  }

  /**
   * GET /api/gammes - Liste toutes les gammes
   */
  @Get()
  async getAllGammes() {
    try {
      const { data: gammes, error } = await this.supabase
        .from('pieces_gamme')
        .select(
          'pg_id as id, pg_lib_fr as name, pg_alias as alias, pg_pic as image, pg_display as is_active',
        )
        .eq('pg_display', '1')
        .order('pg_lib_fr');

      if (error) {
        this.logger.error('Erreur récupération gammes:', error);
        return {
          statusCode: 400,
          message: 'Erreur lors de la récupération des gammes',
          error: error.message,
        };
      }

      return gammes || [];
    } catch (error) {
      this.logger.error('Erreur dans getAllGammes:', error);
      return {
        statusCode: 500,
        message: 'Erreur interne du serveur',
        error: error.message,
      };
    }
  }
}
