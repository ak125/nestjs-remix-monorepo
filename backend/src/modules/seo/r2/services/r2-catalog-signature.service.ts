/**
 * ADR-066 — R2 Catalog Signature Service
 *
 * Pure function service computing the `catalog_signature` SHA-256 hex for a
 * given (pg_id, type_id) pair. Used as **structural early-gate** in Gate 3
 * (R2DiversityService) — overlap > 0.92 → SUPPRESSED si sibling INDEX fiable,
 * REJECT sinon (canonical-first, cf MEMORY feedback_seo_catalog_signature_before_text_diversity).
 *
 * Inputs collected by R2DataLoaderService (PR 2 V1.5 — for now caller provides
 * normalized OEM refs + subgroups + family_counts directly).
 *
 * Pure : no I/O, deterministic, fast (~0ms hash compare).
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface CatalogInputs {
  topOemRefs: string[]; // top-30 OEM refs (string list)
  subgroupKeys: string[]; // catalogue subgroup keys
  productFamilyCounts: Record<string, number>; // family → count map
}

export interface CatalogSignatureResult {
  signature: string; // sha256 hex 64 chars
  sortedOemRefs: string[];
  sortedSubgroups: string[];
  productFamilyCounts: Record<string, number>;
}

@Injectable()
export class R2CatalogSignatureService {
  private readonly logger = new Logger(R2CatalogSignatureService.name);

  /**
   * Compute the catalog signature : sha256(sorted_oem + sorted_subgroups + family_counts).
   *
   * Deterministic ordering : sort OEM refs and subgroups lexicographically
   * before concatenation. family_counts serialized via JSON.stringify with
   * sorted keys (we sort keys here for determinism).
   *
   * Cf MEMORY feedback_deterministic_input_hash_canonical_json — sortir les
   * clés évite le bug "même input logique → hashes différents".
   */
  compute(inputs: CatalogInputs): CatalogSignatureResult {
    const sortedOemRefs = [...inputs.topOemRefs]
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .sort();

    const sortedSubgroups = [...inputs.subgroupKeys]
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .sort();

    // Sort family_counts keys for deterministic serialization.
    const familyEntries = Object.entries(inputs.productFamilyCounts).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    const sortedFamilyCounts = Object.fromEntries(familyEntries);

    const payload = JSON.stringify({
      oem: sortedOemRefs,
      sub: sortedSubgroups,
      fam: sortedFamilyCounts,
    });

    const signature = createHash('sha256').update(payload).digest('hex');

    return {
      signature,
      sortedOemRefs,
      sortedSubgroups,
      productFamilyCounts: sortedFamilyCounts,
    };
  }

  /**
   * Compute Jaccard similarity between two catalog signatures' OEM ref sets.
   *
   * Returns a value in [0, 1]. Used by R2DiversityService :
   *   - > 0.92 → SUPPRESSED si sibling INDEX fiable, REJECT sinon
   *   - ≤ 0.92 → continue pipeline (LSH MinHash bands next)
   */
  jaccardOverlap(a: CatalogSignatureResult, b: CatalogSignatureResult): number {
    const setA = new Set(a.sortedOemRefs);
    const setB = new Set(b.sortedOemRefs);

    if (setA.size === 0 && setB.size === 0) return 0;

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }
}
