/**
 * Template Registry — Code-level mapping from templateId to Remotion composition (P8).
 *
 * Code-first registry. DB table __video_templates is metadata/governance only.
 * Rule: TestCard is explicit; unknown or absent templates must fail closed.
 */

import type { VideoType } from '../../../../config/video-quality.constants';
import { DomainValidationException } from '@common/exceptions';

export interface TemplateRegistryEntry {
  /** The Remotion composition ID (must match <Composition id="..."> in renderer) */
  compositionId: string;
  displayName: string;
  supportedVideoTypes: VideoType[];
  defaultDurationFrames: number;
  defaultResolution: { width: number; height: number };
  status: 'stable' | 'experimental';
  /** Requires the versioned narrative envelope instead of generic claim props. */
  requiresScenario?: boolean;
}

const REGISTRY: Record<string, TemplateRegistryEntry> = {
  'ne-change-pas-trop-vite': {
    compositionId: 'NeChangePasTropVite',
    requiresScenario: true,
    displayName: 'Fafa — Ne change pas trop vite',
    supportedVideoTypes: ['short'],
    defaultDurationFrames: 1140,
    defaultResolution: { width: 1080, height: 1920 },
    status: 'experimental',
  },
  'symptome-3-causes': {
    compositionId: 'SymptomeTroisCauses',
    requiresScenario: true,
    displayName: 'Fafa — Un symptôme, trois causes',
    supportedVideoTypes: ['short'],
    defaultDurationFrames: 990,
    defaultResolution: { width: 1080, height: 1920 },
    status: 'experimental',
  },
  'piece-expliquee': {
    compositionId: 'PieceExpliquee',
    requiresScenario: true,
    displayName: 'Fafa — Pièce expliquée',
    supportedVideoTypes: ['short'],
    defaultDurationFrames: 1200,
    defaultResolution: { width: 1080, height: 1920 },
    status: 'experimental',
  },
  'test-card': {
    compositionId: 'TestCard',
    displayName: 'Test Card (P6)',
    supportedVideoTypes: ['short', 'film_gamme', 'film_socle'],
    defaultDurationFrames: 150, // 5s
    defaultResolution: { width: 1920, height: 1080 },
    status: 'stable',
  },
  'short-product-highlight': {
    compositionId: 'ShortProductHighlight',
    displayName: 'Short Product Highlight',
    supportedVideoTypes: ['short'],
    defaultDurationFrames: 450, // 15s
    defaultResolution: { width: 1080, height: 1920 }, // vertical 9:16
    status: 'experimental',
  },
  'short-braking-fact': {
    compositionId: 'ShortBrakingFact',
    displayName: 'Short Braking Fact',
    supportedVideoTypes: ['short'],
    defaultDurationFrames: 630, // 21s
    defaultResolution: { width: 1080, height: 1920 }, // vertical 9:16
    status: 'experimental',
  },
};

/** Resolve an explicit registered template without substituting demo content. */
export function resolveTemplate(
  templateId: string | null | undefined,
): TemplateRegistryEntry {
  if (!templateId || !Object.hasOwn(REGISTRY, templateId)) {
    throw new DomainValidationException({
      message: 'An explicit registered video template is required',
      field: 'templateId',
    });
  }
  return REGISTRY[templateId];
}

/** Get default templateId for a given videoType (when production has no explicit templateId). */
export function defaultTemplateForVideoType(videoType: VideoType): string {
  if (videoType === 'short') return 'short-product-highlight';
  throw new DomainValidationException({
    message: 'An explicit video template is required for this format',
    field: 'templateId',
  });
}

/** List all registered templates. */
export function listRegisteredTemplates(): Array<
  { templateId: string } & TemplateRegistryEntry
> {
  return Object.entries(REGISTRY).map(([templateId, entry]) => ({
    templateId,
    ...entry,
  }));
}
