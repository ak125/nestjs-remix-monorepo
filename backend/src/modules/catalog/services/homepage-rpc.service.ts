import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';

/**
 * 🚀 Service RPC optimisé pour la page d'accueil
 *
 * STRATÉGIES D'OPTIMISATION:
 * 1. Cache Redis avec TTL 5min pour données homepage (changent peu)
 * 2. Single RPC call remplace 4 appels API séquentiels
 * 3. NO fallback - retourne erreur 500 si RPC échoue
 *
 * Remplace 4 appels API séquentiels (400-800ms) par 1 RPC (<150ms)
 *
 * Endpoints remplacés:
 * - /api/catalog/equipementiers
 * - /api/blog/advice?limit=6
 * - /api/catalog/gammes/hierarchy
 * - /api/brands/brands-logos
 */
@Injectable()
export class HomepageRpcService extends SupabaseBaseService {
  protected override readonly logger = new Logger(HomepageRpcService.name);

  // TTL Cache: 30 minutes pour données homepage (Phase 2 perf: families/brands changent rarement)
  private readonly CACHE_TTL_SECONDS = 1800;
  // TTL Cache families-only: 30 minutes
  private readonly FAMILIES_CACHE_TTL_SECONDS = 1800;
  // Timeout RPC
  private readonly RPC_TIMEOUT_MS = 2000;
  // Singleflight: partage la promise RPC entre requêtes concurrentes
  private inflightPromise: Promise<unknown> | null = null;

  constructor(
    private readonly cacheService: CacheService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * 🔑 Génère la clé de cache pour homepage
   */
  private getCacheKey(): string {
    return 'homepage:rpc:v1';
  }

  /**
   * ⚡ Récupère les données homepage avec cache
   */
  async getHomepageDataOptimized() {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey();

    // 1. Vérifier le cache Redis d'abord
    const cached =
      await this.cacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      const cacheTime = performance.now() - startTime;
      this.logger.debug(`🎯 CACHE HIT homepage en ${cacheTime.toFixed(1)}ms`);
      return {
        ...cached,
        _cache: {
          hit: true,
          time: cacheTime,
        },
      };
    }

    // 2. Cache miss → Vérifier si un appel RPC est déjà en cours (singleflight)
    if (this.inflightPromise) {
      this.logger.debug('⏳ In-flight join homepage RPC');
      return this.inflightPromise;
    }

    // 3. Lancer le RPC et partager la promise avec les requêtes concurrentes
    this.logger.debug('❌ CACHE MISS homepage, appel RPC...');

    this.inflightPromise = this.fetchRpcWithTimeout(startTime)
      .then((result) => {
        this.cacheResult(result).catch((err) =>
          this.logger.error('Erreur cache homepage:', err),
        );
        return result;
      })
      .finally(() => {
        this.inflightPromise = null;
      });

    return this.inflightPromise;
  }

  /**
   * 🔄 Appel RPC avec timeout strict via RPC Safety Gate
   */
  private async fetchRpcWithTimeout(startTime: number) {
    // Créer une Promise avec timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('RPC_TIMEOUT')), this.RPC_TIMEOUT_MS);
    });

    // 🛡️ Utilisation du wrapper callRpc avec RPC Safety Gate
    const rpcPromise = this.callRpc<any>(
      'get_homepage_data_optimized',
      {},
      {
        source: 'api',
        role: 'service_role',
      },
    );

    // Race entre RPC et timeout
    const { data, error: rpcError } = await Promise.race([
      rpcPromise,
      timeoutPromise.then(() => ({
        data: null,
        error: new Error('RPC_TIMEOUT'),
      })),
    ]);

    if (rpcError) {
      this.logger.error('RPC homepage error:', rpcError);
      throw rpcError;
    }

    const rpcTime = performance.now() - startTime;
    this.logger.log(`✅ RPC homepage en ${rpcTime.toFixed(1)}ms`);

    // Vérifier que les données sont valides
    if (!data?.success) {
      throw new DatabaseException({
        code: ErrorCodes.CATALOG.RPC_FAILED,
        message: 'Homepage RPC returned invalid data',
      });
    }

    return {
      ...data,
      _performance: {
        rpcTime,
        totalTime: performance.now() - startTime,
        cacheHit: false,
      },
    };
  }

  /**
   * 💾 Stocke le résultat en cache
   */
  private async cacheResult(result: unknown): Promise<void> {
    const cacheKey = this.getCacheKey();
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_SECONDS);
    this.logger.debug(
      `💾 Cache stocké pour homepage (TTL: ${this.CACHE_TTL_SECONDS}s)`,
    );
  }

  /**
   * ⚡ Families-only pour above-fold SSR (Phase 1 perf: split RPC)
   * Requête Supabase directe — plus rapide que le RPC complet (~50ms vs ~150ms)
   */
  async getHomepageFamilies() {
    const startTime = performance.now();
    const cacheKey = 'homepage:families:v1';

    const cached = await this.cacheService.get<unknown>(cacheKey);
    if (cached) {
      this.logger.debug(
        `🎯 CACHE HIT families en ${(performance.now() - startTime).toFixed(1)}ms`,
      );
      return cached;
    }

    this.logger.debug('❌ CACHE MISS families, requête Supabase...');

    // Parallel: fetch families + catalog_gamme mapping
    const [familiesRes, catalogGammesRes] = await Promise.all([
      this.supabase
        .from(TABLES.catalog_family)
        .select('mf_id, mf_name, mf_pic, mf_description')
        .eq('mf_display', '1')
        .order('mf_sort', { ascending: true }),
      this.supabase
        .from(TABLES.catalog_gamme)
        .select('mc_pg_id, mc_mf_prime, mc_sort')
        .order('mc_sort', { ascending: true }),
    ]);

    if (familiesRes.error) {
      throw new DatabaseException({
        code: ErrorCodes.CATALOG.RPC_FAILED,
        message: `Families query failed: ${familiesRes.error.message}`,
      });
    }

    // Get gamme IDs from catalog_gamme mapping
    const gammeIds = (catalogGammesRes.data || []).map((cg) => cg.mc_pg_id);

    const { data: gammes, error: gammesError } = await this.supabase
      .from(TABLES.pieces_gamme)
      .select('pg_id, pg_name, pg_alias, pg_img')
      .in('pg_id', gammeIds);

    if (gammesError) {
      this.logger.warn('⚠️ Gammes query failed, continuing without gammes');
    }

    // Build gamme lookup map (String keys to handle type mismatches from Supabase)
    const gammeMap = new Map((gammes || []).map((g) => [String(g.pg_id), g]));

    // Build families with gammes hierarchy
    const families = (familiesRes.data || []).map((family) => {
      const familyGammeLinks = (catalogGammesRes.data || [])
        .filter((cg) => String(cg.mc_mf_prime) === String(family.mf_id))
        .sort((a, b) => (a.mc_sort || 0) - (b.mc_sort || 0));

      const familyGammes = familyGammeLinks
        .map((cg) => gammeMap.get(String(cg.mc_pg_id)))
        .filter(Boolean);

      return {
        mf_id: family.mf_id,
        mf_name: family.mf_name,
        mf_pic: family.mf_pic,
        mf_description: family.mf_description,
        gammes: familyGammes,
        gammes_count: familyGammes.length,
      };
    });

    const result = { success: true, catalog: { families } };

    // Cache asynchronously
    this.cacheService
      .set(cacheKey, result, this.FAMILIES_CACHE_TTL_SECONDS)
      .catch((err) => this.logger.error('Erreur cache families:', err));

    this.logger.log(
      `✅ Families query en ${(performance.now() - startTime).toFixed(1)}ms (${families.length} familles)`,
    );
    return result;
  }

  /**
   * ⚡ Below-fold data only (brands, equipementiers, blog)
   * Uses the full RPC (cached) but returns only below-fold portion
   */
  async getHomepageBelowFold() {
    const data = (await this.getHomepageDataOptimized()) as Record<
      string,
      unknown
    >;
    const { _performance, _cache, _catalog, _success, _stats, ...belowFold } =
      data as Record<string, unknown>;
    return {
      brands: belowFold.brands ?? [],
      equipementiers: belowFold.equipementiers ?? [],
      blog_articles: belowFold.blog_articles ?? [],
    };
  }

  /**
   * 🗑️ Invalide le cache homepage (full RPC + families)
   */
  async invalidateCache(): Promise<void> {
    const cacheKey = this.getCacheKey();
    await Promise.all([
      this.cacheService.del(cacheKey),
      this.cacheService.del('homepage:families:v1'),
    ]);
    this.logger.log('🗑️ Cache invalidé pour homepage (RPC + families)');
  }

  /**
   * 🔥 Préchauffe le cache homepage
   */
  async warmCache(): Promise<{ success: boolean; time: number }> {
    const startTime = performance.now();
    try {
      await this.getHomepageDataOptimized();
      const time = performance.now() - startTime;
      this.logger.log(`🔥 Warm cache homepage terminé en ${time.toFixed(1)}ms`);
      return { success: true, time };
    } catch (error) {
      this.logger.error('❌ Warm cache homepage failed:', error);
      return { success: false, time: performance.now() - startTime };
    }
  }
}
