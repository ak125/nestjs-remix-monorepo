/**
 * Execution Registry Constants — Phase 2 Orchestration (P2.1)
 *
 * Maps each canonical role to its execution configuration:
 * contract, enricher service, agents, prompts, modes, policies.
 *
 * P1.5: writeScope is auto-derived from FIELD_CATALOG at module load.
 * Never add ownedFields/ownedTables manually here — they come from
 * field-catalog.constants.ts via deriveWriteScope().
 *
 * @see .spec/00-canon/phase2-canon.md v1.1.0 — P2.1 Orchestration
 */

import { RoleId } from './role-ids';
import type { ExecutionRegistryEntry } from './execution-registry.types';
import { deriveWriteScope } from './field-catalog.constants';

// ── Version ──

export const EXECUTION_REGISTRY_VERSION = '1.0.0';

// ── Registry ──

export const EXECUTION_REGISTRY: Record<string, ExecutionRegistryEntry> = {
  [RoleId.R2_PRODUCT]: {
    roleId: RoleId.R2_PRODUCT,
    pageType: 'R2_product',
    contractSchemaRef: 'r2-content-contract.schema',
    enricherServiceKey: 'R2EnricherService',
    agentFiles: ['r2-keyword-planner.md'],
    promptChain: [
      'audit_finder',
      'keyword_intent',
      'section_keyword_map',
      'section_content_gen',
      'micro_specs',
      'qa_gatekeeper',
    ],
    allowedModes: ['create', 'regenerate', 'refresh_full', 'qa_only'],
    defaultWriteMode: 'draft_write',
    stopPolicy: { maxRetries: 1, timeoutMs: 120_000 },
    escalationPolicy: { onGateFail: 'block', onTimeout: 'hold' },
    requiredUpstreamPhases: [],
  },

  // R1_ROUTER: executable enrichment entry removed (Tranche-B R1 — ADR-031/046 +
  // memory feedback_rag_zero_content_write_authority_remove_not_secure). R1EnricherService
  // was a RAG→served-content producer (RAG .md → __seo_r1_gamme_slots); RAG has ZERO
  // content-write authority, so the writer is DELETED (not gated/provenance-tagged). No
  // replacement wired here — the future canonical producer is WIKI→projection (separate,
  // owner-gated). Same surface as the R3_CONSEILS precedent below: any R1_ROUTER enrichment
  // dispatch now fails explicitly with "No registry entry for role" (blocked_no_write) —
  // never a silent skip. Existing __seo_r1_gamme_slots rows stay served statically via RPC
  // get_buying_guide_with_r1_slots (readers untouched); R1 pages remain served through the
  // read path (GammeResponseBuilderService). Do NOT re-add a RAG-fed entry.

  // R3_GUIDE: deprecated since role-ids.ts:17 ("no route, no contract, no prompts").
  // Already in FORBIDDEN_ROLE_IDS + DEPRECATED_OUTPUT_ROLES (role-ids.ts).
  // Registry entry removed to align: a deprecated role MUST NOT have an
  // executable plan. Legacy content uses R3_CONSEILS (how-to) or R6_GUIDE_ACHAT
  // (buying guides) — see PAGE_TYPE_TO_ROLE remap. Closes the matrix anomaly
  // `deprecated_but_in_registry` flagged by OperatingMatrixService.

  // R3_CONSEILS: executable entry removed (B2/B6 — ADR-027 §Correction 2026-07-07 + ADR-080).
  // ConseilEnricherService was a RAG→served-content producer (RAG doc →
  // __seo_gamme_conseil + sg_descrip_draft); RAG has zero content authority, so the
  // whole executable path is gone (service deleted, no replacement wired here).
  // Same surface as the R3_GUIDE precedent above: any dispatch of R3_CONSEILS now
  // fails explicitly with "No registry entry for role" — never a silent skip.
  // Existing __seo_gamme_conseil rows stay served statically (readers untouched);
  // the future canonical producer is WIKI→projection (separate, owner-gated).
  // Do NOT re-add a RAG-fed entry.

  [RoleId.R4_REFERENCE]: {
    roleId: RoleId.R4_REFERENCE,
    pageType: 'R4_reference',
    contractSchemaRef: 'page-contract-r4.schema',
    enricherServiceKey: 'ReferenceService',
    agentFiles: ['r4-content-batch.md', 'r4-keyword-planner.md'],
    promptChain: ['reference_enrichment'],
    allowedModes: [
      'create',
      'regenerate',
      'refresh_partial',
      'refresh_full',
      'repair',
      'qa_only',
    ],
    defaultWriteMode: 'draft_write',
    stopPolicy: { maxRetries: 2, timeoutMs: 120_000 },
    escalationPolicy: { onGateFail: 'block', onTimeout: 'hold' },
    requiredUpstreamPhases: ['phase16_admissibility'],
  },

  [RoleId.R5_DIAGNOSTIC]: {
    roleId: RoleId.R5_DIAGNOSTIC,
    pageType: 'R5_diagnostic',
    contractSchemaRef: 'page-contract-r5.schema',
    enricherServiceKey: 'DiagnosticService',
    agentFiles: [],
    promptChain: ['diagnostic_refresh'],
    allowedModes: ['create', 'regenerate', 'refresh_full', 'qa_only'],
    defaultWriteMode: 'draft_write',
    stopPolicy: { maxRetries: 1, timeoutMs: 60_000 },
    escalationPolicy: { onGateFail: 'block', onTimeout: 'hold' },
    requiredUpstreamPhases: [],
  },

  [RoleId.R6_GUIDE_ACHAT]: {
    roleId: RoleId.R6_GUIDE_ACHAT,
    pageType: 'R6_guide_achat',
    contractSchemaRef: 'page-contract-r6.schema',
    enricherServiceKey: 'BuyingGuideEnricherService',
    agentFiles: ['r6-content-batch.md', 'r6-keyword-planner.md'],
    promptChain: ['guide_achat_enrichment'],
    allowedModes: [
      'create',
      'regenerate',
      'refresh_partial',
      'refresh_full',
      'repair',
      'qa_only',
    ],
    defaultWriteMode: 'draft_write',
    stopPolicy: { maxRetries: 2, timeoutMs: 180_000 },
    escalationPolicy: { onGateFail: 'block', onTimeout: 'hold' },
    requiredUpstreamPhases: ['phase16_admissibility'],
  },

  [RoleId.R7_BRAND]: {
    roleId: RoleId.R7_BRAND,
    pageType: 'R7_brand',
    contractSchemaRef: 'page-contract-r7.schema',
    enricherServiceKey: 'R7BrandEnricherService',
    // Writers only — validators/execution-templates are read-only and not part
    // of the WriteGuard plan (see r7-brand-validator.md, r7-brand-execution.md).
    agentFiles: ['r7-keyword-planner.md', 'r7-brand-rag-generator.md'],
    promptChain: [
      'keyword_plan',
      'section_bundle_generation',
      'qa_gatekeeper',
      'rag_generation',
    ],
    allowedModes: ['create', 'regenerate', 'refresh_full', 'qa_only'],
    defaultWriteMode: 'draft_write',
    stopPolicy: { maxRetries: 2, timeoutMs: 180_000 },
    escalationPolicy: { onGateFail: 'block', onTimeout: 'hold' },
    requiredUpstreamPhases: ['phase16_admissibility'],
  },

  [RoleId.R8_VEHICLE]: {
    roleId: RoleId.R8_VEHICLE,
    pageType: 'R8_vehicle',
    contractSchemaRef: 'page-contract-r8.schema',
    enricherServiceKey: 'R8VehicleEnricherService',
    agentFiles: ['r8-keyword-planner.md'],
    promptChain: ['vehicle_enrichment'],
    allowedModes: ['create', 'regenerate', 'refresh_full', 'qa_only'],
    defaultWriteMode: 'draft_write',
    stopPolicy: { maxRetries: 1, timeoutMs: 120_000 },
    escalationPolicy: { onGateFail: 'block', onTimeout: 'hold' },
    requiredUpstreamPhases: [],
  },
};

// ── P1.5: Auto-derive writeScope from FIELD_CATALOG ──
// This ensures zero drift between the catalog and the registry.

for (const entry of Object.values(EXECUTION_REGISTRY)) {
  entry.writeScope = deriveWriteScope(entry.roleId);
}

// ── Contract Schema Map ──

export const CONTRACT_SCHEMA_MAP: Record<string, string> = {
  'page-contract-r1.schema': 'page-contract-r1.schema',
  'page-contract-r3.schema': 'page-contract-r3.schema',
  'page-contract-r4.schema': 'page-contract-r4.schema',
  'page-contract-r5.schema': 'page-contract-r5.schema',
  'page-contract-r6.schema': 'page-contract-r6.schema',
  'page-contract-r7.schema': 'page-contract-r7.schema',
  'page-contract-r8.schema': 'page-contract-r8.schema',
};

// ── Cross-Role Content Policy (salvage pré-purge RAG 2026-06-11) ──
// Résiduel cross-rôle porté 1:1 depuis content-section-policy.ts (matrice
// ownership/mode/budget par section × rôle, SECTION_CLAIM_LIMITS,
// faqIntentPatterns, bridge PageRole→RoleId) et brief-gates.service.ts
// (budgets Gate C similarité TF-IDF par paire, ROLE_FORBIDDEN_PATTERNS Gate A)
// — fichiers legacy en cours de suppression (programme purge « RAG = source
// de contenu »). Surface machine-readable consommée par les agents seo-batch
// (r*-execution / r*-validator). Données uniquement — aucune logique
// d'enforcement n'est portée ici.

export const CROSS_ROLE_POLICY_FILE = 'page-contract-cross-role-policy.json';
