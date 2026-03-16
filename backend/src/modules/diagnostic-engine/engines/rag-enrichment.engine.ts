/**
 * RAG Enrichment Engine — Slice 8
 *
 * Enrichit les hypotheses diagnostiques avec des faits documentes
 * issus du corpus RAG (diagnostic/*.md, truth_level L1/L2).
 *
 * Degradation gracieuse : si RAG indisponible, retourne un tableau vide.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { RagProxyService } from '../../rag-proxy/rag-proxy.service';
import type { RagFact } from '../types/evidence-pack.schema';

interface ScoredHypothesis {
  hypothesis_id: string;
  label: string;
  cause_type: string;
  evidence_for: string[];
  related_gamme_slugs?: string[];
}

@Injectable()
export class RagEnrichmentEngine {
  private readonly logger = new Logger(RagEnrichmentEngine.name);

  constructor(
    @Optional() private readonly ragService: RagProxyService | null,
  ) {}

  /**
   * Query RAG for diagnostic facts related to the current analysis.
   * Returns typed RagFact[] for inclusion in EvidencePack.
   */
  async enrich(
    systemSlug: string,
    symptomSlugs: string[],
    hypotheses: ScoredHypothesis[],
  ): Promise<RagFact[]> {
    if (!this.ragService) {
      this.logger.debug('RAG service not available — skipping enrichment');
      return [];
    }

    const facts: RagFact[] = [];

    try {
      // Build a focused query from system + symptoms + top causes
      const topCauses = hypotheses
        .slice(0, 3)
        .map((h) => h.label)
        .join(', ');
      const symptoms = symptomSlugs.join(' ');
      const query = `diagnostic ${systemSlug} ${symptoms} ${topCauses}`;

      const response = await this.ragService.search({
        query,
        limit: 5,
        filters: { truth_levels: ['L1', 'L2'] },
        routing: { target_role: 'R5_DIAGNOSTIC' },
      });

      if (!response.results || response.results.length === 0) {
        this.logger.debug('No RAG results for diagnostic enrichment');
        return [];
      }

      for (const result of response.results) {
        const sourcePath = result.sourcePath || result.source_path || 'unknown';
        const truthLevel = (result.truth_level || 'L2') as
          | 'L1'
          | 'L2'
          | 'L3'
          | 'L4';

        // Extract meaningful facts from RAG chunks
        const extractedFacts = this.extractFacts(
          result.content,
          sourcePath,
          truthLevel,
          hypotheses,
        );
        facts.push(...extractedFacts);
      }

      // Deduplicate by content
      const seen = new Set<string>();
      const dedupedFacts = facts.filter((f) => {
        if (seen.has(f.content)) return false;
        seen.add(f.content);
        return true;
      });

      this.logger.log(
        `RAG enrichment: ${dedupedFacts.length} facts from ${response.results.length} results`,
      );

      // Cap at 10 facts to keep payload reasonable
      return dedupedFacts.slice(0, 10);
    } catch (error) {
      // Graceful degradation — RAG failure should never block the diagnostic
      this.logger.warn(
        `RAG enrichment failed (graceful degradation): ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Extract typed facts from a RAG chunk, classifying each by evidence_type.
   */
  private extractFacts(
    content: string,
    sourceFile: string,
    truthLevel: 'L1' | 'L2' | 'L3' | 'L4',
    hypotheses: ScoredHypothesis[],
  ): RagFact[] {
    const facts: RagFact[] = [];
    const lines = content.split('\n').filter((l) => l.trim().length > 10);
    const causeLabels = hypotheses.map((h) => h.label.toLowerCase());

    for (const line of lines) {
      const trimmed = line
        .replace(/^[-*#]+\s*/, '')
        .replace(/\*\*/g, '')
        .trim();
      if (trimmed.length < 15 || trimmed.length > 300) continue;

      const lower = trimmed.toLowerCase();
      const evidenceType = this.classifyLine(lower, causeLabels);
      if (!evidenceType) continue;

      facts.push({
        evidence_type: evidenceType,
        content: trimmed,
        source_file: sourceFile,
        truth_level: truthLevel,
      });
    }

    return facts;
  }

  /**
   * Rule-based classification of a RAG line into evidence types.
   */
  private classifyLine(
    line: string,
    causeLabels: string[],
  ): RagFact['evidence_type'] | null {
    // Safety / urgency patterns
    if (
      line.includes('urgence') ||
      line.includes('critique') ||
      line.includes('danger') ||
      line.includes('securite') ||
      line.includes('arreter')
    ) {
      return 'weak_point_evidence';
    }

    // Verification methods
    if (
      line.includes('verification') ||
      line.includes('verifier') ||
      line.includes('controler') ||
      line.includes('mesurer') ||
      line.includes('palper')
    ) {
      return 'verification_support_evidence';
    }

    // Maintenance / entretien
    if (
      line.includes('entretien') ||
      line.includes('intervalle') ||
      line.includes('remplacement') ||
      line.includes('vidange') ||
      line.includes('revision')
    ) {
      return 'maintenance_support_evidence';
    }

    // Cause support (matches a hypothesis label)
    for (const label of causeLabels) {
      const keywords = label.split(/\s+/).filter((w) => w.length > 3);
      if (keywords.some((kw) => line.includes(kw))) {
        return 'cause_support_evidence';
      }
    }

    // Repair tips / astuces
    if (
      line.includes('astuce') ||
      line.includes('conseil') ||
      line.includes('recommand') ||
      line.includes('privilegier') ||
      line.includes('toujours remplacer') ||
      line.includes('kit complet') ||
      line.includes('par paire')
    ) {
      return 'repair_tip';
    }

    // Cost / price information
    if (
      line.includes('€') ||
      line.includes('eur') ||
      line.includes('cout') ||
      line.includes('prix') ||
      line.includes('tarif')
    ) {
      return 'cost_evidence';
    }

    // OBD / error codes
    if (/p[0-9]{3,4}/i.test(line) || line.includes('code defaut')) {
      return 'obd_code_evidence';
    }

    // Symptom nuances
    if (
      line.includes('quand') ||
      line.includes('caracteristique') ||
      line.includes('symptome') ||
      line.includes('bruit') ||
      line.includes('voyant')
    ) {
      return 'symptom_nuance_evidence';
    }

    // Probability data
    if (line.includes('probabilite') || line.includes('%')) {
      return 'cause_support_evidence';
    }

    return null;
  }
}
