import { Injectable } from '@nestjs/common';
import {
  type SurfaceKey,
  SurfaceKeySchema,
  surfaceToRole,
  type NoindexThresholds,
  getThresholds,
} from '@repo/seo-role-contracts';
import { type RoleId } from '@repo/seo-roles';

/**
 * Catalogue centralisé des surfaces SEO (16 surfaces R0..R8 + blog + static + 410/412).
 * Source unique de vérité pour le branchement surface_key → role_id + thresholds.
 *
 * @see packages/seo-role-contracts/src/surface-keys.ts (SoT Zod)
 * @see packages/seo-role-contracts/src/noindex-thresholds.ts (seuils chiffrés)
 */
@Injectable()
export class SeoSurfaceRegistry {
  /** Liste figée des surfaces disponibles. */
  list(): SurfaceKey[] {
    return SurfaceKeySchema.options as SurfaceKey[];
  }

  /** Résout un surface_key vers son role_id canonique. Throw si invalide. */
  resolveRole(key: SurfaceKey): RoleId {
    SurfaceKeySchema.parse(key); // fail-fast si surface inconnue
    return surfaceToRole(key);
  }

  /** Seuils noindex pour la surface. */
  getThresholds(key: SurfaceKey): NoindexThresholds {
    SurfaceKeySchema.parse(key);
    return getThresholds(key);
  }

  /** True si la surface est listée comme valide. */
  isKnown(key: string): key is SurfaceKey {
    return SurfaceKeySchema.safeParse(key).success;
  }
}
