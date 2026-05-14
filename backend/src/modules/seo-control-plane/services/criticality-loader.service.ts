/**
 * CriticalityLoaderService — Layer 4 Governance binding.
 *
 * Charge `.spec/00-canon/repository-registry/seo-criticality.yaml` au boot
 * (Zod-validated via `@repo/registry` SeoCriticalitySchema), expose
 * `classifyRoute()` + accès aux policies par tier.
 *
 * ADR-064 §Architecture L4 : "L4 Governance jamais mutée runtime. Lecture
 * par L1/L2/L3 au boot, jamais de mutation runtime."
 *
 * Discipline 4-layer : ce service appartient au Layer 4 (binding du YAML
 * canon). Les Layers 1/2/3 le consomment via DI. Aucun import inverse.
 *
 * @see feedback_seo_routes_need_criticality_tiers
 * @see feedback_seo_control_plane_layered_architecture
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import {
  SeoCriticalitySchema,
  classifyRoute,
  type SeoCriticality,
  type TierId,
} from '@repo/registry';

/**
 * Resolution path : depuis backend/dist runtime, remonter à la racine repo
 * puis joindre `.spec/00-canon/repository-registry/seo-criticality.yaml`.
 *
 * En dev (ts source) __dirname = `.../backend/src/modules/seo-control-plane/services/`,
 * en prod (compilé) = `.../backend/dist/modules/seo-control-plane/services/`.
 * Dans les deux cas remonter 5 niveaux → racine monorepo.
 */
const CANON_RELATIVE_PATH =
  '../../../../../.spec/00-canon/repository-registry/seo-criticality.yaml';

@Injectable()
export class CriticalityLoaderService implements OnModuleInit {
  private readonly logger = new Logger(CriticalityLoaderService.name);
  private config: SeoCriticality | null = null;
  private loadError: Error | null = null;

  /**
   * onModuleInit synchrone, pas d'I/O distante — lecture fichier locale
   * uniquement. Cohérent règle `.claude/rules/backend.md` § Non-blocking
   * onModuleInit (cas autorisé : fs.readFileSync = local-fast OK).
   */
  onModuleInit(): void {
    try {
      const filePath = path.resolve(__dirname, CANON_RELATIVE_PATH);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.load(raw);
      this.config = SeoCriticalitySchema.parse(parsed);
      this.logger.log(
        `✅ seo-criticality.yaml loaded (tier0=${this.config.tiers.tier0.routes.length} routes, tier1=${this.config.tiers.tier1.routes.length}, tier2=${this.config.tiers.tier2.routes.length}, excluded=${this.config.excluded.routes.length})`,
      );
    } catch (err) {
      this.loadError = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `❌ Failed to load seo-criticality.yaml — L4 Governance binding broken. ` +
          `L1/L2/L3 consumers will fail loudly. Error: ${this.loadError.message}`,
      );
      // Pas de rethrow : laisse le module booter (cohérent backend.md
      // § Non-blocking onModuleInit). Les consumers L1/L2/L3 doivent
      // appeler getConfig() qui throwera explicitement à l'utilisation.
    }
  }

  /**
   * Retourne la config L4. Throw si le boot a échoué — fail-loud à
   * l'utilisation plutôt que silent fallback.
   *
   * @throws Error si le canon n'a pas pu être chargé au boot.
   */
  getConfig(): SeoCriticality {
    if (this.config) return this.config;
    if (this.loadError) {
      throw new Error(
        `seo-criticality.yaml not loaded (boot failed): ${this.loadError.message}`,
      );
    }
    throw new Error(
      'CriticalityLoaderService not initialized — onModuleInit pending?',
    );
  }

  /**
   * Classifie une route. Cf. `@repo/registry#classifyRoute`. Si la config
   * n'est pas chargée, throw (fail-loud).
   */
  classify(routePath: string): TierId | 'excluded' | null {
    return classifyRoute(this.getConfig(), routePath);
  }

  /** Test seam : permet d'injecter une config en mémoire (tests unitaires). */
  setConfigForTest(config: SeoCriticality): void {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('setConfigForTest() called in production — forbidden.');
    }
    this.config = config;
    this.loadError = null;
  }
}
