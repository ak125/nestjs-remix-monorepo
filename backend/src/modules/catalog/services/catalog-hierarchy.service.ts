import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import { DatabaseException, ErrorCodes } from '@common/exceptions';
import {
  CatalogGamme,
  CatalogFamilyWithGammes,
  CatalogFamiliesResponse,
} from '../interfaces/catalog-family.interface';

/**
 * Single source of truth pour la hiérarchie catalogue.
 *
 * Remplace : CatalogFamilyService, FamilyGammeHierarchyService,
 * GammeUnifiedService.getHierarchy(), HomepageRpcService.getHomepageFamilies()
 *
 * Architecture :
 *   catalog_family (19 rows) → catalog_gamme (~230 rows) → pieces_gamme
 *   Requêtes Supabase directes en parallèle, tri numérique JS
 *   (mf_sort / mc_sort sont TEXT en DB)
 */
@Injectable()
export class CatalogHierarchyService extends SupabaseBaseService {
  protected override readonly logger = new Logger(CatalogHierarchyService.name);

  private readonly CACHE_TTL = 1800; // 30 min

  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * Hiérarchie complète familles → gammes (source de vérité unique)
   * Cache Redis 30min, tri numérique garanti
   */
  async getHierarchy(): Promise<{
    success: boolean;
    catalog: { families: CatalogFamilyWithGammes[] };
  }> {
    const startTime = performance.now();
    const cacheKey = 'catalog:families:v2';

    const cached = await this.cacheService.get<{
      success: boolean;
      catalog: { families: CatalogFamilyWithGammes[] };
    }>(cacheKey);
    if (cached) {
      this.logger.debug(
        `CACHE HIT hierarchy en ${(performance.now() - startTime).toFixed(1)}ms`,
      );
      return cached;
    }

    this.logger.debug('CACHE MISS hierarchy, requête Supabase...');

    // Parallel: families + catalog_gamme mapping
    const [familiesRes, catalogGammesRes] = await Promise.all([
      this.supabase
        .from(TABLES.catalog_family)
        .select('mf_id, mf_name, mf_pic, mf_description, mf_sort')
        .eq('mf_display', '1'),
      this.supabase
        .from(TABLES.catalog_gamme)
        .select('mc_pg_id, mc_mf_prime, mc_sort'),
    ]);

    if (familiesRes.error) {
      throw new DatabaseException({
        code: ErrorCodes.CATALOG.RPC_FAILED,
        message: `Families query failed: ${familiesRes.error.message}`,
      });
    }

    // Fetch gammes details
    const gammeIds = (catalogGammesRes.data || []).map((cg) => cg.mc_pg_id);

    const { data: gammes, error: gammesError } = await this.supabase
      .from(TABLES.pieces_gamme)
      .select('pg_id, pg_name, pg_alias, pg_img')
      .in('pg_id', gammeIds);

    if (gammesError) {
      this.logger.warn('Gammes query failed, continuing without gammes');
    }

    // Build gamme lookup (String keys for type mismatch safety)
    const gammeMap = new Map((gammes || []).map((g) => [String(g.pg_id), g]));

    // Build hierarchy with numeric sort (mf_sort and mc_sort are TEXT)
    const families: CatalogFamilyWithGammes[] = (familiesRes.data || [])
      .sort((a, b) => Number(a.mf_sort || 0) - Number(b.mf_sort || 0))
      .map((family) => {
        const familyGammeLinks = (catalogGammesRes.data || [])
          .filter((cg) => String(cg.mc_mf_prime) === String(family.mf_id))
          .sort((a, b) => Number(a.mc_sort || 0) - Number(b.mc_sort || 0));

        const familyGammes: CatalogGamme[] = familyGammeLinks
          .map((cg) => {
            const g = gammeMap.get(String(cg.mc_pg_id));
            if (!g) return null;
            return {
              pg_id: g.pg_id,
              pg_name: g.pg_name,
              pg_alias: g.pg_alias,
              pg_img: g.pg_img,
              mc_sort: Number(cg.mc_sort || 0),
            };
          })
          .filter(Boolean) as CatalogGamme[];

        return {
          mf_id: family.mf_id,
          mf_name: family.mf_name,
          mf_pic: family.mf_pic,
          mf_description: family.mf_description,
          mf_sort: Number(family.mf_sort || 0),
          gammes: familyGammes,
          gammes_count: familyGammes.length,
        };
      });

    const result = { success: true, catalog: { families } };

    // Cache async
    this.cacheService
      .set(cacheKey, result, this.CACHE_TTL)
      .catch((err) => this.logger.error('Cache set error:', err));

    this.logger.log(
      `Hierarchy query en ${(performance.now() - startTime).toFixed(1)}ms (${families.length} familles)`,
    );
    return result;
  }

  /**
   * Toutes les gammes d'une famille (pour expand on-demand)
   * Cache Redis 30min par famille
   */
  async getGammesByFamilyId(familyId: number): Promise<CatalogGamme[]> {
    const cacheKey = `catalog:family-gammes:${familyId}`;

    const cached = await this.cacheService.get<CatalogGamme[]>(cacheKey);
    if (cached) return cached;

    // Get gamme links for this family
    const { data: linkData, error: linkError } = await this.supabase
      .from(TABLES.catalog_gamme)
      .select('mc_pg_id, mc_sort')
      .eq('mc_mf_id', familyId.toString());

    if (linkError || !linkData?.length) return [];

    const pgIds = linkData.map((l) => l.mc_pg_id);
    const sortMap = new Map(
      linkData.map((l) => [l.mc_pg_id, Number(l.mc_sort || 0)]),
    );

    const { data: gammesData, error: gammesError } = await this.supabase
      .from(TABLES.pieces_gamme)
      .select(
        'pg_id, pg_alias, pg_name, pg_name_url, pg_name_meta, pg_pic, pg_img',
      )
      .in('pg_id', pgIds)
      .eq('pg_display', '1')
      .eq('pg_level', '1');

    if (gammesError) {
      this.logger.error(
        `Gammes query failed for family ${familyId}:`,
        gammesError,
      );
      return [];
    }

    const gammes: CatalogGamme[] = (gammesData || [])
      .map((item) => ({
        pg_id: item.pg_id,
        pg_alias: item.pg_alias,
        pg_name: item.pg_name,
        pg_name_url: item.pg_name_url,
        pg_name_meta: item.pg_name_meta,
        pg_pic: item.pg_pic,
        pg_img: item.pg_img,
        mc_sort: sortMap.get(item.pg_id) || 0,
      }))
      .sort((a, b) => (a.mc_sort || 0) - (b.mc_sort || 0));

    // Cache async
    this.cacheService
      .set(cacheKey, gammes, this.CACHE_TTL)
      .catch((err) => this.logger.error('Cache set error:', err));

    return gammes;
  }

  /**
   * Format CatalogFamiliesResponse (compat ancien endpoint /api/catalog/families)
   */
  async getFamiliesResponse(): Promise<CatalogFamiliesResponse> {
    const { catalog } = await this.getHierarchy();
    return {
      families: catalog.families,
      success: true,
      totalFamilies: catalog.families.length,
      message: `${catalog.families.length} familles récupérées avec succès`,
    };
  }

  /**
   * Invalide tout le cache hiérarchie
   */
  async invalidateCache(): Promise<void> {
    await this.cacheService.del('catalog:families:v2');
    this.logger.log('Cache hiérarchie invalidé');
  }
}
