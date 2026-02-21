import { Injectable, Logger } from '@nestjs/common';
import {
  SECTION_POLICIES,
  POLICY_VERSION,
  getSectionMode,
  getMaxWords,
  type PageRole,
} from '../../../config/content-section-policy';
import type {
  ClaimEntry,
  SectionMeta,
} from '../../../workers/types/content-refresh.types';

// ── Types ──

export interface CompilationLog {
  /** Sections removed because mode = forbidden */
  stripped: string[];
  /** Sections truncated to maxWords */
  truncated: string[];
  /** Sections replaced by link_only stub */
  linkified: string[];
  /** Number of unverified claims blocked (block-early) */
  claimsBlocked: number;
  /** Policy version used */
  policyVersion: string;
}

export interface CompilationResult {
  /** Sections after policy enforcement (published content) */
  compiledSections: Record<string, string>;
  /** Audit log of what was changed */
  compilationLog: CompilationLog;
  /** Per-section metadata */
  sectionsMeta: Record<string, SectionMeta>;
}

// ── Helpers ──

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  const plain = stripHtml(text);
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

/**
 * Truncate HTML content to approximately maxWords.
 * Works at the paragraph/list-item level to avoid orphaned tags.
 */
function truncateHtml(html: string, maxWords: number): string {
  if (maxWords <= 0) return '';
  if (countWords(html) <= maxWords) return html;

  // Split into block-level elements
  const blockRegex =
    /(<(?:p|li|div|h[2-6]|blockquote|ul|ol|tr)[^>]*>[\s\S]*?<\/(?:p|li|div|h[2-6]|blockquote|ul|ol|tr)>)/gi;
  const blocks = html.match(blockRegex) || [html];

  let result = '';
  let wordsSoFar = 0;

  for (const block of blocks) {
    const blockWords = countWords(block);
    if (wordsSoFar + blockWords > maxWords && wordsSoFar > 0) break;
    result += block;
    wordsSoFar += blockWords;
  }

  return result || blocks[0]; // At minimum return first block
}

// ── Service ──

@Injectable()
export class SectionCompilerService {
  private readonly logger = new Logger(SectionCompilerService.name);

  /**
   * Compile raw sections into policy-compliant output.
   *
   * @param role - Page role (R1, R3_guide, etc.)
   * @param rawSections - Raw section content from enricher (key → HTML string)
   * @param claims - Claim ledger entries for block-early enforcement
   * @param gammeName - For link_only stub generation
   * @param pgAlias - For link_only stub generation
   */
  compile(
    role: PageRole,
    rawSections: Record<string, string>,
    claims: ClaimEntry[] = [],
    gammeName?: string,
    pgAlias?: string,
  ): CompilationResult {
    const compiledSections: Record<string, string> = {};
    const sectionsMeta: Record<string, SectionMeta> = {};
    const log: CompilationLog = {
      stripped: [],
      truncated: [],
      linkified: [],
      claimsBlocked: 0,
      policyVersion: POLICY_VERSION,
    };

    for (const [sectionKey, rawContent] of Object.entries(rawSections)) {
      const mode = getSectionMode(sectionKey, role);
      const maxWords = getMaxWords(sectionKey, role);
      const policy = SECTION_POLICIES[sectionKey];

      // Unknown section (no policy) → pass through unchanged
      if (!policy) {
        compiledSections[sectionKey] = rawContent;
        sectionsMeta[sectionKey] = {
          sectionKey,
          wordCount: countWords(rawContent),
          sourceType: 'db',
          appliedMode: 'full',
          wasTruncated: false,
          wasStripped: false,
        };
        continue;
      }

      let content = rawContent;
      let appliedMode: SectionMeta['appliedMode'] = mode;
      let wasTruncated = false;
      let wasStripped = false;

      switch (mode) {
        case 'forbidden': {
          content = '';
          wasStripped = true;
          log.stripped.push(sectionKey);
          appliedMode = 'forbidden';
          break;
        }

        case 'link_only': {
          content = this.buildLinkOnlyStub(
            sectionKey,
            gammeName || pgAlias || '',
            pgAlias || '',
          );
          log.linkified.push(sectionKey);
          appliedMode = 'link_only';
          break;
        }

        case 'summary': {
          if (maxWords > 0 && countWords(content) > maxWords) {
            content = truncateHtml(content, maxWords);
            wasTruncated = true;
            log.truncated.push(sectionKey);
          }
          appliedMode = 'summary';
          break;
        }

        case 'full': {
          // Full mode: still enforce maxWords as a safety net
          if (maxWords > 0 && countWords(content) > maxWords * 1.2) {
            content = truncateHtml(content, maxWords);
            wasTruncated = true;
            log.truncated.push(sectionKey);
          }
          appliedMode = 'full';
          break;
        }
      }

      // Block-early: strip unverified claims from content
      if (content && claims.length > 0) {
        const sectionClaims = claims.filter(
          (c) => c.sectionKey === sectionKey && c.status === 'unverified',
        );
        for (const claim of sectionClaims) {
          if (claim.rawText && content.includes(claim.rawText)) {
            content = content.replace(claim.rawText, '');
            log.claimsBlocked++;
          }
        }
        // Clean up double spaces from claim removal
        content = content.replace(/\s{2,}/g, ' ').trim();
      }

      // FAQ intent filtering
      if (sectionKey === 'faq' && policy.faqIntentPatterns) {
        const filtered = this.filterFaqByIntent(content, role, policy);
        if (filtered.removedCount > 0) {
          content = filtered.content;
          this.logger.log(
            `FAQ intent filter: removed ${filtered.removedCount} Q&As from ${sectionKey} for role ${role}`,
          );
        }
      }

      if (wasStripped) {
        // Don't include stripped sections in output
        sectionsMeta[sectionKey] = {
          sectionKey,
          wordCount: 0,
          sourceType: 'empty',
          appliedMode,
          wasTruncated: false,
          wasStripped: true,
        };
        continue;
      }

      compiledSections[sectionKey] = content;
      sectionsMeta[sectionKey] = {
        sectionKey,
        wordCount: countWords(content),
        sourceType: this.inferSourceType(sectionKey, content),
        appliedMode,
        wasTruncated,
        wasStripped,
      };
    }

    this.logger.log(
      `Compiled ${Object.keys(rawSections).length} sections for ${role}: ` +
        `stripped=${log.stripped.length}, truncated=${log.truncated.length}, ` +
        `linkified=${log.linkified.length}, claimsBlocked=${log.claimsBlocked}`,
    );

    return { compiledSections, compilationLog: log, sectionsMeta };
  }

  /**
   * Build a link_only stub for non-owner roles.
   * Shows a brief summary + link to the owner's page.
   */
  private buildLinkOnlyStub(
    sectionKey: string,
    gammeName: string,
    pgAlias: string,
  ): string {
    const labels: Record<string, string> = {
      symptoms: 'symptômes',
      how_to_choose: 'comment choisir',
      faq: 'questions fréquentes',
      composition: 'composition technique',
      confusions: 'confusions courantes',
    };
    const label = labels[sectionKey] || sectionKey.replace(/_/g, ' ');

    return (
      `<p>Pour en savoir plus sur les ${label} des ${gammeName}, ` +
      `consultez notre <a href="/pieces/${pgAlias}">guide complet</a>.</p>`
    );
  }

  /**
   * Filter FAQ questions by intent patterns.
   * Remove questions that belong to a different role.
   */
  private filterFaqByIntent(
    faqHtml: string,
    role: PageRole,
    policy: (typeof SECTION_POLICIES)[string],
  ): { content: string; removedCount: number } {
    if (!policy.faqIntentPatterns) return { content: faqHtml, removedCount: 0 };

    // Get patterns for OTHER roles (not current role)
    const otherPatterns: RegExp[] = [];
    for (const [r, patterns] of Object.entries(policy.faqIntentPatterns)) {
      if (r !== role && patterns) {
        otherPatterns.push(...patterns);
      }
    }
    if (otherPatterns.length === 0)
      return { content: faqHtml, removedCount: 0 };

    // Match Q&A blocks: <h3>question</h3><p>answer</p> or <dt>/<dd> pairs
    const qaBlockRegex =
      /<(?:h3|dt)[^>]*>([\s\S]*?)<\/(?:h3|dt)>\s*<(?:p|dd)[^>]*>[\s\S]*?<\/(?:p|dd)>/gi;

    let removedCount = 0;
    const filtered = faqHtml.replace(
      qaBlockRegex,
      (match, question: string) => {
        const plainQ = stripHtml(question).toLowerCase();
        const belongsToOther = otherPatterns.some((p) => p.test(plainQ));
        if (belongsToOther) {
          removedCount++;
          return '';
        }
        return match;
      },
    );

    return {
      content: filtered.replace(/\n{3,}/g, '\n\n').trim(),
      removedCount,
    };
  }

  /**
   * Infer the source type of a section based on content markers.
   */
  private inferSourceType(
    _sectionKey: string,
    content: string,
  ): SectionMeta['sourceType'] {
    if (!content || content.trim() === '') return 'empty';
    if (content.includes('data-source="rag"')) return 'rag';
    if (content.includes('data-source="ai"')) return 'ai';
    if (content.includes('data-source="static"')) return 'static';
    return 'db';
  }
}
