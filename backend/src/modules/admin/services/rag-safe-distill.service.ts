import { Injectable, Logger } from '@nestjs/common';
import { RagProxyService } from '../../rag-proxy/rag-proxy.service';
import type { SearchResultDto } from '../../rag-proxy/dto/search.dto';
import type {
  RagSafePack,
  RagSafeItem,
} from '../../../workers/types/content-refresh.types';

// ── Purity thresholds per role (from role_map_defaults.json) ──

const PURITY_THRESHOLDS: Record<string, number> = {
  R1_ROUTER: 80,
  R2_PRODUCT: 90,
  R3_GUIDE: 70,
  R3_CONSEILS: 70,
  R4_REFERENCE: 85,
  R5_DIAGNOSTIC: 80,
  R6_SUPPORT: 90,
};

// ── Per-role bucket limits (aligned with retrieval_recipes quotas) ──

const ROLE_BUCKET_LIMITS: Record<string, Record<string, number>> = {
  R1_ROUTER: {
    definitions: 2,
    selection_checks: 2,
    support_notes: 1,
    trust_proofs: 1,
  },
  R3_GUIDE: {
    definitions: 1,
    selection_checks: 3,
    faq_pairs: 2,
    trust_proofs: 1,
  },
  R4_REFERENCE: {
    definitions: 2,
    faq_pairs: 2,
    spec_refs: 1,
    confusions: 1,
    anti_claims: 1,
  },
  R5_DIAGNOSTIC: {
    definitions: 1,
    procedures: 2,
    faq_pairs: 1,
    trust_proofs: 1,
  },
  R3_CONSEILS: { procedures: 3, definitions: 1, faq_pairs: 1, trust_proofs: 1 },
};

// ── Contamination flags forbidden per role ──

const FORBIDDEN_FLAGS: Record<string, string[]> = {
  R1_ROUTER: [
    'HAS_HOWTO_MARKERS',
    'HAS_DIAG_MARKERS',
    'TABLE_HAS_IMPERATIVES',
    'TABLE_HAS_STEP_SEQUENCE',
  ],
  R3_GUIDE: ['HAS_DIAG_MARKERS'],
  R3_CONSEILS: [],
  R4_REFERENCE: ['HAS_HOWTO_MARKERS', 'HAS_PRICE_PUSH'],
  R5_DIAGNOSTIC: [],
  R6_SUPPORT: ['HAS_HOWTO_MARKERS', 'HAS_DIAG_MARKERS'],
};

// ── chunk_kind → bucket mapping ──

const KIND_TO_BUCKET: Record<string, string> = {
  definition: 'definitions',
  selection_checks: 'selection_checks',
  trust: 'trust_proofs',
  support: 'support_notes',
  faq: 'faq_pairs',
  procedure: 'procedures',
  table_rows: 'spec_refs',
};

// ── RoleId → search DTO target_role mapping (DTO enum: R1_ROUTER | R3_GUIDE | R4_REFERENCE | R5_DIAGNOSTIC) ──

const ROLE_TO_SEARCH_TARGET: Record<string, string> = {
  R1_ROUTER: 'R1_ROUTER',
  R3_GUIDE: 'R3_GUIDE',
  R3_CONSEILS: 'R3_GUIDE',
  R4_REFERENCE: 'R4_REFERENCE',
  R5_DIAGNOSTIC: 'R5_DIAGNOSTIC',
};

// ── Safety strip patterns (sentences containing these are removed) ──

const SAFETY_PATTERNS: RegExp[] = [
  /\b(installer|monter|d[ée]monter|d[ée]poser|remonter)\b/i,
  /\b(sympt[oô]me|panne|diagnostic)\b/i,
  /(renault|peugeot|citro[eë]n|volkswagen|bmw|audi|mercedes|ford|opel|toyota)\s+(clio|megane|208|308|c3|c4|golf|polo|serie|classe|focus|fiesta|corsa|yaris)/i,
  /\b(prix|tarif|€|EUR|pas cher|meilleur prix|promotion)\b/i,
  /\b(toujours|jamais|z[ée]ro|aucun(?:e)?)\s+(?:panne|probl[eè]me|risque|d[ée]faut|usure)\b/i,
];

@Injectable()
export class RagSafeDistillService {
  private readonly logger = new Logger(RagSafeDistillService.name);

  constructor(private readonly ragProxyService: RagProxyService) {}

  /**
   * Distill RAG chunks into a safe, role-filtered pack.
   *
   * 0-LLM, fully heuristic. Steps:
   * 1. Search RAG for chunks related to pgAlias
   * 2. Filter by allowed_roles, purity_score, forbidden contamination flags
   * 3. Sort by composite score (search score × purity)
   * 4. Distribute into role-specific buckets by chunk_kind
   * 5. Extract 1 neutral sentence per chunk, apply safety strip
   * 6. Assemble citations
   */
  async distill(pgAlias: string, targetRole: string): Promise<RagSafePack> {
    const empty: RagSafePack = {
      roleId: targetRole,
      definitions: [],
      selection_checks: [],
      trust_proofs: [],
      support_notes: [],
      faq_pairs: [],
      procedures: [],
      spec_refs: [],
      confusions: [],
      anti_claims: [],
      citations_used: [],
    };

    // Step 1: Search RAG
    const query = pgAlias
      .replace(/-/g, ' ')
      .replace(/ d /g, " d'")
      .replace(/ l /g, " l'");

    let results: SearchResultDto[] = [];
    try {
      const searchTargetRole = ROLE_TO_SEARCH_TARGET[targetRole];
      const searchResponse = await this.ragProxyService.search({
        query,
        limit: 20,
        filters: { truth_levels: ['L1', 'L2'] },
        ...(searchTargetRole && { routing: { target_role: searchTargetRole } }),
      });
      results = searchResponse?.results ?? [];
    } catch (err) {
      this.logger.warn(
        `RAG search failed for distill (${pgAlias}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return empty;
    }

    if (results.length === 0) return empty;

    // Step 2: Filter chunks
    const purityThreshold = PURITY_THRESHOLDS[targetRole] ?? 70;
    const forbidden = FORBIDDEN_FLAGS[targetRole] ?? [];

    const filtered = results.filter((chunk) => {
      // Must have allowed_roles containing target role
      const allowedRoles = chunk.allowed_roles ?? [];
      if (allowedRoles.length > 0 && !allowedRoles.includes(targetRole)) {
        return false;
      }

      // Purity must be above threshold
      const purity = chunk.purity_score ?? 100;
      if (purity < purityThreshold) {
        return false;
      }

      // No forbidden contamination flags
      const flags = chunk.contamination_flags ?? [];
      if (forbidden.length > 0 && flags.some((f) => forbidden.includes(f))) {
        return false;
      }

      return true;
    });

    this.logger.debug(
      `Distill ${pgAlias} (${targetRole}): ${results.length} raw → ${filtered.length} after filter`,
    );

    // Step 3: Sort by composite score (search score × purity/100)
    const sorted = filtered.sort((a, b) => {
      const scoreA = (a.score ?? 0) * ((a.purity_score ?? 100) / 100);
      const scoreB = (b.score ?? 0) * ((b.purity_score ?? 100) / 100);
      return scoreB - scoreA;
    });

    // Step 4: Distribute into role-specific buckets by chunk_kind
    const pack: RagSafePack = { ...empty };
    const roleLimits = ROLE_BUCKET_LIMITS[targetRole] ?? {};

    for (const chunk of sorted) {
      const kind = chunk.chunk_kind ?? 'other';
      const bucket = KIND_TO_BUCKET[kind];
      if (!bucket) continue; // chunk_kind=other → skip

      const maxForRole = roleLimits[bucket] ?? 0; // bucket absent from role → 0 = skip
      const arr = pack[bucket as keyof RagSafePack] as
        | RagSafeItem[]
        | undefined;
      if (!arr || arr.length >= maxForRole) continue;

      // Step 5: Extract neutral sentence + safety strip
      const safeText = this.extractSafeSentence(chunk.content);
      if (!safeText) continue;

      const item: RagSafeItem = {
        text: safeText,
        source_id: chunk.chunk_id ?? chunk.sourcePath ?? 'unknown',
      };

      arr.push(item);
      pack.citations_used.push(item);
    }

    const bucketSummary = Object.entries(roleLimits)
      .map(
        ([k]) =>
          `${k}=${(pack[k as keyof RagSafePack] as RagSafeItem[] | undefined)?.length ?? 0}`,
      )
      .join(' ');
    this.logger.log(
      `Distill ${pgAlias} (${targetRole}): ${pack.citations_used.length} citations (${bucketSummary})`,
    );

    return pack;
  }

  /**
   * Extract the first neutral sentence from chunk content.
   * Splits by sentence boundaries, strips unsafe sentences, returns the first safe one.
   */
  private extractSafeSentence(content: string): string | null {
    // Split into sentences (French: period/exclamation/question + space or end)
    const sentences = content
      .replace(/\n+/g, '. ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 300);

    for (const sentence of sentences) {
      if (this.isSafe(sentence)) {
        return sentence;
      }
    }

    return null;
  }

  /**
   * Check if a sentence passes all safety patterns.
   */
  private isSafe(sentence: string): boolean {
    return !SAFETY_PATTERNS.some((pattern) => pattern.test(sentence));
  }
}
