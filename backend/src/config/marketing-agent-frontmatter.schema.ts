/**
 * Marketing Agent Frontmatter Schema — Zod canonique pour les
 * `workspaces/marketing/.claude/agents/**\/*.md` (ADR-038, étend ADR-037).
 *
 * Source de vérité du mapping agent → MarketingRoleId, conforme à ADR-038.
 * Lu par : MarketingMatrixService.scanAgents() (boot fail-fast côté NestJS).
 * Écrit par : auteur humain (Phase 1.5 PR-1.5 d'ADR-036).
 *
 * Différences vs `agent-frontmatter.schema.ts` (SEO) :
 *   - role: enum MarketingRoleId (3 valeurs canon Phase 1-2)
 *   - business_unit: array de MarketingBusinessUnit (scope agent — vérifié au runtime
 *     contre les briefs envoyés via DTO Zod)
 */

import { z } from 'zod';

import {
  MARKETING_ROLE_ID_LIST,
  MarketingBusinessUnit,
} from './marketing-matrix.types';

/** Liste des MarketingBusinessUnit comme tuple Zod. */
const BUSINESS_UNIT_VALUES = Object.values(MarketingBusinessUnit) as [
  string,
  ...string[],
];

export const MarketingAgentFrontmatterSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    role: z.enum(MARKETING_ROLE_ID_LIST as [string, ...string[]]),
    /**
     * Business units où l'agent est autorisé à produire des briefs.
     * Au moins 1 entrée requise. Vérifiée au runtime via DTO Zod sur les briefs
     * (rejet si l'agent appelle un business_unit hors de son scope).
     */
    business_unit: z
      .array(z.enum(BUSINESS_UNIT_VALUES))
      .min(1, 'business_unit must contain at least one MarketingBusinessUnit'),
    // Champs Claude Code natifs déjà présents — passthrough optionnel.
    model: z.string().optional(),
    tools: z.array(z.string()).optional(),
  })
  .passthrough();

export type MarketingAgentFrontmatter = z.infer<
  typeof MarketingAgentFrontmatterSchema
>;

/**
 * Parse + validate frontmatter. Throws ZodError au premier souci.
 * Utilisé en boot strict (MarketingMatrixService) — fail-fast.
 */
export function parseMarketingAgentFrontmatter(
  raw: unknown,
): MarketingAgentFrontmatter {
  return MarketingAgentFrontmatterSchema.parse(raw);
}

/**
 * Variante safe — retourne { success, data | error } sans throw.
 * Utilisée par `MarketingMatrixService.scanAgents()` pour agréger les erreurs
 * et les surfacer ensuite dans `formatBootLog()` au lieu de planter au scan.
 */
export function safeParseMarketingAgentFrontmatter(raw: unknown) {
  return MarketingAgentFrontmatterSchema.safeParse(raw);
}
