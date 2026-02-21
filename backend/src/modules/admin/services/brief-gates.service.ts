import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { PageBriefService, type PageBrief } from './page-brief.service';

// ── Types ──

export interface GateResult {
  gate:
    | 'role_compliance'
    | 'forbidden_overlap'
    | 'semantic_similarity'
    | 'intent_coverage';
  verdict: 'PASS' | 'WARN' | 'FAIL';
  details: string[];
}

export interface PrePublishGateOutput {
  canPublish: boolean;
  gates: GateResult[];
  flags: string[];
  briefId: number | null;
  briefVersion: number | null;
}

// ── Mapping page type → brief role ──

const PAGE_TYPE_TO_BRIEF_ROLE: Record<string, string> = {
  R1_pieces: 'R1',
  R3_guide_achat: 'R3_guide',
  R3_conseils: 'R3_conseils',
  R4_reference: 'R4',
};

// ── Role compliance patterns ──

interface ForbiddenPattern {
  regex: RegExp;
  reason: string;
}

const ROLE_FORBIDDEN_PATTERNS: Record<string, ForbiddenPattern[]> = {
  R1: [
    { regex: /étape\s+[0-9]/i, reason: 'Procedure = R3' },
    { regex: /étape\s+(un|deux|trois|quatre|cinq)/i, reason: 'Procedure = R3' },
    { regex: /outils?\s+nécessaires?/i, reason: 'Procedure = R3' },
    { regex: /couple\s+de\s+serrage/i, reason: 'Procedure = R3' },
    {
      regex: /\b(démonter|déposer|reposer|remonter)\b/i,
      reason: 'Procedure = R3',
    },
    {
      regex: /\b(tutoriel|tuto|pas[\s-]à[\s-]pas)\b/i,
      reason: 'Procedure = R3',
    },
    {
      regex: /\b(définition|glossaire|encyclopédie)\b/i,
      reason: 'Reference = R4',
    },
  ],
  R3_guide: [
    { regex: /ajouter\s+au\s+panier/i, reason: 'Transactionnel = R1' },
    { regex: /\b(commander|achetez)\b/i, reason: 'Transactionnel = R1' },
    { regex: /€\s*[0-9]/i, reason: 'Transactionnel = R1' },
    { regex: /prix\s+à\s+partir/i, reason: 'Transactionnel = R1' },
    { regex: /\b(tarif|promotion)\b/i, reason: 'Transactionnel = R1' },
    {
      regex: /\b(définition|glossaire|encyclopédie)\b/i,
      reason: 'Reference = R4',
    },
  ],
  R3_conseils: [
    { regex: /ajouter\s+au\s+panier/i, reason: 'Transactionnel = R1' },
    { regex: /\b(commander|achetez)\b/i, reason: 'Transactionnel = R1' },
    { regex: /€\s*[0-9]/i, reason: 'Transactionnel = R1' },
    { regex: /prix\s+à\s+partir/i, reason: 'Transactionnel = R1' },
    { regex: /\b(tarif|promotion)\b/i, reason: 'Transactionnel = R1' },
    {
      regex: /\b(définition|glossaire|encyclopédie)\b/i,
      reason: 'Reference = R4',
    },
  ],
  R4: [
    { regex: /étape\s+[0-9]/i, reason: 'Procedure = R3' },
    { regex: /\b(pas[\s-]à[\s-]pas)\b/i, reason: 'Procedure = R3' },
    {
      regex: /\b(tutoriel|tuto|comment\s+remplacer)\b/i,
      reason: 'Procedure = R3',
    },
    { regex: /ajouter\s+au\s+panier/i, reason: 'Transactionnel = R1' },
    { regex: /\b(achetez|commander)\b/i, reason: 'Transactionnel = R1' },
    { regex: /€\s*[0-9]/i, reason: 'Transactionnel = R1' },
    { regex: /\b(prix|tarif|promotion)\b/i, reason: 'Transactionnel = R1' },
    {
      regex: /compatible\s+avec\s+votre\s+véhicule/i,
      reason: 'Transactionnel = R1',
    },
  ],
};

// ── Stop words FR (for TF-IDF and intent coverage) ──

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

// ── Helpers ──

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Service ──

@Injectable()
export class BriefGatesService extends SupabaseBaseService {
  protected override readonly logger = new Logger(BriefGatesService.name);

  constructor(
    configService: ConfigService,
    @Optional() private readonly pageBriefService?: PageBriefService,
  ) {
    super(configService);
  }

  /**
   * Run all 4 pre-publish gates for a given content.
   * If no brief is active → skip all gates (canPublish = true).
   */
  async runPrePublishGates(
    pgId: number,
    pgAlias: string,
    pageType: string,
    content: string,
  ): Promise<PrePublishGateOutput> {
    const role = PAGE_TYPE_TO_BRIEF_ROLE[pageType];
    if (!role || !this.pageBriefService) {
      return {
        canPublish: true,
        gates: [],
        flags: [],
        briefId: null,
        briefVersion: null,
      };
    }

    const brief = await this.pageBriefService.getActiveBrief(pgId, role);
    if (!brief) {
      return {
        canPublish: true,
        gates: [],
        flags: [],
        briefId: null,
        briefVersion: null,
      };
    }

    const gates: GateResult[] = [];
    const flags: string[] = [];

    // Gate A: Role Compliance
    gates.push(this.checkRoleCompliance(content, role));

    // Gate B: Forbidden Overlap
    gates.push(this.checkForbiddenOverlap(content, brief));

    // Gate C: Semantic Similarity (async — reads other roles from DB)
    gates.push(await this.checkSemanticSimilarity(pgId, pageType, content));

    // Gate D: Intent Coverage
    gates.push(this.checkIntentCoverage(content, brief));

    const hasFail = gates.some((g) => g.verdict === 'FAIL');

    for (const g of gates) {
      if (g.verdict === 'FAIL') flags.push(`GATE_${g.gate.toUpperCase()}_FAIL`);
      if (g.verdict === 'WARN') flags.push(`GATE_${g.gate.toUpperCase()}_WARN`);
    }

    this.logger.log(
      JSON.stringify({
        event: 'pre_publish_gates',
        pgAlias,
        pageType,
        briefId: brief.id,
        gates: gates.map((g) => ({ gate: g.gate, verdict: g.verdict })),
        canPublish: !hasFail,
      }),
    );

    return {
      canPublish: !hasFail,
      gates,
      flags,
      briefId: brief.id,
      briefVersion: brief.version,
    };
  }

  // ── Gate A: Role Compliance ──

  checkRoleCompliance(content: string, role: string): GateResult {
    const patterns = ROLE_FORBIDDEN_PATTERNS[role] ?? [];
    const text = stripHtml(content);
    const hits: string[] = [];

    for (const p of patterns) {
      if (p.regex.test(text)) {
        hits.push(`${p.regex.source} (${p.reason})`);
      }
    }

    let verdict: GateResult['verdict'] = 'PASS';
    if (hits.length >= 3) verdict = 'FAIL';
    else if (hits.length >= 1) verdict = 'WARN';

    return { gate: 'role_compliance', verdict, details: hits };
  }

  // ── Gate B: Forbidden Overlap ──

  checkForbiddenOverlap(content: string, brief: PageBrief): GateResult {
    const normalized = normalizeAccents(stripHtml(content).toLowerCase());
    const hits: string[] = [];

    for (const forbidden of brief.forbidden_overlap) {
      const pattern = normalizeAccents(forbidden.toLowerCase());
      // Use word boundary matching to avoid partial matches (e.g. "batterie" in "unbatterie")
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(normalized)) {
        hits.push(forbidden);
      }
    }

    let verdict: GateResult['verdict'] = 'PASS';
    if (hits.length >= 2) verdict = 'FAIL';
    else if (hits.length === 1) verdict = 'WARN';

    return { gate: 'forbidden_overlap', verdict, details: hits };
  }

  // ── Gate C: Semantic Similarity (TF-IDF local) ──

  async checkSemanticSimilarity(
    pgId: number,
    pageType: string,
    content: string,
  ): Promise<GateResult> {
    // Load recent content from other roles for the same gamme
    const { data: otherContents } = await this.client
      .from('__rag_content_refresh_log')
      .select('page_type, content_fingerprint')
      .eq('pg_id', pgId)
      .neq('page_type', pageType)
      .in('status', ['draft', 'auto_published', 'published'])
      .not('content_fingerprint', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!otherContents?.length) {
      return {
        gate: 'semantic_similarity',
        verdict: 'PASS',
        details: ['No other roles to compare'],
      };
    }

    const currentFp = this.computeContentFingerprint(content);
    const hits: string[] = [];

    // Similarity thresholds per pair
    const thresholds: Record<string, { warn: number; fail: number }> = {
      'R1↔R3': { warn: 0.75, fail: 0.85 },
      'R1↔R4': { warn: 0.6, fail: 0.75 },
      'R3↔R4': { warn: 0.65, fail: 0.8 },
    };

    let maxSimilarity = 0;
    let worstVerdict: GateResult['verdict'] = 'PASS';

    for (const other of otherContents) {
      const otherFp = other.content_fingerprint as Record<
        string,
        number
      > | null;
      if (!otherFp) continue;

      const similarity = this.cosineSimilarity(currentFp, otherFp);
      const pairKey = this.getPairKey(pageType, other.page_type);
      const threshold = thresholds[pairKey] ?? { warn: 0.75, fail: 0.85 };

      if (similarity > maxSimilarity) maxSimilarity = similarity;

      if (similarity >= threshold.fail) {
        hits.push(
          `${pairKey}: cosine=${similarity.toFixed(3)} >= ${threshold.fail} (FAIL)`,
        );
        worstVerdict = 'FAIL';
      } else if (similarity >= threshold.warn && worstVerdict !== 'FAIL') {
        hits.push(
          `${pairKey}: cosine=${similarity.toFixed(3)} >= ${threshold.warn} (WARN)`,
        );
        worstVerdict = 'WARN';
      }
    }

    return {
      gate: 'semantic_similarity',
      verdict: worstVerdict,
      details: hits,
    };
  }

  // ── Gate D: Intent Coverage ──

  checkIntentCoverage(content: string, brief: PageBrief): GateResult {
    const normalized = stripHtml(content).toLowerCase();
    const first500 = normalized.substring(0, 500);
    const intentWords = brief.primary_intent
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS_FR.has(w));

    if (intentWords.length === 0) {
      return {
        gate: 'intent_coverage',
        verdict: 'PASS',
        details: ['No significant intent words'],
      };
    }

    // Use word boundary matching to avoid partial matches
    const matchesWord = (text: string, word: string): boolean => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
    };

    const found = intentWords.filter((w) => matchesWord(first500, w));
    const coverage = found.length / intentWords.length;

    let verdict: GateResult['verdict'] = 'PASS';
    if (coverage < 0.4) verdict = 'FAIL';
    else if (coverage < 0.6) verdict = 'WARN';

    const details: string[] = [];
    if (coverage < 0.6) {
      const missing = intentWords.filter((w) => !matchesWord(first500, w));
      details.push(
        `Coverage ${Math.round(coverage * 100)}% — missing: ${missing.join(', ')}`,
      );
    }

    return { gate: 'intent_coverage', verdict, details };
  }

  // ── TF-IDF Fingerprint ──

  computeContentFingerprint(text: string): Record<string, number> {
    const normalized = normalizeAccents(stripHtml(text).toLowerCase());
    const words = normalized
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS_FR.has(w));
    const freq: Record<string, number> = {};

    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }

    const totalTerms = Object.keys(freq).length;

    // Sub-linear TF: 1 + log(tf) dampens frequent common terms ("disque", "frein")
    // Pseudo-IDF: log(totalTerms / df) where df = raw count (approximates document frequency)
    // This gives discriminating terms (rare in this document) higher weight
    const weighted: Array<[string, number]> = Object.entries(freq).map(
      ([term, count]) => {
        const tf = 1 + Math.log(count);
        const idf = Math.log((totalTerms + 1) / (count + 1)) + 1;
        return [term, tf * idf];
      },
    );

    // Keep top 100 terms by TF-IDF weight
    const sorted = weighted.sort((a, b) => b[1] - a[1]).slice(0, 100);

    // Normalize to unit vector
    const total = sorted.reduce((s, [, w]) => s + w * w, 0);
    const norm = Math.sqrt(total) || 1;

    const fingerprint: Record<string, number> = {};
    for (const [term, weight] of sorted) {
      fingerprint[term] = weight / norm;
    }

    return fingerprint;
  }

  // ── Cosine Similarity ──

  private cosineSimilarity(
    a: Record<string, number>,
    b: Record<string, number>,
  ): number {
    // Dot product over shared keys
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of allKeys) {
      const va = a[key] ?? 0;
      const vb = b[key] ?? 0;
      dotProduct += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // ── Pair key helper ──

  private getPairKey(typeA: string, typeB: string): string {
    const roleA = this.typeToRoleShort(typeA);
    const roleB = this.typeToRoleShort(typeB);
    // Sort to always get consistent pair key
    const sorted = [roleA, roleB].sort();
    return `${sorted[0]}↔${sorted[1]}`;
  }

  private typeToRoleShort(pageType: string): string {
    if (pageType.startsWith('R1')) return 'R1';
    if (pageType.startsWith('R3')) return 'R3';
    if (pageType.startsWith('R4')) return 'R4';
    if (pageType.startsWith('R5')) return 'R5';
    return pageType;
  }
}
