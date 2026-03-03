import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type {
  ExtendedGateResult,
  HardGateName,
  EvidenceEntry,
  ClaimEntry,
  RagSafePack,
} from '../../../workers/types/content-refresh.types';

// ── Shared helpers (mirrors brief-gates.service.ts) ──

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Normalize numeric claims for fuzzy matching: strip spaces, normalize decimals. */
function normalizeNumericClaim(claim: string): string {
  return claim
    .replace(/\s/g, '') // "120 000 km" → "120000km"
    .replace(',', '.') // "15,5 mm" → "15.5mm"
    .toLowerCase();
}

const STOP_WORDS_FR = new Set([
  'le',
  'la',
  'les',
  'de',
  'du',
  'des',
  'un',
  'une',
  'et',
  'en',
  'au',
  'aux',
  'ce',
  'ces',
  'son',
  'sa',
  'ses',
  'mon',
  'ma',
  'mes',
  'ton',
  'ta',
  'tes',
  'notre',
  'votre',
  'leur',
  'leurs',
  'que',
  'qui',
  'quoi',
  'dont',
  'dans',
  'sur',
  'sous',
  'avec',
  'sans',
  'pour',
  'par',
  'est',
  'sont',
  'soit',
  'pas',
  'plus',
  'moins',
  'très',
  'bien',
  'aussi',
  'mais',
  'car',
  'donc',
  'puis',
  'comme',
  'cette',
  'cet',
  'elle',
  'elles',
  'nous',
  'vous',
  'ils',
  'eux',
  'tout',
  'tous',
  'toute',
  'toutes',
  'même',
  'autre',
  'autres',
  'être',
  'avoir',
  'fait',
  'faire',
  'peut',
  'entre',
  'après',
  'avant',
  'lors',
  'chez',
  'vers',
  'hors',
  'chaque',
  'encore',
  'ainsi',
  'tant',
  'peu',
]);

/** Extract significant words (>2 chars, no stop words) for phrase-level matching. */
function extractSignificantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS_FR.has(w));
}

// ── Regex for numeric claims ──

const NUMERIC_CLAIM_REGEX =
  /\d+(?:\s\d{3})*(?:[.,]\d+)?\s*(?:mm|cm|km|m|Nm|bar|°C|°F|ans?|%|€|EUR|litres?|kg|g|watts?|W|dB|cv|ch)\b/gi;

// ── Marketing number patterns (excluded from attribution gate) ──

const MARKETING_SENTENCE_PATTERNS = [
  /\blivraison\b/i,
  /\ben stock\b/i,
  /\bpi[eè]ces?\s+(en|disponible)/i,
  /\b24[/-]?48\s*h/i,
  /\bgarantie\b/i,
  /\bsatisf(ait|action)\b/i,
  /\bcommand(e|er|ez)\b/i,
  /\bprix\b/i,
  /\btarif\b/i,
  /\bpromotion\b/i,
  /\bremise\b/i,
  /\bfrais\s+de\s+port/i,
];

// ── Speculative / hedge patterns (for soft hedging gate) ──

const HEDGE_PATTERNS = [
  /\benviron\b/i,
  /\bapproximativement\b/i,
  /\bpeut[- ]être\b/i,
  /\bprobablement\b/i,
  /\ben général\b/i,
  /\bil semble\b/i,
  /\bon estime\b/i,
  /\bsans doute\b/i,
  /\ba priori\b/i,
];

// ── Thresholds (configurable via env in future) ──

const THRESHOLDS = {
  attribution: { warn: 0.15, fail: 0.3 },
  no_guess: { warn: 1, fail: 3 },
  scope_leakage: { warn: 1, fail: 2 },
  contradiction: { warn: 0, fail: 1 }, // strict: any contradiction = FAIL
  seo_integrity: { warn: 0, fail: 1 }, // strict: any mutation = FAIL
  // RAG-specific gates (Chantier 3)
  rag_citation_integrity: { warn: 0, fail: 1 }, // strict: any orphan = FAIL
  rag_role_compliance: { warn: 0, fail: 1 }, // strict: any invalid item = FAIL
  rag_number_sourced: { warn: 0.15, fail: 0.3 }, // fallback for unknown roles
  anti_source: { warn: 1, fail: 1 }, // zero-tolerance: any source tag = FAIL
};

// ── Per-role thresholds for rag_number_sourced (Chantier 3) ──

const RAG_NUMBER_THRESHOLDS: Record<string, { warn: number; fail: number }> = {
  R1_ROUTER: { warn: 0, fail: 0 }, // zero-tolerance: 1 unsourced = FAIL
  R3_GUIDE: { warn: 0.15, fail: 0.3 },
  R3_CONSEILS: { warn: 0.15, fail: 0.3 },
  R4_REFERENCE: { warn: 0.15, fail: 0.3 },
  R5_DIAGNOSTIC: { warn: 0.15, fail: 0.3 },
};

@Injectable()
export class HardGatesService extends SupabaseBaseService {
  protected override readonly logger = new Logger(HardGatesService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  // ── Public API ──

  runAllHardGates(
    content: string,
    evidencePack: EvidenceEntry[] | null,
    allowlist: Set<string>,
    pgAlias: string,
    _pageType: string,
    _pgId: number,
    claims?: ClaimEntry[],
    ragSafePack?: RagSafePack | null,
  ): ExtendedGateResult[] {
    const results: ExtendedGateResult[] = [
      this.checkAttribution(content, evidencePack, claims),
      this.checkNoGuess(content, allowlist),
      this.checkScopeLeakage(content, pgAlias),
      this.checkContradiction(content),
      this.checkSeoIntegrity(content),
    ];

    // Anti-source gate — always runs (zero-tolerance)
    results.push(this.checkAntiSource(content));

    // RAG-specific gates — only run if ragSafePack is provided
    if (ragSafePack) {
      results.push(
        this.checkRagCitationIntegrity(content, ragSafePack),
        this.checkRagRoleCompliance(ragSafePack),
        this.checkRagNumberSourced(content, ragSafePack),
      );
    }

    return results;
  }

  runHardGatesSubset(
    content: string,
    evidencePack: EvidenceEntry[] | null,
    allowlist: Set<string>,
    pgAlias: string,
    _pageType: string,
    _pgId: number,
    gateNames: HardGateName[],
    claims?: ClaimEntry[],
  ): ExtendedGateResult[] {
    const results: ExtendedGateResult[] = [];
    for (const name of gateNames) {
      switch (name) {
        case 'attribution':
          results.push(this.checkAttribution(content, evidencePack, claims));
          break;
        case 'no_guess':
          results.push(this.checkNoGuess(content, allowlist));
          break;
        case 'scope_leakage':
          results.push(this.checkScopeLeakage(content, pgAlias));
          break;
        case 'contradiction':
          results.push(this.checkContradiction(content));
          break;
        case 'seo_integrity':
          results.push(this.checkSeoIntegrity(content));
          break;
        case 'anti_source':
          results.push(this.checkAntiSource(content));
          break;
      }
    }
    return results;
  }

  /** Count hedges (soft gate — returned separately, never blocks alone) */
  countHedges(content: string): { count: number; matches: string[] } {
    const text = stripHtml(content);
    const matches: string[] = [];
    for (const pattern of HEDGE_PATTERNS) {
      const m = text.match(new RegExp(pattern.source, 'gi'));
      if (m) matches.push(...m);
    }
    return { count: matches.length, matches };
  }

  // ── Gate 1: Attribution ──

  checkAttribution(
    content: string,
    evidencePack: EvidenceEntry[] | null,
    claimLedger?: ClaimEntry[],
  ): ExtendedGateResult {
    // Fast path: if claims ledger is available, use it directly (more accurate)
    if (claimLedger && claimLedger.length > 0) {
      return this.checkAttributionFromClaims(claimLedger);
    }

    // Fallback: scan HTML for numeric claims (legacy path)
    return this.checkAttributionFromHtml(content, evidencePack);
  }

  /** Attribution gate using pre-extracted claim ledger (fast, accurate) */
  private checkAttributionFromClaims(
    claimLedger: ClaimEntry[],
  ): ExtendedGateResult {
    const totalClaims = claimLedger.length;
    if (totalClaims === 0) {
      return this.makeResult(
        'attribution',
        'PASS',
        0,
        ['No claims in ledger'],
        THRESHOLDS.attribution,
      );
    }

    const unsourcedClaims = claimLedger.filter(
      (c) => c.status === 'unverified' || c.status === 'blocked',
    );
    const ratio = unsourcedClaims.length / totalClaims;

    const unsourced = unsourcedClaims.map((c) => ({
      location: `${c.sectionKey}:${c.kind}`,
      issue: `Unsourced ${c.kind}: "${c.rawText}" (status=${c.status})`,
    }));

    const { warn, fail } = THRESHOLDS.attribution;
    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (ratio > fail) verdict = 'FAIL';
    else if (ratio > warn) verdict = 'WARN';

    return this.makeResult(
      'attribution',
      verdict,
      ratio,
      [
        `${unsourcedClaims.length}/${totalClaims} claims unsourced (ratio=${ratio.toFixed(2)}, via ledger)`,
      ],
      THRESHOLDS.attribution,
      unsourced,
    );
  }

  /** Attribution gate by scanning HTML for numeric claims (legacy fallback) */
  private checkAttributionFromHtml(
    content: string,
    evidencePack: EvidenceEntry[] | null,
  ): ExtendedGateResult {
    const text = stripHtml(content);
    const allClaims = Array.from(text.matchAll(NUMERIC_CLAIM_REGEX));

    // Filter out claims in marketing sentences (livraison, prix, stock, garantie...)
    const claims = allClaims.filter((claim) => {
      const idx = claim.index ?? 0;
      const sentStart = Math.max(0, text.lastIndexOf('.', idx) + 1);
      const sentEnd = text.indexOf('.', idx + claim[0].length);
      const sentence = text.substring(
        sentStart,
        sentEnd > 0 ? sentEnd : undefined,
      );
      return !MARKETING_SENTENCE_PATTERNS.some((p) => p.test(sentence));
    });

    if (claims.length === 0) {
      return this.makeResult(
        'attribution',
        'PASS',
        0,
        [],
        THRESHOLDS.attribution,
      );
    }

    // Phase 3: penalty when evidence pack is empty but claims exist
    if (!evidencePack || evidencePack.length === 0) {
      return this.makeResult(
        'attribution',
        'WARN',
        1.0,
        [
          `${claims.length} numeric claims found but no evidence pack available`,
        ],
        THRESHOLDS.attribution,
      );
    }

    // Build set of sourced excerpts (Phase 3: normalized matching)
    const sourcedExcerpts = new Set<string>();
    for (const entry of evidencePack) {
      if (entry.rawExcerpt) {
        // Extract numbers from the evidence
        const nums = Array.from(entry.rawExcerpt.matchAll(NUMERIC_CLAIM_REGEX));
        for (const n of nums) sourcedExcerpts.add(normalizeNumericClaim(n[0]));
      }
    }

    const unsourced: Array<{ location: string; issue: string }> = [];
    for (const claim of claims) {
      const normalizedClaim = normalizeNumericClaim(claim[0]);
      if (!sourcedExcerpts.has(normalizedClaim)) {
        // Phase 3: phrase-level fallback — check word overlap with evidence
        const idx = claim.index ?? 0;
        const sentStart = Math.max(0, text.lastIndexOf('.', idx) + 1);
        const sentEnd = text.indexOf('.', idx + claim[0].length);
        const sentence = text
          .substring(sentStart, sentEnd > 0 ? sentEnd : undefined)
          .trim();

        const sentWords = extractSignificantWords(sentence);
        const isPhraseSourced = evidencePack.some((e) => {
          if (!e.rawExcerpt) return false;
          const evidWords = extractSignificantWords(e.rawExcerpt);
          const overlap = sentWords.filter((w) => evidWords.includes(w));
          return overlap.length >= 3;
        });

        if (!isPhraseSourced) {
          unsourced.push({
            location: `char:${idx}`,
            issue: `Unsourced claim: "${normalizedClaim}" in "${sentence.substring(0, 80)}..."`,
          });
        }
      }
    }

    const ratio = unsourced.length / claims.length;
    const { warn, fail } = THRESHOLDS.attribution;
    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (ratio > fail) verdict = 'FAIL';
    else if (ratio > warn) verdict = 'WARN';

    return this.makeResult(
      'attribution',
      verdict,
      ratio,
      [
        `${unsourced.length}/${claims.length} claims unsourced (ratio=${ratio.toFixed(2)})`,
      ],
      THRESHOLDS.attribution,
      unsourced,
    );
  }

  // ── Gate 2: No-Guess (novel technical terms) ──

  checkNoGuess(content: string, allowlist: Set<string>): ExtendedGateResult {
    const text = normalizeAccents(stripHtml(content).toLowerCase());
    const words = text
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9àâäéèêëîïôùûüç-]/g, ''))
      .filter((w) => w.length > 4 && !STOP_WORDS_FR.has(w));

    // Unique words in content
    const contentTerms = new Set(words);

    // Normalize allowlist for comparison
    const normalizedAllowlist = new Set<string>();
    for (const t of allowlist) {
      normalizedAllowlist.add(normalizeAccents(t.toLowerCase()));
    }

    // Find novel terms (in content but not in allowlist)
    const novelTerms: Array<{ location: string; issue: string }> = [];
    for (const term of contentTerms) {
      if (!normalizedAllowlist.has(term)) {
        // Only flag terms that look technical (contains digits, hyphens, or are long)
        const isTechnical =
          /\d/.test(term) || term.includes('-') || term.length > 8;
        if (isTechnical) {
          novelTerms.push({
            location: `term:${term}`,
            issue: term,
          });
        }
      }
    }

    const count = novelTerms.length;
    const { warn, fail } = THRESHOLDS.no_guess;
    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (count > fail) verdict = 'FAIL';
    else if (count > warn) verdict = 'WARN';

    return this.makeResult(
      'no_guess',
      verdict,
      count,
      [
        `${count} novel technical terms: ${novelTerms
          .slice(0, 10)
          .map((t) => t.issue)
          .join(', ')}`,
      ],
      THRESHOLDS.no_guess,
      novelTerms,
    );
  }

  // ── Gate 3: Scope Leakage ──

  checkScopeLeakage(content: string, pgAlias: string): ExtendedGateResult {
    // This gate needs the list of other gamme names.
    // In the processor, we'll pass other gamme names loaded from DB.
    // For now, we detect cross-gamme references by pattern.
    const text = stripHtml(content);
    const sentences = this.splitSentences(text);
    const targetGamme = pgAlias.replace(/-/g, ' ').toLowerCase();

    const leaks: Array<{ location: string; issue: string }> = [];
    let sentIdx = 0;

    for (const sentence of sentences) {
      sentIdx++;
      const lower = sentence.toLowerCase();

      // Skip sentences with link markers (CTA — explicitly excluded)
      if (sentence.includes('#LinkGamme_')) continue;

      // Skip short contextual references (< 15 words)
      const wordCount = sentence.split(/\s+/).length;
      if (wordCount < 15) continue;

      // Check for other gamme-like patterns with technical payload
      // Technical payload = contains numbers + units
      const hasNumericClaim = NUMERIC_CLAIM_REGEX.test(sentence);
      NUMERIC_CLAIM_REGEX.lastIndex = 0; // reset regex state

      if (!hasNumericClaim) continue;

      // Check if sentence mentions a gamme other than target
      // (heuristic: mentions a specific part name that doesn't match our gamme)
      // This will be refined when we have the actual gamme list from the processor
      const hasProcedure =
        /\b(étape|démonter|déposer|remonter|remplacer)\b/i.test(sentence);

      if (hasProcedure && !lower.includes(targetGamme)) {
        leaks.push({
          location: `sentence:${sentIdx}`,
          issue: `Technical procedure with numbers for non-target gamme: "${sentence.substring(0, 80)}..."`,
        });
      }
    }

    const count = leaks.length;
    const { warn, fail } = THRESHOLDS.scope_leakage;
    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (count >= fail) verdict = 'FAIL';
    else if (count >= warn) verdict = 'WARN';

    return this.makeResult(
      'scope_leakage',
      verdict,
      count,
      [`${count} leaking sentences with technical payload`],
      THRESHOLDS.scope_leakage,
      leaks,
    );
  }

  // ── Gate 4: Contradiction (STRICT) ──

  checkContradiction(content: string): ExtendedGateResult {
    const text = stripHtml(content);
    const sentences = this.splitSentences(text);

    // Extract sentences with numeric claims
    const claimSentences: Array<{
      idx: number;
      sentence: string;
      claims: string[];
      terms: string[];
    }> = [];

    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      const claims = Array.from(s.matchAll(NUMERIC_CLAIM_REGEX)).map(
        (m) => m[0],
      );
      NUMERIC_CLAIM_REGEX.lastIndex = 0;
      if (claims.length === 0) continue;

      const terms = normalizeAccents(s.toLowerCase())
        .split(/\s+/)
        .filter((w) => w.length > 4 && !STOP_WORDS_FR.has(w));

      claimSentences.push({ idx: i, sentence: s, claims, terms });
    }

    // Compare pairs of claim-bearing sentences
    const contradictions: Array<{ location: string; issue: string }> = [];

    for (let i = 0; i < claimSentences.length; i++) {
      for (let j = i + 1; j < claimSentences.length; j++) {
        const a = claimSentences[i];
        const b = claimSentences[j];

        // Need >= 2 shared significant terms
        const sharedTerms = a.terms.filter((t) => b.terms.includes(t));
        if (sharedTerms.length < 2) continue;

        // Check if numeric claims differ
        // Extract just the numbers
        const numsA = a.claims.map((c) =>
          parseFloat(c.replace(/[^\d.,]/g, '').replace(',', '.')),
        );
        const numsB = b.claims.map((c) =>
          parseFloat(c.replace(/[^\d.,]/g, '').replace(',', '.')),
        );

        // If same unit type but different values = contradiction
        for (const na of numsA) {
          for (const nb of numsB) {
            if (isNaN(na) || isNaN(nb)) continue;
            if (na !== nb && Math.abs(na - nb) / Math.max(na, nb) > 0.1) {
              contradictions.push({
                location: `sentences:${a.idx + 1}+${b.idx + 1}`,
                issue: `"${a.sentence.substring(0, 60)}..." vs "${b.sentence.substring(0, 60)}..." — shared: [${sharedTerms.slice(0, 3).join(', ')}]`,
              });
            }
          }
        }
      }
    }

    const count = contradictions.length;
    const { warn, fail } = THRESHOLDS.contradiction;
    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (count >= fail) verdict = 'FAIL';
    else if (count > warn) verdict = 'WARN';

    return this.makeResult(
      'contradiction',
      verdict,
      count,
      [count > 0 ? `${count} contradictions detected` : 'No contradictions'],
      THRESHOLDS.contradiction,
      contradictions,
    );
  }

  // ── Gate 5: SEO Integrity (STRICT) ──

  checkSeoIntegrity(content: string): ExtendedGateResult {
    const issues: Array<{ location: string; issue: string }> = [];

    // Check H2 count
    const h2Count = (content.match(/<h2[\s>]/gi) || []).length;
    if (h2Count < 2) {
      issues.push({
        location: 'structure:h2',
        issue: `Only ${h2Count} H2 tags (minimum 2 required)`,
      });
    }

    // Check content length
    const textLength = stripHtml(content).length;
    if (textLength < 200) {
      issues.push({
        location: 'structure:length',
        issue: `Content too short: ${textLength} chars (minimum 200)`,
      });
    }

    // Note: Protected field md5 checks happen in the processor (needs DB access)
    // This gate covers structural checks. The processor adds field-mutation checks.

    const count = issues.length;
    const { warn, fail } = THRESHOLDS.seo_integrity;
    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (count >= fail) verdict = 'FAIL';
    else if (count > warn) verdict = 'WARN';

    return this.makeResult(
      'seo_integrity',
      verdict,
      count,
      [count > 0 ? issues.map((i) => i.issue).join('; ') : 'Structure OK'],
      THRESHOLDS.seo_integrity,
      issues,
    );
  }

  // ── Gate 6: RAG Citation Integrity (STRICT) ──

  private checkRagCitationIntegrity(
    content: string,
    ragSafePack: RagSafePack,
  ): ExtendedGateResult {
    const text = stripHtml(content);

    // Extract source_id references from content
    // Patterns: [source:xxx] or data-source-id="xxx"
    const sourceRefPattern = /\[source:([^\]]+)\]|data-source-id="([^"]+)"/gi;
    const referencedIds: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = sourceRefPattern.exec(text)) !== null) {
      referencedIds.push(match[1] ?? match[2]);
    }

    // If no source references in content, PASS (nothing to check)
    if (referencedIds.length === 0) {
      return this.makeResult(
        'rag_citation_integrity',
        'PASS',
        0,
        ['No source references in content'],
        THRESHOLDS.rag_citation_integrity,
      );
    }

    // Build set of valid source_ids from citations_used
    const validIds = new Set(
      ragSafePack.citations_used.map((c) => c.source_id),
    );

    // Find orphan references (in content but not in pack)
    const orphans: Array<{ location: string; issue: string }> = [];
    for (const refId of referencedIds) {
      if (!validIds.has(refId)) {
        orphans.push({
          location: `source_ref:${refId}`,
          issue: `Orphan source reference: "${refId}" not in RAG safe pack`,
        });
      }
    }

    const count = orphans.length;
    const { warn, fail } = THRESHOLDS.rag_citation_integrity;
    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (count >= fail) verdict = 'FAIL';
    else if (count > warn) verdict = 'WARN';

    return this.makeResult(
      'rag_citation_integrity',
      verdict,
      count,
      [
        count > 0
          ? `${count} orphan source refs (not in RAG pack)`
          : 'All source refs valid',
      ],
      THRESHOLDS.rag_citation_integrity,
      orphans,
    );
  }

  // ── Gate 7: RAG Role Compliance ──

  private checkRagRoleCompliance(ragSafePack: RagSafePack): ExtendedGateResult {
    const buckets = [
      'definitions',
      'selection_checks',
      'trust_proofs',
      'support_notes',
      'faq_pairs',
      'procedures',
      'spec_refs',
      'confusions',
      'anti_claims',
    ] as const;

    const invalid: Array<{ location: string; issue: string }> = [];

    for (const bucket of buckets) {
      for (let i = 0; i < ragSafePack[bucket].length; i++) {
        const item = ragSafePack[bucket][i];
        if (!item.source_id || item.source_id === 'unknown') {
          invalid.push({
            location: `${bucket}[${i}]`,
            issue: `Item in ${bucket} has invalid source_id: "${item.source_id ?? ''}"`,
          });
        }
      }
    }

    const count = invalid.length;
    const { warn, fail } = THRESHOLDS.rag_role_compliance;
    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (count >= fail) verdict = 'FAIL';
    else if (count > warn) verdict = 'WARN';

    return this.makeResult(
      'rag_role_compliance',
      verdict,
      count,
      [
        count > 0
          ? `${count} items with invalid source_id in RAG pack`
          : 'All RAG pack items have valid source_ids',
      ],
      THRESHOLDS.rag_role_compliance,
      invalid,
    );
  }

  // ── Gate 8: RAG Number Sourced ──

  private checkRagNumberSourced(
    content: string,
    ragSafePack: RagSafePack,
  ): ExtendedGateResult {
    const text = stripHtml(content);
    const roleId = ragSafePack.roleId ?? '';
    const roleThresholds =
      RAG_NUMBER_THRESHOLDS[roleId] ?? THRESHOLDS.rag_number_sourced;

    // Extract numeric claims from content (reuse existing regex)
    const allClaims = Array.from(text.matchAll(NUMERIC_CLAIM_REGEX));
    NUMERIC_CLAIM_REGEX.lastIndex = 0;

    // Filter out marketing sentences (same logic as checkAttribution)
    const claims = allClaims.filter((claim) => {
      const idx = claim.index ?? 0;
      const sentStart = Math.max(0, text.lastIndexOf('.', idx) + 1);
      const sentEnd = text.indexOf('.', idx + claim[0].length);
      const sentence = text.substring(
        sentStart,
        sentEnd > 0 ? sentEnd : undefined,
      );
      return !MARKETING_SENTENCE_PATTERNS.some((p) => p.test(sentence));
    });

    if (claims.length === 0) {
      return this.makeResult(
        'rag_number_sourced',
        'PASS',
        0,
        ['No numeric claims in content'],
        roleThresholds,
      );
    }

    // Build a combined text from all citations for matching
    const citationTexts = ragSafePack.citations_used.map((c) =>
      c.text.toLowerCase(),
    );

    // Check each claim against citations
    const unsourced: Array<{ location: string; issue: string }> = [];
    for (const claim of claims) {
      const normalizedClaim = normalizeNumericClaim(claim[0]);
      const rawNumber = claim[0].replace(/[^\d.,]/g, '').replace(',', '.');

      // Check if this number appears in any citation text
      const isSourced = citationTexts.some(
        (ct) =>
          ct.includes(rawNumber) || ct.includes(normalizedClaim.toLowerCase()),
      );

      if (!isSourced) {
        unsourced.push({
          location: `char:${claim.index ?? 0}`,
          issue: `Unsourced number: "${claim[0]}" not found in RAG citations`,
        });
      }
    }

    const ratio = unsourced.length / claims.length;
    const { warn, fail } = roleThresholds;
    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (ratio > fail) verdict = 'FAIL';
    else if (ratio > warn) verdict = 'WARN';

    return this.makeResult(
      'rag_number_sourced',
      verdict,
      ratio,
      [
        `${unsourced.length}/${claims.length} numbers unsourced in RAG pack (ratio=${ratio.toFixed(2)}, role=${roleId}, thresholds=${warn}/${fail})`,
      ],
      roleThresholds,
      unsourced,
    );
  }

  // ── Gate 9: Anti-Source (zero-tolerance) ──

  checkAntiSource(content: string): ExtendedGateResult {
    const text = stripHtml(content);
    const issues: Array<{ location: string; issue: string }> = [];

    // Patterns that indicate leaked source attributions
    const patterns: Array<{ regex: RegExp; label: string }> = [
      { regex: /\(Source\s*:\s*[^)]+\)/gi, label: 'Source attribution' },
      { regex: /\(BT-\d+[^)]*\)/gi, label: 'BT reference in parens' },
      { regex: /\(SR\d+[^)]*\)/gi, label: 'SR reference in parens' },
      { regex: /\bBT-\d+\b/gi, label: 'Standalone BT reference' },
      { regex: /\bSR\d{4,}\b/gi, label: 'Standalone SR reference' },
    ];

    for (const { regex, label } of patterns) {
      const matches = Array.from(text.matchAll(regex));
      for (const m of matches) {
        issues.push({
          location: `char:${m.index ?? 0}`,
          issue: `${label}: "${m[0]}"`,
        });
      }
    }

    const count = issues.length;
    const { warn, fail } = THRESHOLDS.anti_source;
    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (count >= fail) verdict = 'FAIL';
    else if (count >= warn) verdict = 'WARN';

    return this.makeResult(
      'anti_source',
      verdict,
      count,
      [
        count > 0
          ? `${count} source attribution(s) leaked into published content`
          : 'No source tags detected',
      ],
      THRESHOLDS.anti_source,
      issues.slice(0, 10),
    );
  }

  // ── Helpers ──

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }

  private makeResult(
    gate: HardGateName,
    verdict: ExtendedGateResult['verdict'],
    measured: number,
    details: string[],
    thresholds: { warn: number; fail: number },
    triggerItems?: Array<{
      location: string;
      issue: string;
      evidenceRef?: string;
    }>,
  ): ExtendedGateResult {
    return {
      gate,
      verdict,
      details,
      measured,
      warnThreshold: thresholds.warn,
      failThreshold: thresholds.fail,
      ...(triggerItems && triggerItems.length > 0 ? { triggerItems } : {}),
    };
  }
}
