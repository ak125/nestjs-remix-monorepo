import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HomepageRpcService } from './homepage-rpc.service';
import { CatalogHierarchyService } from './catalog-hierarchy.service';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

/**
 * 🔥 Service de préchauffage du cache au démarrage
 *
 * Appelle automatiquement les RPC pour remplir le cache Redis
 * AVANT que le premier visiteur n'arrive.
 *
 * Bénéfice: Premier visiteur a un cache HIT (12-20ms) au lieu de MISS (150-300ms)
 *
 * 🚀 LCP V9: Warm aussi les gammes indexées (pg_display='1')
 * pour couvrir les 1540 URLs /pieces/ signalées par GSC
 */
@Injectable()
export class CacheWarmingService
  extends SupabaseBaseService
  implements OnModuleInit
{
  protected override readonly logger = new Logger(CacheWarmingService.name);

  constructor(
    private readonly homepageRpcService: HomepageRpcService,
    private readonly catalogHierarchyService: CatalogHierarchyService,
  ) {
    super();
  }

  /**
   * 🚀 Exécuté automatiquement au démarrage de l'application
   */
  async onModuleInit() {
    // Délai pour laisser Redis se connecter
    setTimeout(() => {
      this.warmAllCaches().catch((err) =>
        this.logger.error('Cache warming failed:', err),
      );
    }, 3000);
  }

  /**
   * 🔥 Préchauffe tous les caches critiques
   */
  private async warmAllCaches() {
    this.logger.log('🔥 Démarrage du cache warming...');
    const startTime = performance.now();

    try {
      // 1. Homepage RPC (le plus critique)
      const homepageResult = await this.homepageRpcService.warmCache();
      this.logger.log(
        `✅ Homepage cache warmed: ${homepageResult.success ? 'OK' : 'FAILED'} (${homepageResult.time.toFixed(0)}ms)`,
      );

      // 2. Catalog hierarchy (single source of truth, TTL 30min)
      const familiesStart = performance.now();
      await this.catalogHierarchyService.getHierarchy();
      this.logger.log(
        `✅ Hierarchy cache warmed (${(performance.now() - familiesStart).toFixed(0)}ms)`,
      );

      // 3. 🚀 LCP V9: Gamme pages — warm catalog-linked gammes (~221)
      await this.warmGammePages();

      const totalTime = performance.now() - startTime;
      this.logger.log(`🎉 Cache warming terminé en ${totalTime.toFixed(0)}ms`);
    } catch (error) {
      this.logger.error('❌ Cache warming error:', error);
    }
  }

  /**
   * 🔥 Warm gamme page caches via internal HTTP endpoint
   * Fetches active gamme IDs from catalog_gamme (~221 gammes du catalogue actif)
   * then calls POST /api/gamme-rest/cache/warm in batches
   */
  private async warmGammePages() {
    try {
      // Get only catalog-linked gamme IDs (~221 instead of 4205 from pieces_gamme)
      const { data: gammes, error } = await this.supabase
        .from('catalog_gamme')
        .select('mc_pg_id');

      if (error || !gammes?.length) {
        this.logger.warn(
          `⚠️ Gamme warming: ${error?.message || 'no gammes found'}`,
        );
        return;
      }

      const pgIds = [...new Set(gammes.map((g) => String(g.mc_pg_id)))];
      this.logger.log(
        `🔥 Warming ${pgIds.length} gamme pages via /api/gamme-rest/cache/warm...`,
      );

      // Call internal warm endpoint (batching handled by the controller)
      const port = process.env.PORT || 3000;
      const response = await fetch(
        `http://127.0.0.1:${port}/api/gamme-rest/cache/warm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pgIds }),
          signal: AbortSignal.timeout(120000), // 2min max for all batches
        },
      );

      if (response.ok) {
        const result = await response.json();
        this.logger.log(
          `✅ Gamme cache warmed: ${result.success}/${result.total} OK, ${result.failed} failed`,
        );
      } else {
        this.logger.warn(
          `⚠️ Gamme warming HTTP ${response.status}: ${response.statusText}`,
        );
      }
    } catch (error) {
      // Non-blocking — warming failure shouldn't crash startup
      this.logger.warn(
        `⚠️ Gamme warming skipped: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
