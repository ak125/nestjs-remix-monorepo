import { z } from "zod";

/**
 * Confidence in the signal that produced a classification (status, owner, domain).
 *
 * Per ADR-058 invariant V1-3 :
 * - `high`   : signal direct unambigu (entry CODEOWNERS exacte, AST parse complet,
 *              import résolu via dep-cruiser stable)
 * - `medium` : dérivation par glob ou heuristique (ownership matché par préfixe,
 *              RPC partially_parsed, owner inféré de role canon)
 * - `low`    : signal faible (RPC unknown_signature, ownership absent,
 *              classification basée sur convention de nommage uniquement)
 *
 * Coverage thresholds per dimension (see memory
 * feedback_coverage_per_dimension_thresholds.md) :
 * - V1 PR-H acceptance : ownership_high_confidence_pct ≥ 70 %
 * - V2 block-all trigger : ownership_high_confidence_pct ≥ 80 %
 */
export const SourceConfidenceSchema = z.enum(["high", "medium", "low"]);

export type SourceConfidence = z.infer<typeof SourceConfidenceSchema>;
