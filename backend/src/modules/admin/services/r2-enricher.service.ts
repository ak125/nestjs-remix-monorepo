/**
 * R2EnricherService — WriteGate-native enricher for R2_PRODUCT pages
 *
 * Orchestrates content generation for range × vehicle listing pages.
 * All writes go through ContentWriteGateService — zero blind overwrites.
 *
 * Pipeline phases (from r2-keyword-plan.constants.ts):
 *   P0: Audit Finder (diagnose weaknesses)
 *   P1: Keyword Intent (PageContract + media slots)
 *   P2: Section Keyword Map (force right terms)
 *   P3: Section Content Gen (ui_blocks)
 *   P4: Micro Specs (mounting specs block)
 *   P5: QA Gatekeeper (11 quality gates)
 *
 * Data sources:
 *   - Gamme RAG docs (/opt/automecanik/rag/knowledge/gammes/)
 *   - R2PagePlanService (page structure + signals)
 *   - R2ValidatorService (contract validation + metrics)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { ContentWriteGateService } from '../../../config/content-write-gate.service';
import { RoleId } from '../../../config/role-ids';
import { SOURCE_TIER } from '../../../config/source-provenance.constants';
import type { ResourceGroup } from '../../../config/execution-registry.types';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';

export interface R2EnrichResult {
  pgId: string;
  vehicleKey?: string;
  status: 'enriched' | 'skipped' | 'failed';
  phase: string;
  qualityScore: number;
  qualityFlags: string[];
  sectionsGenerated: number;
  errorMessage?: string;
}

@Injectable()
export class R2EnricherService extends SupabaseBaseService {
  protected override readonly logger = new Logger(R2EnricherService.name);

  private readonly RAG_GAMMES_DIR = `${RAG_KNOWLEDGE_PATH}/gammes`;

  constructor(
    configService: ConfigService,
    private readonly writeGate: ContentWriteGateService,
  ) {
    super(configService);
  }

  /**
   * Enrich a single R2 page (gamme × vehicle).
   * All writes go through the WriteGate.
   */
  async enrichSingle(
    pgId: string,
    pgAlias: string,
    vehicleKey?: string,
  ): Promise<R2EnrichResult> {
    const ctx = `[R2_ENRICH pgId=${pgId} alias=${pgAlias}]`;
    this.logger.log(`${ctx} Starting R2 enrichment`);

    try {
      // ── P0: Load gamme metadata ──
      const { data: gamme } = await this.client
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias, pg_parent, pg_level')
        .eq('pg_id', pgId)
        .single();

      if (!gamme) {
        return {
          pgId,
          vehicleKey,
          status: 'skipped',
          phase: 'P0',
          qualityScore: 0,
          qualityFlags: ['GAMME_NOT_FOUND'],
          sectionsGenerated: 0,
        };
      }

      const gammeName = (gamme.pg_name as string) || pgAlias;

      // ── P0: Load RAG data for gamme (filesystem, 0-LLM) ──
      let ragContent: string | null = null;
      const ragPath = join(this.RAG_GAMMES_DIR, `${pgAlias}.md`);
      if (existsSync(ragPath)) {
        try {
          ragContent = readFileSync(ragPath, 'utf-8');
        } catch {
          this.logger.warn(`${ctx} RAG read failed for ${ragPath}`);
        }
      }

      const flags: string[] = [];
      if (!ragContent) flags.push('NO_RAG_DATA');

      // ── P1: Build entity pack ──
      const entityPack = {
        gamme: {
          pgId,
          pgAlias,
          name: gammeName,
          parent: gamme.pg_parent,
          level: gamme.pg_level,
        },
        vehicleKey: vehicleKey ?? null,
        ragAvailable: !!ragContent,
        enrichedAt: new Date().toISOString(),
      };

      // ── P2: Build section content from RAG ──
      const sectionContent: Record<string, unknown> = {};
      let sectionsGenerated = 0;

      if (ragContent) {
        // Extract selection criteria from RAG
        const selectionMatch = ragContent.match(
          /selection_criteria:\s*\n([\s\S]*?)(?=\n[a-z_]+:|$)/i,
        );
        if (selectionMatch) {
          sectionContent.S_BUYING_GUIDE = {
            type: 'selection_guide',
            content: selectionMatch[1].trim(),
            source: 'rag',
          };
          sectionsGenerated++;
        }

        // Extract symptoms/mistakes from RAG
        const mistakesMatch = ragContent.match(
          /anti_mistakes:\s*\n([\s\S]*?)(?=\n[a-z_]+:|$)/i,
        );
        if (mistakesMatch) {
          sectionContent.S_MISTAKES_AVOID = {
            type: 'mistakes_avoid',
            content: mistakesMatch[1].trim(),
            source: 'rag',
          };
          sectionsGenerated++;
        }

        // Extract FAQ from RAG
        const faqMatch = ragContent.match(
          /faq:\s*\n([\s\S]*?)(?=\n[a-z_]+:|$)/i,
        );
        if (faqMatch) {
          sectionContent.S_FAQ = {
            type: 'faq',
            content: faqMatch[1].trim(),
            source: 'rag',
          };
          sectionsGenerated++;
        }
      }

      // ── P5: Quality scoring ──
      const qualityScore = Math.min(
        100,
        sectionsGenerated * 25 + (ragContent ? 20 : 0),
      );
      if (qualityScore < 40) flags.push('LOW_QUALITY');

      // ── Write via WriteGate (zero blind overwrite) ──
      const payload: Record<string, unknown> = {
        r2kp_pg_id: pgId,
        r2kp_vehicle_key: vehicleKey ?? null,
        r2kp_entity_pack: entityPack,
        r2kp_section_content:
          Object.keys(sectionContent).length > 0 ? sectionContent : null,
        r2kp_quality_score: qualityScore,
        r2kp_status: qualityScore >= 68 ? 'validated' : 'draft',
        r2kp_phase: 'complete',
        r2kp_updated_at: new Date().toISOString(),
      };

      // ── Write to __seo_r2_keyword_plan (RAG-sourced ⇒ refused at the governed gate) ──
      const writeOutcome = await this.persistR2KeywordPlan(
        pgId,
        vehicleKey,
        payload,
        qualityScore,
        sectionsGenerated,
        flags,
      );
      if (writeOutcome) {
        return writeOutcome;
      }

      this.logger.log(
        `${ctx} Enrichment complete — score=${qualityScore} sections=${sectionsGenerated}`,
      );

      return {
        pgId,
        vehicleKey,
        status: 'enriched',
        phase: 'complete',
        qualityScore,
        qualityFlags: flags,
        sectionsGenerated,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`${ctx} Failed: ${msg}`);
      return {
        pgId,
        vehicleKey,
        status: 'failed',
        phase: 'unknown',
        qualityScore: 0,
        qualityFlags: ['EXCEPTION'],
        sectionsGenerated: 0,
        errorMessage: msg,
      };
    }
  }

  /**
   * Persist the R2 keyword-plan through the governed write gate.
   *
   * R2 content is sourced from legacy RAG gamme docs (ADR-031/046): it must never
   * reach the served `__seo_r2_keyword_plan` table. The write is stamped
   * `provenance = RAG_LEGACY`, which the gate refuses (0 rows) — there is no
   * fail-open direct-upsert fallback (writeGate is a required dependency). Returns
   * a `skipped` result on refusal, or `null` when the gate accepted the write
   * (the caller then continues to the success path).
   */
  private async persistR2KeywordPlan(
    pgId: string,
    vehicleKey: string | undefined,
    payload: Record<string, unknown>,
    qualityScore: number,
    sectionsGenerated: number,
    flags: string[],
  ): Promise<R2EnrichResult | null> {
    const result = await this.writeGate.writeToTarget({
      roleId: RoleId.R2_PRODUCT,
      target: 'r2_product_main' as ResourceGroup,
      pkValue: pgId,
      payload,
      correlationId: `r2-${pgId}-${Date.now().toString(36)}`,
      provenance: SOURCE_TIER.RAG_LEGACY,
    });

    if (!result.written) {
      return {
        pgId,
        vehicleKey,
        status: 'skipped',
        phase: 'write',
        qualityScore,
        qualityFlags: [
          ...flags,
          result.reason === 'rag_provenance_refused'
            ? 'RAG_SOURCE_REFUSED'
            : 'WRITE_GATE_BLOCKED',
        ],
        sectionsGenerated,
        errorMessage: result.reason,
      };
    }

    return null;
  }
}
