import { Controller, Get, Query, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

/**
 * Contrôleur pour les variations SEO
 * Endpoint: /api/seo/variations
 */
@Controller('api/seo')
export class SeoVariationsController extends SupabaseBaseService {
  protected readonly logger = new Logger(SeoVariationsController.name);

  /**
   * GET /api/seo/variations?pg_id=X&alias=Y
   * Récupère les variations de texte depuis __SEO_ITEM_SWITCH
   */
  @Get('variations')
  async getVariations(
    @Query('pg_id') pgId?: string,
    @Query('alias') alias?: string,
  ) {
    try {
      const pgIdNum = pgId ? parseInt(pgId) : 0;
      const aliasNum = alias ? parseInt(alias) : 1;

      this.logger.log(
        `📝 Récupération variations SEO: pg_id=${pgIdNum}, alias=${aliasNum}`,
      );

      // Utiliser this.client directement depuis SupabaseBaseService
      const { data, error } = await this.client
        .from('__seo_item_switch')
        .select('sis_id, sis_pg_id, sis_alias, sis_content')
        .eq('sis_pg_id', pgIdNum)
        .eq('sis_alias', aliasNum)
        .order('sis_id');

      if (error) {
        this.logger.error(
          `❌ Erreur récupération variations: ${error.message}`,
        );
        throw error;
      }

      this.logger.log(`✅ ${data?.length || 0} variations trouvées`);

      return {
        success: true,
        variations: data || [],
        count: data?.length || 0,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Erreur dans getVariations: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        variations: [],
        count: 0,
        error: error.message,
      };
    }
  }
}
