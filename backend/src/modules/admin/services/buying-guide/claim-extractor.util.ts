import { createHash } from 'node:crypto';
import type {
  EvidenceEntry,
  ClaimEntry,
  ClaimKind,
} from '../../../../workers/types/content-refresh.types';
import type { SectionValidationResult } from './buying-guide.types';
import type { PageBrief } from '../page-brief.service';

/**
 * Static utility class for extracting claims from enriched sections.
 * No DI — all methods are static.
 */
export class ClaimExtractor {
  /**
   * Extract claims (mileage, dimension, percentage, norm) from enriched sections.
   * Each claim is matched against the evidence pack to determine verified/unverified status.
   * Unverified claims will be stripped by SectionCompiler (block-early).
   */
  static extractClaims(
    sections: Record<string, SectionValidationResult>,
    sources: string[],
    evidenceEntries: EvidenceEntry[],
    brief?: PageBrief | null,
  ): ClaimEntry[] {
    const claims: ClaimEntry[] = [];

    // Build a set of sourced numeric values from evidence for verification
    const sourcedValues = new Set<string>();
    for (const entry of evidenceEntries) {
      if (entry.rawExcerpt) {
        const nums = entry.rawExcerpt.match(
          /\d+(?:[.,\s]\d+)*\s*(?:mm|cm|km|m|Nm|bar|°C|ans?|%|€|litres?|kg)\b/gi,
        );
        if (nums) {
          for (const n of nums) {
            sourcedValues.add(ClaimExtractor.normalizeClaimValue(n));
          }
        }
      }
    }

    // Claim extraction patterns by kind
    const CLAIM_PATTERNS: Array<{
      kind: ClaimKind;
      regex: RegExp;
      unit: string;
    }> = [
      // Mileage: "120 000 km", "60000 km", "30 000 - 60 000 km"
      {
        kind: 'mileage',
        regex:
          /(\d[\d\s.,]*\d?\s*(?:-|à|a)\s*\d[\d\s.,]*\d?\s*km|\d[\d\s.,]*\d?\s*km)\b/gi,
        unit: 'km',
      },
      // Dimension: "mm", "cm", "Nm", "bar", "°C"
      {
        kind: 'dimension',
        regex: /(\d+(?:[.,]\d+)?\s*(?:mm|cm|Nm|bar|°C))\b/gi,
        unit: '',
      },
      // Percentage
      { kind: 'percentage', regex: /(\d+(?:[.,]\d+)?\s*%)/gi, unit: '%' },
      // Norms: ISO/ECE/FMVSS + number
      {
        kind: 'norm',
        regex: /\b((?:ISO|ECE|FMVSS|NF|EN)\s*[\w.-]+)\b/gi,
        unit: '',
      },
    ];

    for (const [sectionKey, section] of Object.entries(sections)) {
      if (!section.ok || !section.rawAnswer) continue;

      const rawText =
        typeof section.content === 'string'
          ? section.content
          : section.rawAnswer;

      if (!rawText) continue;

      const plainText = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

      for (const { kind, regex, unit } of CLAIM_PATTERNS) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(plainText)) !== null) {
          const rawClaimText = match[1] || match[0];
          const normalizedValue =
            ClaimExtractor.normalizeClaimValue(rawClaimText);
          const claimUnit = unit || ClaimExtractor.inferUnit(rawClaimText);

          // Determine if this claim is sourced
          const isVerified = sourcedValues.has(normalizedValue);

          // Build stable hash for dedup
          const id = createHash('sha256')
            .update(`${kind}:${normalizedValue}:${sectionKey}`)
            .digest('hex')
            .substring(0, 16);

          // Find matching evidence entry
          const matchingEvidence = evidenceEntries.find(
            (e) =>
              e.heading === sectionKey &&
              e.rawExcerpt?.includes(rawClaimText.substring(0, 20)),
          );

          claims.push({
            id,
            kind,
            rawText: rawClaimText.trim(),
            value: normalizedValue,
            unit: claimUnit,
            sectionKey,
            sourceRef: isVerified
              ? `rag:${sources[0] || 'unknown'}#${sectionKey}`
              : null,
            evidenceId: matchingEvidence
              ? `${matchingEvidence.docId}#${matchingEvidence.heading}`
              : null,
            status: isVerified ? 'verified' : 'unverified',
          });
        }
      }
    }

    // Deduplicate by id
    const seen = new Set<string>();
    const dedupedClaims = claims.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // Log brief-aware filtering info (caller should handle logging)
    void brief; // consumed by caller for logging

    return dedupedClaims;
  }

  /** Normalize a claim value for comparison: strip spaces, lowercase */
  static normalizeClaimValue(raw: string): string {
    return raw.replace(/\s+/g, '').replace(/,/g, '.').toLowerCase().trim();
  }

  /** Infer unit from raw claim text */
  static inferUnit(text: string): string {
    const unitMatch = text.match(/(mm|cm|km|Nm|bar|°C|%|€|litres?|kg|ans?)$/i);
    return unitMatch ? unitMatch[1].toLowerCase() : '';
  }

  static isIntroRoleMismatch(introRole: string, gammeName: string): boolean {
    const colonIdx = introRole.indexOf(':');
    if (colonIdx < 1) return false;

    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const stripArticles = (s: string) =>
      s.replace(/^(le |la |les |l'|l'|un |une |des )/i, '').trim();

    const rolePiece = normalize(introRole.slice(0, colonIdx));
    const titleNorm = normalize(gammeName);

    if (!rolePiece || !titleNorm) return false;

    const roleWords = stripArticles(rolePiece)
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const titleWords = stripArticles(titleNorm)
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (roleWords.length === 0 || titleWords.length === 0) return false;

    const hasCommon = roleWords.some((rw) =>
      titleWords.some((tw) => tw.includes(rw) || rw.includes(tw)),
    );

    return !hasCommon;
  }
}
