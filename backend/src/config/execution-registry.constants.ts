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

  [RoleId.R1_ROUTER]: {
    roleId: RoleId.R1_ROUTER,
    pageType: 'R1_pieces',
    contractSchemaRef: 'page-contract-r1.schema',
    enricherServiceKey: 'R1ContentPipelineService',
    agentFiles: ['r1-content-batch.md'],
    promptChain: ['intent_lock', 'serp_pack', 'section_copy', 'gatekeeper'],
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

  [RoleId.R3_GUIDE]: {
    roleId: RoleId.R3_GUIDE,
    pageType: 'R3_guide_howto',
    contractSchemaRef: 'page-contract-r3.schema',
    enricherServiceKey: 'BuyingGuideEnricherService',
    agentFiles: ['content-batch.md'],
    promptChain: ['guide_enrichment'],
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

  [RoleId.R3_CONSEILS]: {
    roleId: RoleId.R3_CONSEILS,
    pageType: 'R3_conseils',
    contractSchemaRef: 'page-contract-r3.schema',
    enricherServiceKey: 'ConseilEnricherService',
    agentFiles: ['conseil-batch.md', 'keyword-planner.md'],
    promptChain: ['conseil_enrichment'],
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
