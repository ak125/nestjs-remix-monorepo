/**
 * Types TypeScript pour le systeme video Media Factory P0.
 *
 * Reutilise les patterns de content-refresh.types.ts (EvidenceEntry, ClaimEntry)
 * avec extensions specifiques video (VideoClaimKind, Disclaimer, Approval).
 */

import type {
  VideoType,
  VideoStatus,
  VideoMode,
  VideoGateName,
  GateVerdict,
  VideoClaimKind,
  DisclaimerType,
  DisclaimerPosition,
  ApprovalStage,
  ApprovalStatus,
  Platform,
  VisualType,
  TruthDependency,
} from '../../../config/video-quality.constants';

// Re-export for convenience
export type {
  VideoType,
  VideoStatus,
  VideoMode,
  VideoGateName,
  GateVerdict,
  Platform,
};

// ─────────────────────────────────────────────────────────────
// Artefact 1: Video Brief
// ─────────────────────────────────────────────────────────────

export interface VideoBrief {
  briefId: string;
  type: VideoType;
  mode: VideoMode;
  vertical: string;
  gamme?: string;
  pgId?: number;
  targetPlatforms: Platform[];
  targetDurationSec: { min: number; max: number };
  knowledgeContractId: string;
  templateId: string;
  createdBy: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Artefact 2: Claim Table (extends RAG ClaimEntry)
// ─────────────────────────────────────────────────────────────

export interface VideoClaimEntry {
  id: string;
  kind: VideoClaimKind;
  rawText: string;
  value: string;
  unit: string;
  sectionKey: string;
  sourceRef: string | null;
  evidenceId: string | null;
  status: 'verified' | 'unverified' | 'blocked';
  /** For kind='procedure' or 'safety': requires human validation */
  requiresHumanValidation: boolean;
  /** Human validator identity (if validated) */
  validatedBy?: string;
  validatedAt?: string;
}

// ─────────────────────────────────────────────────────────────
// Artefact 3: Evidence Pack (reuses RAG EvidenceEntry)
// ─────────────────────────────────────────────────────────────

export interface VideoEvidenceEntry {
  docId: string;
  heading: string;
  charRange: [number, number];
  rawExcerpt: string;
  confidence: number;
  sourceHash?: string;
}

// ─────────────────────────────────────────────────────────────
// Artefact 4: Disclaimer Plan
// ─────────────────────────────────────────────────────────────

export interface DisclaimerEntry {
  type: DisclaimerType;
  text: string;
  position: DisclaimerPosition;
}

export interface DisclaimerPlan {
  disclaimers: DisclaimerEntry[];
}

// ─────────────────────────────────────────────────────────────
// Artefact 5: Approval Record
// ─────────────────────────────────────────────────────────────

export interface ApprovalEntry {
  stage: ApprovalStage;
  status: ApprovalStatus;
  by: string | null;
  at: string | null;
  comment?: string;
}

export interface ApprovalRecord {
  briefId: string;
  stages: ApprovalEntry[];
}

// ─────────────────────────────────────────────────────────────
// Gate results (mirrors ExtendedGateResult from hard-gates)
// ─────────────────────────────────────────────────────────────

export interface VideoGateResult {
  gate: VideoGateName;
  verdict: GateVerdict;
  details: string[];
  measured: number;
  warnThreshold: number;
  failThreshold: number;
  triggerItems?: Array<{
    location: string;
    issue: string;
    evidenceRef?: string;
  }>;
}

export interface VideoGateOutput {
  canPublish: boolean;
  gates: VideoGateResult[];
  flags: string[];
}

// ─────────────────────────────────────────────────────────────
// Video Production (full record)
// ─────────────────────────────────────────────────────────────

export interface VideoProduction {
  id: number;
  briefId: string;
  videoType: VideoType;
  vertical: string;
  gammeAlias?: string;
  pgId?: number;
  status: VideoStatus;
  templateId?: string;
  knowledgeContract: Record<string, unknown> | null;
  claimTable: VideoClaimEntry[] | null;
  evidencePack: VideoEvidenceEntry[] | null;
  disclaimerPlan: DisclaimerPlan | null;
  approvalRecord: ApprovalRecord | null;
  qualityScore: number | null;
  qualityFlags: string[];
  gateResults: VideoGateResult[] | null;
  // Step 1: Script generation
  scriptText: string | null;
  scriptGeneratedAt: string | null;
  scriptModel: string | null;
  narrativeStylePack: Record<string, unknown> | null;
  derivativePolicy: Record<string, unknown> | null;
  // Step 3: TTS
  masterAudioUrl: string | null;
  ttsVoice: string | null;
  ttsSpeed: number | null;
  // Step 5: Derivatives
  parentBriefId: string | null;
  derivativeIndex: number | null;
  contentRole: string;
  // Meta
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Video Template
// ─────────────────────────────────────────────────────────────

export interface VideoTemplate {
  id: number;
  templateId: string;
  version: number;
  videoType: VideoType;
  platform: Platform;
  allowedUseCases: string[];
  forbiddenUseCases: string[];
  durationRange: { min: number; max: number };
  structure: Record<string, unknown>;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Video Asset
// ─────────────────────────────────────────────────────────────

export interface VideoAsset {
  id: number;
  assetKey: string;
  visualType: VisualType;
  truthDependency: TruthDependency;
  tags: string[];
  filePath?: string;
  validated: boolean;
  validatedBy?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// NO-GO check (all 5 artefacts must exist)
// ─────────────────────────────────────────────────────────────

export interface ArtefactCheckResult {
  hasBrief: boolean;
  hasClaimTable: boolean;
  hasEvidencePack: boolean;
  hasDisclaimerPlan: boolean;
  hasApprovalRecord: boolean;
  /** True only if ALL 5 artefacts present */
  canProceed: boolean;
  missingArtefacts: string[];
}
