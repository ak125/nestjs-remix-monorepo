import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_WARMING_STARTUP_DELAY_MS } from '../../catalog/services/cache-warming.service';
import { GammeRpcService } from './gamme-rpc.service';

/**
 * 🔥 Préchauffage du cache des pages gamme au démarrage.
 *
 * Remplit le cache des gammes du catalogue actif avant le premier visiteur.
 * L'appel se fait dans le processus, par `GammeRpcService` : le démarrage
 * n'a besoin d'aucune route HTTP, donc `POST api/gamme-rest/cache/warm` est
 * réservée à l'administration.
 */
@Injectable()
export class GammeCacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(GammeCacheWarmingService.name);

  constructor(private readonly rpcService: GammeRpcService) {}

  onModuleInit() {
    setTimeout(
      () => void this.warmCatalogGammes(),
      CACHE_WARMING_STARTUP_DELAY_MS,
    );
  }

  /** Un échec est tracé et n'interrompt pas le démarrage. */
  async warmCatalogGammes(): Promise<void> {
    try {
      // Une liste vide est déjà tracée par `getCatalogPgIds`.
      const pgIds = await this.rpcService.getCatalogPgIds();
      if (!pgIds.length) return;

      const { success, failed } = await this.rpcService.warmCache(pgIds);
      this.logger.log(
        `✅ Gamme cache warmed: ${success}/${pgIds.length} OK, ${failed} failed`,
      );
    } catch (error) {
      this.logger.warn(
        `⚠️ Gamme warming skipped: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
