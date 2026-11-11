import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HomepageRpcService } from './homepage-rpc.service';
import { CatalogHierarchyService } from './catalog-hierarchy.service';

/** Délai après l'initialisation du module, pour laisser Redis se connecter. */
export const CACHE_WARMING_STARTUP_DELAY_MS = 3000;

/**
 * 🔥 Service de préchauffage du cache au démarrage
 *
 * Appelle automatiquement les RPC pour remplir le cache Redis
 * AVANT que le premier visiteur n'arrive.
 *
 * Bénéfice: Premier visiteur a un cache HIT (12-20ms) au lieu de MISS (150-300ms)
 *
 * Les pages gamme sont préchauffées par le module qui possède leur cache :
 * `GammeCacheWarmingService` (gamme-rest).
 */
@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);

  constructor(
    private readonly homepageRpcService: HomepageRpcService,
    private readonly catalogHierarchyService: CatalogHierarchyService,
  ) {}

  /**
   * 🚀 Exécuté automatiquement au démarrage de l'application
   */
  async onModuleInit() {
    setTimeout(() => {
      this.warmAllCaches().catch((err) =>
        this.logger.error('Cache warming failed:', err),
      );
    }, CACHE_WARMING_STARTUP_DELAY_MS);
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

      const totalTime = performance.now() - startTime;
      this.logger.log(`🎉 Cache warming terminé en ${totalTime.toFixed(0)}ms`);
    } catch (error) {
      this.logger.error('❌ Cache warming error:', error);
    }
  }
}
