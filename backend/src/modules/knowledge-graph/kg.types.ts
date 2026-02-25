/**
 * 🧠 Knowledge Graph Types - AI-COS v2.8.0
 *
 * Types TypeScript pour le Knowledge Graph et le Reasoning Engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// NODE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type KgNodeType =
  | 'Vehicle'
  | 'System'
  | 'Observable'
  | 'Fault'
  | 'Action'
  | 'Part';

export type KgValidationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'manual_review';

export interface KgNode {
  node_id: string;
  node_type: KgNodeType;
  node_label: string;
  node_alias?: string;
  node_category?: string;
  node_data: Record<string, unknown>;
  confidence: number;
  sources: string[];
  validation_status: KgValidationStatus;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  is_active: boolean;
}

export interface CreateKgNodeDto {
  node_type: KgNodeType;
  node_label: string;
  node_alias?: string;
  node_category?: string;
  node_data?: Record<string, unknown>;
  confidence?: number;
  sources?: string[];
  validation_status?: KgValidationStatus;
  created_by?: string;
}

export interface UpdateKgNodeDto {
  node_label?: string;
  node_alias?: string;
  node_category?: string;
  node_data?: Record<string, unknown>;
  confidence?: number;
  sources?: string[];
  validation_status?: KgValidationStatus;
}

// ═══════════════════════════════════════════════════════════════════════════
// EDGE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type KgEdgeType =
  | 'HAS_SYSTEM' // Vehicle → System
  | 'SHOWS_SYMPTOM' // System → Observable
  | 'CAUSES' // Observable → Fault
  | 'CAUSED_BY' // Fault → Observable (reverse)
  | 'DIAGNOSED_BY' // Fault → Action
  | 'FIXED_BY' // Fault → Part
  | 'REQUIRES_PART' // Action → Part
  | 'COMPATIBLE_WITH' // Part → Vehicle
  | 'CORRELATES_WITH' // Observable ↔ Observable
  | 'OFTEN_WITH' // Fault ↔ Fault
  | 'PRECEDES' // Fault → Fault
  | 'MENTIONED_IN' // Node → Article
  | 'SIMILAR_TO'; // Node → Node

export interface KgEdge {
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: KgEdgeType;
  weight: number;
  is_bidirectional: boolean;
  confidence: number;
  evidence: Record<string, unknown>;
  sources: string[];
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  is_active: boolean;
}

export interface CreateKgEdgeDto {
  source_node_id: string;
  target_node_id: string;
  edge_type: KgEdgeType;
  weight?: number;
  is_bidirectional?: boolean;
  confidence?: number;
  evidence?: Record<string, unknown>;
  sources?: string[];
  created_by?: string;
}

export interface UpdateKgEdgeDto {
  weight?: number;
  confidence?: number;
  evidence?: Record<string, unknown>;
  sources?: string[];
  is_active?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface DiagnoseInput {
  vehicleId?: string;
  observables: string[];
  confidenceThreshold?: number;
}

export interface FaultCandidate {
  fault_id: string;
  fault_label: string;
  fault_category?: string;
  edge_weight: number;
  edge_confidence: number;
  source_observable_id: string;
  sources: string[];
}

export interface ScoredFault {
  faultId: string;
  faultLabel: string;
  faultCategory?: string;
  score: number;
  matchedSymptoms: number;
  totalSymptoms: number;
  avgConfidence: number;
  matchedObservables: string[];
}

export interface DiagnosticPart {
  partNodeId: string;
  partLabel: string;
  pieceId?: string;
  gammeId?: string;
  confidence: number;
}

export interface DiagnosticAction {
  actionNodeId: string;
  actionLabel: string;
  actionCategory?: string;
  confidence: number;
}

export interface EnrichedFault extends ScoredFault {
  parts: DiagnosticPart[];
  actions: DiagnosticAction[];
}

export interface DiagnosticResult {
  faults: EnrichedFault[];
  primaryFault?: EnrichedFault;
  confidence: number;
  explanation: string;
  sources: string[];
  matchedSymptoms: string[];
  unmatchedSymptoms: string[];
  computationTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface KgReasoningCache {
  cache_id: string;
  query_hash: string;
  vehicle_node_id?: string;
  input_observables: string[];
  input_node_ids?: string[];
  result_faults: EnrichedFault[];
  result_primary_fault_id?: string;
  result_score: number;
  result_explanation: string;
  traversal_paths?: Record<string, unknown>[];
  computed_at: string;
  expires_at?: string;
  hit_count: number;
  last_hit_at?: string;
  computation_time_ms?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// GRAPH STATS
// ═══════════════════════════════════════════════════════════════════════════

export interface KgStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<KgNodeType, number>;
  edgesByType: Record<KgEdgeType, number>;
  avgConfidence: number;
  cacheHitRate: number;
  lastUpdated: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DB ROW SHAPES (for typed .map() callbacks — replaces :any)
// ═══════════════════════════════════════════════════════════════════════════

/** Row returned by the kg_edges + target join when traversing CAUSES edges */
export interface KgFaultEdgeRow {
  source_node_id?: string;
  weight?: number;
  confidence?: number;
  sources?: string[];
  target?: {
    node_id: string;
    node_label: string;
    node_category?: string;
  };
  [key: string]: unknown;
}

/** Row returned by the kg_find_parts_for_fault RPC */
export interface KgPartRpcRow {
  part_node_id?: string;
  part_label?: string;
  piece_id?: string;
  gamme_id?: string;
  edge_confidence?: number;
  [key: string]: unknown;
}

/** Row returned by the kg_edges + target join when traversing FIXED_BY edges */
export interface KgPartEdgeRow {
  confidence?: number;
  target?: {
    node_id: string;
    node_label: string;
    node_data?: {
      piece_id?: string;
      gamme_id?: string;
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
}

/** Row returned by the kg_find_actions_for_fault RPC */
export interface KgActionRpcRow {
  action_node_id?: string;
  action_label?: string;
  action_category?: string;
  edge_confidence?: number;
  [key: string]: unknown;
}

/** Row returned by the kg_edges + target join when traversing DIAGNOSED_BY edges */
export interface KgActionEdgeRow {
  confidence?: number;
  target?: {
    node_id: string;
    node_label: string;
    node_category?: string;
  };
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAVERSAL TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TraversalPath {
  nodes: KgNode[];
  edges: KgEdge[];
  totalWeight: number;
  totalConfidence: number;
}

export interface TraversalOptions {
  maxDepth?: number;
  minConfidence?: number;
  edgeTypes?: KgEdgeType[];
  nodeTypes?: KgNodeType[];
  limit?: number;
}
