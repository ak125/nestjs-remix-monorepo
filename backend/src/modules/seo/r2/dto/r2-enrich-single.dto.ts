/**
 * ADR-066 — R2 Admin Pilot DTO
 *
 * Request DTO for `POST /api/admin/seo/r2/enrich-single` — PR 1 sync pilot
 * endpoint (1 URL, no BullMQ). PR 2 V1.5 introduces async batch endpoint.
 */

import { IsInt, Min, Max } from 'class-validator';

export class R2EnrichSingleDto {
  @IsInt()
  @Min(1)
  pgId!: number;

  @IsInt()
  @Min(1)
  @Max(99_999_999)
  typeId!: number;
}

export interface R2EnrichSingleResponse {
  pgId: number;
  typeId: number;
  featureFlagEnabled: boolean;
  eligibility: {
    score: number;
    verdict: 'eligible' | 'suppressed' | 'reject';
    reason: string;
    subscores: {
      motor: number;
      compat: number;
      commercial: number;
      crawl: number;
    };
    suppressedCanonicalTypeId?: number;
  };
  warning?: string;
  timestamp: string;
}
