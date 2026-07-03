/**
 * Template Registry — Code-level mapping from templateId to Remotion composition (P8).
 *
 * Code-first registry. DB table __video_templates is metadata/governance only.
 * Rule: Unknown templateId → fallback to TestCard.
 */

import type { VideoType } from '../../../../config/video-quality.constants';

export interface TemplateRegistryEntry {
  /** The Remotion composition ID (must match <Composition id="..."> in renderer) */
  compositionId: string;
  displayName: string;
  supportedVideoTypes: VideoType[];
  defaultDurationFrames: number;
  defaultResolution: { width: number; height: number };
  status: 'stable' | 'experimental';
}

const FALLBACK_TEMPLATE_ID = 'test-card';

const REGISTRY: Record<string, TemplateRegistryEntry> = {
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

/** Resolve templateId to a registry entry. Falls back to TestCard for unknown. */
export function resolveTemplate(
  templateId: string | null | undefined,
): TemplateRegistryEntry {
  if (!templateId || !REGISTRY[templateId]) {
    return REGISTRY[FALLBACK_TEMPLATE_ID];
  }
  return REGISTRY[templateId];
}

/** Get default templateId for a given videoType (when production has no explicit templateId). */
export function defaultTemplateForVideoType(videoType: VideoType): string {
  if (videoType === 'short') return 'short-product-highlight';
  return FALLBACK_TEMPLATE_ID;
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
