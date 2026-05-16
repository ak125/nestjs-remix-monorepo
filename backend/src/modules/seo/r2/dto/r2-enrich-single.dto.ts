/**
 * ADR-066 — R2 Admin Pilot DTO
 *
 * Request DTO for `POST /api/admin/seo/r2/enrich-single` — PR 1 sync pilot
 * endpoint (1 URL, no BullMQ). PR 2 V1.5 introduces async batch endpoint.
 *
 * Pattern aligné monorepo : interface + validation inline dans le controller
 * (cf seo-generator.controller.ts pattern existant). Pas de class-validator
 * dep (non utilisée ailleurs dans monorepo).
 */

export interface R2EnrichSingleDto {
  pgId: number;
  typeId: number;
}

export interface R2EnrichSingleResponse {
  pgId: number;
  typeId: number;
  featureFlagEnabled: boolean;
  eligibility: {
    score: number;
    // ADR-067 + ADR-068 : pipeline ne peut émettre que ces 3 verdicts.
    // 'suppressed' reste un statut DB pour le path manual admin uniquement.
    verdict: 'eligible' | 'review_required' | 'reject';
    // ADR-068 : si verdict='reject', rejectReason DOIT être l'une des 4 raisons strict.
    rejectReason?:
      | 'productCount_under_2'
      | 'data_invalid'
      | 'url_impossible'
      | 'compatibility_absent';
    reason: string;
    subscores: {
      motor: number;
      compat: number;
      commercial: number;
      crawl: number;
    };
  };
  warning?: string;
  timestamp: string;
}
