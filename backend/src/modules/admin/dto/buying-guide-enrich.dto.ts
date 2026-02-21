import { z } from 'zod';
import type {
  EvidenceEntry,
  ClaimEntry,
} from '../../../workers/types/content-refresh.types';

// ── Request ──────────────────────────────────────────────────

export const BuyingGuideEnrichRequestSchema = z.object({
  pgIds: z.array(z.string().min(1)).min(1).max(50),
  dryRun: z.boolean().optional().default(true),
});

export type BuyingGuideEnrichRequestDto = z.infer<
  typeof BuyingGuideEnrichRequestSchema
>;

// ── Section schemas (RAG response → structured JSON) ─────────

export const SelectionCriterionSchema = z.object({
  key: z.string(),
  label: z.string(),
  guidance: z.string(),
  priority: z.enum(['required', 'recommended']),
});

export const DecisionNodeSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(
    z.object({
      label: z.string(),
      outcome: z.enum(['continue', 'check', 'replace', 'stop']),
      nextId: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
});

export const FaqItemSchema = z.object({
  question: z.string().min(10),
  answer: z.string().min(20),
});

export const UseCaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  recommendation: z.string(),
});

// ── Section result (per-section enrichment output) ───────────

export const SectionResultSchema = z.object({
  content: z.unknown(),
  sources: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  sourcesCitation: z.string().optional(),
});

export type SectionResult = z.infer<typeof SectionResultSchema>;

// ── Full enrichment result for a single gamme ────────────────

export interface EnrichmentResult {
  pgId: string;
  sections: Record<string, SectionResult>;
  averageConfidence: number;
  updated: boolean;
  sectionsUpdated: number;
  skippedSections: string[];
  evidencePack?: EvidenceEntry[];
  claims?: ClaimEntry[];
}
