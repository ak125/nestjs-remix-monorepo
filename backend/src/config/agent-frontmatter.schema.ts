/**
 * Agent Frontmatter Schema — Zod canonique pour les `.claude/agents/**\/*.md`.
 *
 * Source de vérité du mapping agent → RoleId, conforme à ADR-037.
 * Remplace l'ancienne extraction par regex sur filename (`extractRoleId`)
 * dans `OperatingMatrixService`. Fail-fast au boot si frontmatter invalide.
 *
 * Lu par : OperatingMatrixService.scanAllAgents() (boot WriteGuardModule).
 * Écrit par : auteur humain de l'agent + script `scripts/seo/inject-agent-role.ts`.
 */

import { z } from 'zod';

import { ROLE_ID_LIST } from './role-ids';

/** Schema strict — tout agent .md doit fournir au minimum name/description/role. */
export const AgentFrontmatterSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    role: z.enum(ROLE_ID_LIST as [string, ...string[]]),
    // Champs Claude Code natifs déjà présents dans certains agents — passthrough optionnel.
    model: z.string().optional(),
    tools: z.array(z.string()).optional(),
  })
  .passthrough();

export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;

/**
 * Parse + validate frontmatter. Throws ZodError au premier souci.
 * Utilisé en boot strict (WriteGuard) — fail-fast.
 */
export function parseAgentFrontmatter(raw: unknown): AgentFrontmatter {
  return AgentFrontmatterSchema.parse(raw);
}

/**
 * Variante safe — retourne { success, data | error } sans throw.
 * Utile pour les scripts d'audit qui itèrent sur N agents et veulent
 * agréger les erreurs avant d'échouer.
 */
export function safeParseAgentFrontmatter(raw: unknown) {
  return AgentFrontmatterSchema.safeParse(raw);
}
