import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { GammeDataTransformerService } from './gamme-data-transformer.service';

/**
 * Service pour récupérer les données de page gamme (méthode classique avec cache)
 */
@Injectable()
export class GammePageDataService extends SupabaseBaseService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly transformer: GammeDataTransformerService,
  ) {
    super();
  }

  /**
   * Récupère les données de page avec cache Redis
   */
  async getPageData(pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    console.log(`🚀 OPTIMISÉ PHP - PG_ID=${pgIdNum}`);

    // Redirection spéciale
    if (pgIdNum === 3940) {
      return { redirect: '/pieces/corps-papillon-158.html', status: 301 };
    }

    // Cache Redis
    const cacheKey = `gamme:page-data:${pgIdNum}`;
    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === 'string') {
        console.log(`✅ Cache HIT pour PG_ID=${pgIdNum} (< 10ms)`);
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('⚠️ Erreur lecture cache Redis:', error);
    }

    console.log(`🔍 Cache MISS pour PG_ID=${pgIdNum} - Chargement depuis Supabase...`);
    const startTime = performance.now();

    // Validation
    const validationResult = await this.validatePage(pgIdNum);
    if (validationResult.error) {
      return validationResult;
    }

    const pageData = validationResult.data;

    // Récupération données parallélisées
    const aggregatedData = await this.fetchAggregatedData(pgIdNum);
    
    // Construction réponse
    const response = await this.buildResponse(
      pgIdNum,
      pageData,
      aggregatedData,
      startTime,
    );

    // Mise en cache
    try {
      await this.cacheService.set(cacheKey, JSON.stringify(response), 3600);
      console.log(`✅ Cache MISS - Données mises en cache pour PG_ID=${pgIdNum} (TTL: 1h)`);
    } catch (error) {
      console.warn('⚠️ Erreur écriture cache Redis:', error);
    }

    return response;
  }

  private async validatePage(pgIdNum: number) {
    const { data: selectorData, error: selectorError } = await this.client
      .from('pieces_gamme')
      .select('pg_display, pg_name')
      .eq('pg_id', pgIdNum)
      .in('pg_level', [1, 2])
      .single();

    if (selectorError || !selectorData || selectorData.pg_display != 1) {
      return {
        status: selectorError ? 410 : 412,
        error: selectorError ? 'Page not found' : 'Page disabled',
        debug: { selectorError, selectorData },
      };
    }

    const { data: pageData, error: pageError } = await this.client
      .from('pieces_gamme')
      .select('pg_alias, pg_name, pg_name_meta, pg_relfollow, pg_img, pg_wall')
      .eq('pg_id', pgIdNum)
      .eq('pg_display', 1)
      .in('pg_level', [1, 2])
      .single();

    if (pageError || !pageData) {
      return {
        status: 410,
        error: 'Page data not found',
        debug: { pageError },
      };
    }

    return { data: pageData };
  }

  private async fetchAggregatedData(pgIdNum: number) {
    const [
      catalogDataResult,
      seoDataResult,
      conseilsDataResult,
      informationsDataResult,
      crossGammeDataResult,
      equipGammeDataResult,
      blogDataResult,
    ] = await Promise.all([
      this.client.from('catalog_gamme').select('mc_mf_prime').eq('mc_pg_id', pgIdNum).single(),
      this.client.from('__seo_gamme').select('sg_title, sg_descrip, sg_keywords, sg_h1, sg_content').eq('sg_pg_id', pgIdNum).single(),
      this.client.from('__seo_gamme_conseil').select('sgc_id, sgc_title, sgc_content').eq('sgc_pg_id', pgIdNum),
      this.client.from('__seo_gamme_info').select('sgi_content').eq('sgi_pg_id', pgIdNum),
      this.client.from('__cross_gamme_car_new').select('cgc_type_id, cgc_id, cgc_modele_id').eq('cgc_pg_id', pgIdNum.toString()).eq('cgc_level', '1'),
      this.client.from('__seo_equip_gamme').select('seg_pm_id, seg_content').eq('seg_pg_id', pgIdNum).not('seg_content', 'is', null).limit(4),
      this.client.from('__blog_advice').select('ba_id, ba_h1, ba_alias, ba_preview, ba_wall, ba_update').eq('ba_pg_id', pgIdNum).order('ba_update', { ascending: false }).order('ba_create', { ascending: false }).limit(1).single(),
    ]);

    return {
      catalogData: catalogDataResult.data,
      seoData: seoDataResult.data,
      conseilsData: conseilsDataResult.data,
      informationsData: informationsDataResult.data,
      crossGammeData: crossGammeDataResult.data,
      equipGammeData: equipGammeDataResult.data,
      blogData: blogDataResult.data,
      blogError: blogDataResult.error,
    };
  }

  private async buildResponse(pgIdNum: number, pageData: any, aggregatedData: any, startTime: number) {
    // Cette méthode serait trop longue - on la garde dans le contrôleur pour l'instant
    // ou on crée un service séparé pour la construction de réponse
    return { message: 'À implémenter' };
  }
}
