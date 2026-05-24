/**
 * @repo/registry
 *
 * Zod schemas + TypeScript types for the Repository Control Plane V1
 * (ADR-058). 3-layer registry :
 *
 *   - Layer 1 (auto)    : `audit/registry/{files,db,rpc,deps,runtime}.json`
 *   - Layer 2 (overlay) : `.spec/00-canon/repository-registry/*.yaml`
 *   - Layer 3 (projection generated) : `audit/registry/canonical.json`
 *
 * **SoT** = couple Layer 1 + Layer 2. Layer 3 is a generated projection,
 * **never SoT primary** — rebuild if it diverges.
 *
 * @see https://github.com/ak125/governance-vault — ADR-058
 * @see /home/deploy/.claude/plans/verifier-la-vraie-logical-whistle.md
 */

// ── Shared types ──
export { SchemaVersion, SchemaVersionSchema } from "./shared/schema-version";
export { StatusSchema, type Status } from "./shared/status";
export {
  SourceConfidenceSchema,
  type SourceConfidence,
} from "./shared/source-confidence";
export { DomainIdSchema, type DomainId } from "./shared/domain";
export { FileKindSchema, type FileKind } from "./shared/kind";
export { RiskSchema, type Risk } from "./shared/risk";
export { DeletePolicySchema, type DeletePolicy } from "./shared/delete-policy";
export { DerivedFromSchema, type DerivedFrom } from "./shared/derived-from";
export { OwnerIdSchema, type OwnerId } from "./shared/owner";
export { FamilyIdSchema, type FamilyId } from "./shared/family";
export { AccessSurfaceSchema, type AccessSurface } from "./shared/access-surface";

// ── Layer 1 entries (auto-generated) ──
export { FileEntrySchema, type FileEntry } from "./entries/file-entry";
export {
  DbTableEntrySchema,
  type DbTableEntry,
} from "./entries/db-table-entry";
export {
  RpcEntrySchema,
  RpcParseModeSchema,
  type RpcEntry,
  type RpcParseMode,
} from "./entries/rpc-entry";
export { DepEntrySchema, type DepEntry } from "./entries/dep-entry";
export {
  RuntimeEntrySchema,
  RuntimeKindSchema,
  type RuntimeEntry,
  type RuntimeKind,
} from "./entries/runtime-entry";
export {
  PlanningEntrySchema,
  PlanningRegistrySchema,
  PlanningStatusSchema,
  PlanningPrioritySchema,
  PlanningWorkTypeSchema,
  type PlanningEntry,
  type PlanningRegistry,
} from "./entries/planning-entry";
export {
  DependencyGraphSchema,
  DepGraphNodeSchema,
  DepGraphEdgeSchema,
  type DependencyGraph,
  type DepGraphNode,
  type DepGraphEdge,
} from "./entries/dependency-graph-entry";

// ── Layer 2 overlay (manual) ──
export {
  OwnershipEntrySchema,
  OwnershipRegistrySchema,
  type OwnershipEntry,
  type OwnershipRegistry,
} from "./overlay/ownership";
export {
  DomainEntrySchema,
  DomainsRegistrySchema,
  type DomainEntry,
  type DomainsRegistry,
  type DomainCriticality,
} from "./overlay/domains";
export {
  StatusOverrideEntrySchema,
  StatusOverridesSchema,
  type StatusOverrideEntry,
  type StatusOverrides,
} from "./overlay/status-overrides";
export {
  DeletePolicyEntrySchema,
  DeletePolicyOverlaySchema,
  type DeletePolicyEntry,
  type DeletePolicyOverlay,
} from "./overlay/delete-policy";
export {
  AutomationEntrySchema,
  AutomationRealitySchema,
  AutomationModeEnum,
  IntendedModeEnum,
  AutomationExecutorEnum,
  EvidenceRefSchema,
  RuntimeEvidenceItemSchema,
  RuntimeEvidenceSchema,
  LastVerifiedMethodEnum,
  type AutomationEntry,
  type AutomationReality,
  type AutomationMode,
  type IntendedMode,
  type AutomationExecutor,
  type EvidenceRef,
  type RuntimeEvidenceItem,
  type RuntimeEvidence,
  type LastVerifiedMethod,
} from "./overlay/automation-reality";

// ── Layer 3 canonical projection (generated) ──
export {
  CanonicalRegistrySchema,
  CanonicalMetaSchema,
  type CanonicalRegistry,
  type CanonicalMeta,
} from "./canonical/canonical-registry";

// ── Architecture contract (PR-2) ──
export {
  ArchitectureContractSchema,
  BoundarySchema,
  DepcruiseEmitSchema,
  LayerSchema,
  type ArchitectureContract,
} from "./canonical/architecture-contract";

// ── DB contract (PR-3a) ──
// AccessSurfaceSchema PROMOTED to shared/access-surface.ts in PR-R — exported above.
// OwnerSchema PROMOTED to shared/owner.ts in PR-5 — db-contract aliases it for back-compat.
export {
  DbContractSchema,
  TableSchema,
  CriticalitySchema,
  OwnerSchema,
  TableNameSchema,
  type DbContract,
} from "./canonical/db-contract";

// ── SEO criticality tiers (PR-2D foundation, ADR-062 proposed) ──
export {
  SeoCriticalitySchema,
  TierIdSchema,
  AlertingChannelSchema,
  classifyRoute,
  type SeoCriticality,
  type TierId,
  type AlertingChannel,
} from "./canonical/seo-criticality";

// ── VehicleContext cookie (PR-B, OPTION A locked) ──
export {
  VehicleContextSchema,
  VehicleContextPayloadSchema,
  signVehicleContext,
  verifyVehicleContext,
  VEHICLE_CTX_COOKIE_NAME,
  VEHICLE_CTX_COOKIE_MAX_AGE_SECONDS,
  type VehicleContext,
  type VehicleContextPayload,
} from "./vehicle-context";
