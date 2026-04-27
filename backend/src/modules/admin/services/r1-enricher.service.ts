/**
 * R1EnricherService — 0-LLM enricher for R1_ROUTER pages.
 *
 * Reads RAG gamme docs + R1 keyword plan, generates transactional
 * content slots and writes to __seo_r1_gamme_slots.
 *
 * Replaces the deleted R1ContentPipelineService (which used Groq LLM).
 *
 * @see r1-keyword-plan.constants.ts
 * @see execution-registry.constants.ts
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { ContentWriteGateService } from '../../../config/content-write-gate.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { RoleId } from '../../../config/role-ids';
import type { ResourceGroup } from '../../../config/execution-registry.types';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';
import { EnricherTextUtils } from './enricher-text-utils.service';
import { EnricherYamlParser } from './enricher-yaml-parser.service';

export interface R1EnrichResult {
  pgId: string;
  status: 'enriched' | 'skipped' | 'failed';
  slotsWritten: number;
  qualityScore: number;
  qualityFlags: string[];
  errorMessage?: string;
}

@Injectable()
export class R1EnricherService extends SupabaseBaseService {
  protected override readonly logger = new Logger(R1EnricherService.name);

  private readonly RAG_GAMMES_DIR = `${RAG_KNOWLEDGE_PATH}/gammes`;

  constructor(
    configService: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly textUtils: EnricherTextUtils,
    private readonly yamlParser: EnricherYamlParser,
    @Optional() private readonly writeGate?: ContentWriteGateService,
  ) {
    super(configService);
  }

  /**
   * Enrich a single R1 page (gamme listing page).
   */
  async enrichSingle(pgId: string, pgAlias: string): Promise<R1EnrichResult> {
    const ctx = `[R1_ENRICH pgId=${pgId} alias=${pgAlias}]`;
    this.logger.log(`${ctx} Starting R1 enrichment`);

    try {
      // ── Load gamme metadata ──
      const { data: gamme } = await this.client
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias')
        .eq('pg_id', pgId)
        .single();

      if (!gamme) {
        return this.skip(pgId, ['GAMME_NOT_FOUND']);
      }

      const gammeName = (gamme.pg_name as string) || pgAlias;

      // ── Load RAG doc (filesystem, 0-LLM) ──
      const ragPath = join(this.RAG_GAMMES_DIR, `${pgAlias}.md`);
      let ragContent: string | null = null;
      if (existsSync(ragPath)) {
        try {
          ragContent = readFileSync(ragPath, 'utf-8');
        } catch {
          this.logger.warn(`${ctx} Failed to read RAG file`);
        }
      }

      if (!ragContent) {
        return this.skip(pgId, ['NO_RAG_DATA']);
      }

      // ── Load R1 keyword plan (optional) ──
      const { data: kpRow } = await this.client
        .from('__seo_r1_keyword_plan')
        .select('rkp_section_terms, rkp_primary_intent, rkp_quality_score')
        .eq('rkp_pg_id', parseInt(pgId, 10))
        .single();

      // ── Parse RAG frontmatter ──
      const fm = this.yamlParser.extractFrontmatterBlock(ragContent);

      // ── Extract markdown sections by heading ──
      const sections = this.extractMarkdownSections(ragContent);

      // ── Build R1 slots ──
      const slots: Record<string, unknown> = {};
      const flags: string[] = [];

      // Hero subtitle
      const introRole =
        this.extractYamlValue(fm, 'intro_role') ||
        sections.get('role') ||
        `Trouvez votre ${gammeName} au meilleur prix`;
      slots.r1s_hero_subtitle = this.textUtils.truncateText(introRole, 200);

      // Micro SEO block — try markdown section, then synthesize from YAML
      let microSeo = sections.get('micro_seo') || sections.get('seo') || '';
      if (!microSeo && fm) {
        microSeo = this.synthesizeMicroSeo(fm, gammeName, sections);
      }
      slots.r1s_micro_seo_block = this.textUtils.truncateText(microSeo, 1000);
      if (!microSeo) flags.push('MISSING_MICRO_SEO');

      // Equipementiers line
      const equipList = fm
        ? this.yamlParser.extractYamlList(fm, 'equipementiers')
        : [];
      const equipLine =
        equipList.length > 0
          ? equipList.join(', ')
          : sections.get('equipementiers') || '';
      slots.r1s_equipementiers_line = this.textUtils.truncateText(
        equipLine,
        300,
      );

      // Compatibilities intro
      const compatIntro =
        sections.get('compatibilite') || sections.get('compatibility') || '';
      slots.r1s_compatibilities_intro = this.textUtils.truncateText(
        compatIntro,
        500,
      );

      // Family cross-sell intro
      const crossSell =
        sections.get('pieces_associees') || sections.get('related_parts') || '';
      slots.r1s_family_cross_sell_intro = this.textUtils.truncateText(
        crossSell,
        500,
      );

      // Buy arguments (arg1-arg4)
      const buyArgs = this.extractBuyArgs(sections, fm);
      for (let i = 0; i < 4; i++) {
        const arg = buyArgs[i];
        if (arg) {
          slots[`r1s_arg${i + 1}_title`] = this.textUtils.truncateText(
            arg.title,
            100,
          );
          slots[`r1s_arg${i + 1}_content`] = this.textUtils.truncateText(
            arg.content,
            300,
          );
        }
      }

      // FAQ
      const faq = fm ? this.yamlParser.extractYamlFaq(fm) : [];
      if (faq.length > 0) {
        slots.r1s_faq = faq.slice(0, 6);
      } else {
        flags.push('MISSING_FAQ');
      }

      // Inject keyword plan terms if available
      if (kpRow?.rkp_section_terms) {
        this.injectKeywordTerms(
          slots,
          kpRow.rkp_section_terms as Record<string, unknown>,
        );
      }

      // ── Quality scoring ──
      let score = 100;
      if (!microSeo) score -= 20;
      if (faq.length === 0) score -= 15;
      if (buyArgs.length < 2) {
        score -= 10;
        flags.push('FEW_BUY_ARGS');
      }
      if (!equipLine) score -= 5;
      if (!compatIntro) score -= 5;
      score = Math.max(0, score);

      slots.r1s_gatekeeper_score = score;
      slots.r1s_gatekeeper_flags = flags;
      slots.r1s_updated_at = new Date().toISOString();

      // ── Write to __seo_r1_gamme_slots ──
      if (this.writeGate && this.flags.writeGuardEnabled) {
        const result = await this.writeGate.writeToTarget({
          roleId: RoleId.R1_ROUTER,
          target: 'r1_gamme_slots' as ResourceGroup,
          pkValue: pgId,
          payload: slots,
          correlationId: `r1-${pgAlias}-${Date.now()}`,
        });
        if (!result.written) {
          return {
            pgId,
            status: 'skipped',
            slotsWritten: 0,
            qualityScore: score,
            qualityFlags: [...flags, 'WRITE_GATE_BLOCKED'],
            errorMessage: result.reason,
          };
        }
      } else {
        const { error } = await this.client
          .from('__seo_r1_gamme_slots')
          .upsert({ r1s_pg_id: pgId, ...slots }, { onConflict: 'r1s_pg_id' });
        if (error) {
          this.logger.error(`${ctx} Upsert failed: ${error.message}`);
          return {
            pgId,
            status: 'failed',
            slotsWritten: 0,
            qualityScore: score,
            qualityFlags: [...flags, 'UPSERT_FAILED'],
            errorMessage: error.message,
          };
        }
      }

      const slotsWritten = Object.keys(slots).filter(
        (k) =>
          k.startsWith('r1s_') &&
          k !== 'r1s_updated_at' &&
          k !== 'r1s_gatekeeper_score' &&
          k !== 'r1s_gatekeeper_flags',
      ).length;

      this.logger.log(
        `${ctx} Enriched: ${slotsWritten} slots, score=${score}, flags=[${flags.join(',')}]`,
      );

      return {
        pgId,
        status: 'enriched',
        slotsWritten,
        qualityScore: score,
        qualityFlags: flags,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`${ctx} Exception: ${msg}`);
      return {
        pgId,
        status: 'failed',
        slotsWritten: 0,
        qualityScore: 0,
        qualityFlags: ['EXCEPTION'],
        errorMessage: msg,
      };
    }
  }

  // ── Private helpers ──

  private skip(pgId: string, flags: string[]): R1EnrichResult {
    return {
      pgId,
      status: 'skipped',
      slotsWritten: 0,
      qualityScore: 0,
      qualityFlags: flags,
    };
  }

  private extractMarkdownSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    // Remove frontmatter
    const body = content.replace(/^---[\s\S]*?---\n?/, '');
    const headingPattern = /^##\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    const headings: Array<{ key: string; start: number }> = [];

    while ((match = headingPattern.exec(body)) !== null) {
      const key = match[1]
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_');
      headings.push({ key, start: match.index + match[0].length });
    }

    for (let i = 0; i < headings.length; i++) {
      const end = i + 1 < headings.length ? headings[i + 1].start : body.length;
      const sectionContent = body
        .substring(headings[i].start, end)
        .replace(/^##\s+.+$/gm, '')
        .trim();
      if (sectionContent) {
        sections.set(headings[i].key, sectionContent);
      }
    }
    return sections;
  }

  private extractYamlValue(fm: string | null, key: string): string | null {
    if (!fm) return null;
    const match = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
  }

  private synthesizeMicroSeo(
    fm: string,
    gammeName: string,
    sections: Map<string, string>,
  ): string {
    const parts: string[] = [];

    // Extract domain.role from YAML
    const role = this.extractYamlValue(fm, 'role');
    if (role) {
      parts.push(
        `Le ${gammeName} ${role.charAt(0).toLowerCase()}${role.slice(1)}.`,
      );
    }

    // Extract must_be_true keywords
    const mustBeTrue = this.yamlParser.extractYamlList(fm, 'must_be_true');
    if (mustBeTrue.length > 0) {
      parts.push(
        `Fonctions essentielles : ${mustBeTrue.slice(0, 3).join(', ')}.`,
      );
    }

    // Extract selection criteria if available
    const criteria = this.yamlParser.extractYamlList(fm, 'criteria');
    if (criteria.length > 0) {
      parts.push(`Critères de choix : ${criteria.slice(0, 3).join(', ')}.`);
    }

    // Fallback to role section content
    if (parts.length === 0) {
      const roleSection =
        sections.get('role') || sections.get('fonctionnement') || '';
      if (roleSection) {
        parts.push(roleSection.slice(0, 300));
      }
    }

    return parts.join(' ');
  }

  private extractBuyArgs(
    sections: Map<string, string>,
    fm: string | null,
  ): Array<{ title: string; content: string }> {
    // Try frontmatter buy_args list
    if (fm) {
      const args = this.yamlParser.extractYamlList(fm, 'buy_args');
      if (args.length > 0) {
        return args.slice(0, 4).map((a) => {
          const [title, ...rest] = a.split(':');
          return {
            title: (title || a).trim(),
            content: rest.join(':').trim() || a,
          };
        });
      }
    }

    // Fallback: extract from markdown sections
    const result: Array<{ title: string; content: string }> = [];
    const argKeys = [
      'avantages',
      'pourquoi_changer',
      'qualite',
      'securite',
      'fiabilite',
    ];
    for (const key of argKeys) {
      const content = sections.get(key);
      if (content && content.length > 20) {
        result.push({
          title: key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
          content: content.trim().slice(0, 300),
        });
      }
      if (result.length >= 4) break;
    }
    return result;
  }

  private injectKeywordTerms(
    slots: Record<string, unknown>,
    sectionTerms: Record<string, unknown>,
  ): void {
    const terms = sectionTerms as Record<
      string,
      { include_terms?: string[]; micro_phrases?: string[] }
    >;
    const r1S0 = terms?.R1_S0;
    if (r1S0?.micro_phrases && typeof slots.r1s_micro_seo_block === 'string') {
      const existing = slots.r1s_micro_seo_block;
      const phrases = r1S0.micro_phrases
        .filter((p) => !existing.toLowerCase().includes(p.toLowerCase()))
        .slice(0, 2);
      if (phrases.length > 0) {
        slots.r1s_micro_seo_block = `${existing} ${phrases.join('. ')}.`;
      }
    }
  }
}
