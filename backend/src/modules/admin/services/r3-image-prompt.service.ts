import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { EnricherYamlParser } from './enricher-yaml-parser.service';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import {
  MEDIA_LAYOUT_CONTRACT,
  type MediaSlotImageContract,
} from '../../../config/media-slots.constants';

// ── Constants ──

const RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';

const SLOT_SECTION_MAP: Record<string, { sectionId: string; topic: string }> = {
  HERO_IMAGE: { sectionId: 'HERO', topic: 'hero_piece' },
  S2_SYMPTOM_IMAGE: { sectionId: 'S2', topic: 'symptom_visual' },
  S3_SCHEMA_IMAGE: { sectionId: 'S3', topic: 'comparison_schema' },
  S4D_SCHEMA_IMAGE: { sectionId: 'S4_DEPOSE', topic: 'fixation_schema' },
};

const IN_ARTICLE_SLOTS = [
  'S2_SYMPTOM_IMAGE',
  'S3_SCHEMA_IMAGE',
  'S4D_SCHEMA_IMAGE',
] as const;

const MAX_IN_ARTICLE_IMAGES = 2; // G7 gate

const NEGATIVE_PROMPT =
  'cartoon, illustration, low quality, watermark, blurry, text overlay, generic auto parts, dirty workshop floor, human hands, logo, brand name, stock photo watermark';

// ── Interfaces ──

export interface R3ImagePromptRow {
  rip_pg_id: number;
  rip_pg_alias: string;
  rip_gamme_name: string;
  rip_slot_id: string;
  rip_section_id: string;
  rip_topic: string;
  rip_aspect_ratio: string;
  rip_min_width: number;
  rip_prompt_text: string;
  rip_alt_text: string;
  rip_neg_prompt: string;
  rip_caption: string | null;
  rip_budget_cost: number;
  rip_selected: boolean;
  rip_priority_rank: number | null;
  rip_rag_fields_used: string[];
  rip_rag_richness_score: number;
  rip_status: string;
}

export interface R3ImagePromptResult {
  pgAlias: string;
  status: 'generated' | 'skipped' | 'failed';
  slotsGenerated: string[];
  slotsSkipped: string[];
  inArticleSelected: string[];
  reason?: string;
}

export interface R3ImagePromptBatchResult {
  processed: number;
  generated: number;
  skipped: number;
  failed: number;
  items: R3ImagePromptResult[];
}

// ── Parsed RAG data ──

interface RagData {
  category?: string;
  domain?: {
    role?: string;
    confusion_with?: Array<{ term: string; difference: string }>;
    related_parts?: string[];
  };
  diagnostic?: {
    symptoms?: Array<{ id: string; label: string; severity: string }>;
    causes?: string[];
  };
  maintenance?: {
    wear_signs?: string[];
    interval?: { value: string; unit: string };
  };
  selection?: {
    criteria?: string[];
    brands?: { premium?: string[]; equivalent?: string[]; budget?: string[] };
    anti_mistakes?: string[];
  };
  installation?: {
    difficulty?: string;
    tools?: string[];
    steps?: string[];
    time?: string;
    prerequisite?: string;
  };
}

@Injectable()
export class R3ImagePromptService extends SupabaseBaseService {
  protected readonly logger = new Logger(R3ImagePromptService.name);

  constructor(private readonly yamlParser: EnricherYamlParser) {
    super();
  }

  // ── Public API ──

  async generateForGamme(
    pgId: number,
    pgAlias: string,
    pgName: string,
    options?: { force?: boolean; slotsFilter?: string[] },
  ): Promise<R3ImagePromptResult> {
    const result: R3ImagePromptResult = {
      pgAlias,
      status: 'generated',
      slotsGenerated: [],
      slotsSkipped: [],
      inArticleSelected: [],
    };

    // Read RAG
    const ragContent = this.readRagFromDisk(pgAlias);
    if (!ragContent) {
      return { ...result, status: 'skipped', reason: 'No RAG file found' };
    }

    const ragData = this.parseRagData(ragContent);

    // Score in-article slots
    const scores = this.computeSlotRichnessScores(ragData);
    const selectedInArticle = this.selectInArticleSlots(scores);
    result.inArticleSelected = selectedInArticle;

    // Build prompts for all 4 slots
    const rows: R3ImagePromptRow[] = [];

    // HERO — always generated
    if (!options?.slotsFilter || options.slotsFilter.includes('HERO_IMAGE')) {
      const heroRow = this.buildPromptRow(
        'HERO_IMAGE',
        pgId,
        pgAlias,
        pgName,
        ragData,
        0, // budget_cost = 0 for hero
        true, // always selected
        null, // no priority rank
        scores.get('HERO_IMAGE') ?? 0,
      );
      if (heroRow) {
        rows.push(heroRow);
        result.slotsGenerated.push('HERO_IMAGE');
      }
    }

    // In-article slots
    for (const slotId of IN_ARTICLE_SLOTS) {
      if (options?.slotsFilter && !options.slotsFilter.includes(slotId))
        continue;

      const isSelected = selectedInArticle.includes(slotId);
      const rank = isSelected ? selectedInArticle.indexOf(slotId) + 1 : null;
      const score = scores.get(slotId) ?? 0;

      if (score === 0) {
        result.slotsSkipped.push(slotId);
        continue;
      }

      const row = this.buildPromptRow(
        slotId,
        pgId,
        pgAlias,
        pgName,
        ragData,
        1, // budget_cost = 1
        isSelected,
        rank,
        score,
      );
      if (row) {
        rows.push(row);
        result.slotsGenerated.push(slotId);
      } else {
        result.slotsSkipped.push(slotId);
      }
    }

    if (rows.length === 0) {
      return {
        ...result,
        status: 'skipped',
        reason: 'No prompts could be generated (RAG data insufficient)',
      };
    }

    // Upsert to DB
    const { error } = await this.supabase
      .from('__seo_r3_image_prompts')
      .upsert(rows, { onConflict: 'rip_pg_id,rip_slot_id' });

    if (error) {
      this.logger.error(`Upsert failed for ${pgAlias}: ${error.message}`);
      return { ...result, status: 'failed', reason: error.message };
    }

    this.logger.log(
      `Generated ${rows.length} prompts for ${pgAlias} (selected: ${selectedInArticle.join(', ')})`,
    );
    return result;
  }

  async generateBatch(
    pgAliases: string[],
    options?: { force?: boolean; slotsFilter?: string[] },
  ): Promise<R3ImagePromptBatchResult> {
    // Fetch pg_id + pg_name for all aliases
    const { data: gammes, error } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .in('pg_alias', pgAliases);

    if (error || !gammes) {
      this.logger.error(`Failed to fetch gammes: ${error?.message}`);
      return {
        processed: 0,
        generated: 0,
        skipped: 0,
        failed: pgAliases.length,
        items: pgAliases.map((a) => ({
          pgAlias: a,
          status: 'failed' as const,
          slotsGenerated: [],
          slotsSkipped: [],
          inArticleSelected: [],
          reason: 'DB lookup failed',
        })),
      };
    }

    const gammeMap = new Map(
      gammes.map((g) => [g.pg_alias, { pgId: g.pg_id, pgName: g.pg_name }]),
    );

    const batch: R3ImagePromptBatchResult = {
      processed: 0,
      generated: 0,
      skipped: 0,
      failed: 0,
      items: [],
    };

    for (const alias of pgAliases) {
      batch.processed++;
      const gamme = gammeMap.get(alias);
      if (!gamme) {
        batch.failed++;
        batch.items.push({
          pgAlias: alias,
          status: 'failed',
          slotsGenerated: [],
          slotsSkipped: [],
          inArticleSelected: [],
          reason: 'Gamme not found in DB',
        });
        continue;
      }

      const result = await this.generateForGamme(
        gamme.pgId,
        alias,
        gamme.pgName,
        options,
      );
      batch.items.push(result);
      if (result.status === 'generated') batch.generated++;
      else if (result.status === 'skipped') batch.skipped++;
      else batch.failed++;
    }

    return batch;
  }

  async listPrompts(filters: {
    status?: string;
    slot_id?: string;
    pg_alias?: string;
    selected_only?: boolean;
    limit: number;
    offset: number;
  }) {
    let query = this.supabase
      .from('__seo_r3_image_prompts')
      .select('*', { count: 'exact' });

    if (filters.status) query = query.eq('rip_status', filters.status);
    if (filters.slot_id) query = query.eq('rip_slot_id', filters.slot_id);
    if (filters.pg_alias) query = query.eq('rip_pg_alias', filters.pg_alias);
    if (filters.selected_only) query = query.eq('rip_selected', true);

    query = query
      .order('rip_pg_alias')
      .order('rip_slot_id')
      .range(filters.offset, filters.offset + filters.limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async getPromptsForGamme(pgAlias: string) {
    const { data, error } = await this.supabase
      .from('__seo_r3_image_prompts')
      .select('*')
      .eq('rip_pg_alias', pgAlias)
      .order('rip_slot_id');

    if (error) throw error;
    return data ?? [];
  }

  async approvePrompt(id: number) {
    const { data, error } = await this.supabase
      .from('__seo_r3_image_prompts')
      .update({ rip_status: 'approved' })
      .eq('rip_id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async setImageUrl(id: number, imageUrl: string) {
    const { data, error } = await this.supabase
      .from('__seo_r3_image_prompts')
      .update({ rip_image_url: imageUrl })
      .eq('rip_id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async exportCsv(filters: {
    status?: string;
    slot_id?: string;
    selected_only?: boolean;
  }): Promise<string> {
    let query = this.supabase
      .from('__seo_r3_image_prompts')
      .select('*')
      .order('rip_pg_alias')
      .order('rip_slot_id');

    if (filters.status) query = query.eq('rip_status', filters.status);
    if (filters.slot_id) query = query.eq('rip_slot_id', filters.slot_id);
    if (filters.selected_only) query = query.eq('rip_selected', true);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const headers = [
      'pg_alias',
      'gamme_name',
      'slot_id',
      'section_id',
      'topic',
      'aspect_ratio',
      'min_width',
      'prompt_text',
      'neg_prompt',
      'alt_text',
      'caption',
      'selected',
      'priority_rank',
      'rag_richness_score',
      'rag_fields_used',
      'status',
      'generated_at',
    ];

    const csvRows = rows.map((r) =>
      [
        r.rip_pg_alias,
        this.csvEscape(r.rip_gamme_name),
        r.rip_slot_id,
        r.rip_section_id,
        r.rip_topic,
        r.rip_aspect_ratio,
        r.rip_min_width,
        this.csvEscape(r.rip_prompt_text),
        this.csvEscape(r.rip_neg_prompt ?? ''),
        this.csvEscape(r.rip_alt_text),
        this.csvEscape(r.rip_caption ?? ''),
        r.rip_selected ? 'true' : 'false',
        r.rip_priority_rank ?? '',
        r.rip_rag_richness_score ?? '',
        (r.rip_rag_fields_used ?? []).join(';'),
        r.rip_status,
        r.rip_generated_at,
      ].join(','),
    );

    // BOM for Excel + header + rows
    return '\uFEFF' + headers.join(',') + '\n' + csvRows.join('\n');
  }

  async exportJson(filters: {
    status?: string;
    slot_id?: string;
    selected_only?: boolean;
  }) {
    let query = this.supabase
      .from('__seo_r3_image_prompts')
      .select('*')
      .order('rip_pg_alias')
      .order('rip_slot_id');

    if (filters.status) query = query.eq('rip_status', filters.status);
    if (filters.slot_id) query = query.eq('rip_slot_id', filters.slot_id);
    if (filters.selected_only) query = query.eq('rip_selected', true);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  // ── Private: RAG reading ──

  private readRagFromDisk(pgAlias: string): string | null {
    const filePath = join(RAG_GAMMES_DIR, `${pgAlias}.md`);
    try {
      if (!existsSync(filePath)) return null;
      return readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private parseRagData(content: string): RagData {
    const fm = this.yamlParser.extractFrontmatterBlock(content);
    if (!fm) return {};
    try {
      const parsed = yaml.load(fm) as Record<string, unknown>;
      return {
        category: parsed.category as string | undefined,
        domain: parsed.domain as RagData['domain'],
        diagnostic: parsed.diagnostic as RagData['diagnostic'],
        maintenance: parsed.maintenance as RagData['maintenance'],
        selection: parsed.selection as RagData['selection'],
        installation: parsed.installation as RagData['installation'],
      };
    } catch {
      this.logger.warn('Failed to parse RAG YAML frontmatter');
      return {};
    }
  }

  // ── Private: Slot richness scoring ──

  private computeSlotRichnessScores(rag: RagData): Map<string, number> {
    const scores = new Map<string, number>();

    // HERO — always score 1 (minimal requirement: domain.role)
    scores.set('HERO_IMAGE', rag.domain?.role ? 1 : 0);

    // S2_SYMPTOM — wear_signs, symptoms count, severity securite
    let s2 = 0;
    if (rag.maintenance?.wear_signs?.length) s2++;
    if ((rag.diagnostic?.symptoms?.length ?? 0) >= 2) s2++;
    if (rag.diagnostic?.symptoms?.some((s) => s.severity === 'securite')) s2++;
    scores.set('S2_SYMPTOM_IMAGE', s2);

    // S3_SCHEMA — criteria count, confusion_with, brands
    let s3 = 0;
    if ((rag.selection?.criteria?.length ?? 0) >= 3) s3++;
    if (rag.domain?.confusion_with?.length) s3++;
    if (rag.selection?.brands?.premium?.length) s3++;
    scores.set('S3_SCHEMA_IMAGE', s3);

    // S4D_FIXATION — steps count, tools, difficulty
    let s4 = 0;
    if ((rag.installation?.steps?.length ?? 0) >= 5) s4++;
    if (rag.installation?.tools?.length) s4++;
    if (
      rag.installation?.difficulty &&
      rag.installation.difficulty !== 'simple'
    )
      s4++;
    scores.set('S4D_SCHEMA_IMAGE', s4);

    return scores;
  }

  private selectInArticleSlots(scores: Map<string, number>): string[] {
    // Sort by score DESC, then by priority order: S2 > S3 > S4D
    const ranked = [...IN_ARTICLE_SLOTS]
      .map((slotId) => ({
        slotId,
        score: scores.get(slotId) ?? 0,
        priority: IN_ARTICLE_SLOTS.indexOf(slotId),
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.priority - b.priority);

    return ranked.slice(0, MAX_IN_ARTICLE_IMAGES).map((s) => s.slotId);
  }

  // ── Private: Prompt builders ──

  private buildPromptRow(
    slotId: string,
    pgId: number,
    pgAlias: string,
    pgName: string,
    rag: RagData,
    budgetCost: number,
    selected: boolean,
    priorityRank: number | null,
    richnessScore: number,
  ): R3ImagePromptRow | null {
    const meta = SLOT_SECTION_MAP[slotId];
    if (!meta) return null;

    const imageSpec = this.getImageSpec(slotId);
    if (!imageSpec && slotId !== 'HERO_IMAGE') return null;

    const spec = imageSpec ?? {
      topic: meta.topic,
      format: 'webp' as const,
      aspect_ratio: '16:9' as const,
      min_width: 1200,
      alt_template: '{gamme_name} : guide complet',
      loading: 'eager' as const,
    };

    let promptText: string;
    let altText: string;
    let caption: string | null = null;
    const fieldsUsed: string[] = [];

    switch (meta.topic) {
      case 'hero_piece':
        ({ promptText, altText, caption } = this.buildHeroPrompt(
          pgName,
          rag,
          spec,
          fieldsUsed,
        ));
        break;
      case 'symptom_visual':
        ({ promptText, altText, caption } = this.buildSymptomPrompt(
          pgName,
          rag,
          spec,
          fieldsUsed,
        ));
        break;
      case 'comparison_schema':
        ({ promptText, altText, caption } = this.buildComparisonPrompt(
          pgName,
          rag,
          spec,
          fieldsUsed,
        ));
        break;
      case 'fixation_schema':
        ({ promptText, altText, caption } = this.buildFixationPrompt(
          pgName,
          rag,
          spec,
          fieldsUsed,
        ));
        break;
      default:
        return null;
    }

    return {
      rip_pg_id: pgId,
      rip_pg_alias: pgAlias,
      rip_gamme_name: pgName,
      rip_slot_id: slotId,
      rip_section_id: meta.sectionId,
      rip_topic: meta.topic,
      rip_aspect_ratio: spec.aspect_ratio,
      rip_min_width: spec.min_width,
      rip_prompt_text: promptText,
      rip_alt_text: altText,
      rip_neg_prompt: NEGATIVE_PROMPT,
      rip_caption: caption,
      rip_budget_cost: budgetCost,
      rip_selected: selected,
      rip_priority_rank: priorityRank,
      rip_rag_fields_used: fieldsUsed,
      rip_rag_richness_score: richnessScore,
      rip_status: 'pending',
    };
  }

  private buildHeroPrompt(
    pgName: string,
    rag: RagData,
    spec: MediaSlotImageContract,
    fieldsUsed: string[],
  ) {
    const roleSnippet = rag.domain?.role
      ? rag.domain.role.split(',')[0].trim().slice(0, 80)
      : '';
    if (rag.domain?.role) fieldsUsed.push('domain.role');

    const categoryHint = rag.category
      ? `automotive ${rag.category} component`
      : 'automotive component';
    if (rag.category) fieldsUsed.push('category');

    const promptText = [
      `Automotive technical photography, white/light grey gradient studio background, professional product shot, sharp focus, 8K resolution.`,
      `Single ${pgName} automotive part, brand new condition, isolated on clean white background, lit from above-left with soft shadows.`,
      roleSnippet ? `Context: ${roleSnippet}.` : '',
      `${categoryHint}, showing key features and surface detail clearly.`,
      `--ar ${spec.aspect_ratio}`,
    ]
      .filter(Boolean)
      .join(' ');

    const altText = spec.alt_template.replace('{gamme_name}', pgName);
    const caption = `${pgName} neuf — vue studio`;

    return { promptText, altText, caption };
  }

  private buildSymptomPrompt(
    pgName: string,
    rag: RagData,
    spec: MediaSlotImageContract,
    fieldsUsed: string[],
  ) {
    const wearSigns = rag.maintenance?.wear_signs ?? [];
    if (wearSigns.length) fieldsUsed.push('maintenance.wear_signs');

    const sign1 = wearSigns[0] ?? 'usure visible';
    const sign2 = wearSigns[1] ?? 'degradation de surface';

    const symptoms = rag.diagnostic?.symptoms ?? [];
    if (symptoms.length) fieldsUsed.push('diagnostic.symptoms');

    const criticalSymptom = symptoms.find((s) => s.severity === 'securite');
    const symptomHint = criticalSymptom
      ? `Critical symptom: ${criticalSymptom.label.slice(0, 60)}.`
      : '';

    const promptText = [
      `Close-up automotive repair photography, macro lens detail, realistic wear damage, natural workshop lighting, shallow depth of field.`,
      `Worn and damaged ${pgName} showing "${sign1}" and "${sign2}", realistic condition on workbench.`,
      symptomHint,
      `Neutral workshop background, no human hands visible, part clearly identifiable.`,
      `--ar ${spec.aspect_ratio}`,
    ]
      .filter(Boolean)
      .join(' ');

    const primarySymptom = sign1.slice(0, 40);
    const altText = spec.alt_template
      .replace('{gamme_name}', pgName)
      .replace('{symptom}', primarySymptom);
    const caption = `${pgName} use — ${sign1.slice(0, 60)}`;

    return { promptText, altText, caption };
  }

  private buildComparisonPrompt(
    pgName: string,
    rag: RagData,
    spec: MediaSlotImageContract,
    fieldsUsed: string[],
  ) {
    const confusion = rag.domain?.confusion_with ?? [];
    if (confusion.length) fieldsUsed.push('domain.confusion_with');

    const criteria = rag.selection?.criteria ?? [];
    if (criteria.length) fieldsUsed.push('selection.criteria');

    // Determine comparison sides
    let variantA = 'Type A';
    let variantB = 'Type B';
    if (confusion.length > 0) {
      variantA = pgName;
      variantB = confusion[0].term;
    } else if (criteria.length >= 2) {
      // Try to extract type variants from criteria text
      const typeMatch = criteria
        .find((c) => c.toLowerCase().includes('type'))
        ?.match(/:\s*(.+?)(?:,|\.|$)/);
      if (typeMatch) {
        const types = typeMatch[1].split(',').map((t) => t.trim());
        if (types.length >= 2) {
          variantA = types[0];
          variantB = types[1];
        }
      }
    }

    const criteriaLabels = criteria
      .slice(0, 3)
      .map((c) => {
        const colonIdx = c.indexOf(':');
        return colonIdx > 0 ? c.slice(0, colonIdx).trim() : c.slice(0, 30);
      })
      .join(', ');

    const promptText = [
      `Technical illustration, clean white background, precise labeled diagram, automotive engineering drawing style, professional, no photorealism.`,
      `Side-by-side comparison schema of "${variantA}" vs "${variantB}" ${pgName !== variantA ? pgName : ''}.`,
      criteriaLabels
        ? `Labeled arrows showing key differences: ${criteriaLabels}.`
        : '',
      `Cross-section or cutaway view if applicable, clean linework, annotation labels in French.`,
      `--ar ${spec.aspect_ratio}`,
    ]
      .filter(Boolean)
      .join(' ');

    const altText = spec.alt_template.replace('{gamme_name}', pgName);
    const caption = `${variantA} vs ${variantB} — schema comparatif`;

    return { promptText, altText, caption };
  }

  private buildFixationPrompt(
    pgName: string,
    rag: RagData,
    spec: MediaSlotImageContract,
    fieldsUsed: string[],
  ) {
    const tools = rag.installation?.tools ?? [];
    if (tools.length) fieldsUsed.push('installation.tools');

    const steps = rag.installation?.steps ?? [];
    if (steps.length) fieldsUsed.push('installation.steps');

    const prerequisite = rag.installation?.prerequisite ?? '';
    if (prerequisite) fieldsUsed.push('installation.prerequisite');

    const tool1 = tools[0] ?? 'cle dynamometrique';
    const tool2 = tools[1] ?? 'cle a douille';

    const firstSteps = steps
      .slice(0, 3)
      .map((s) => s.slice(0, 40))
      .join(', ');

    const promptText = [
      `Automotive workshop technical diagram, exploded view style, clean white background, numbered callouts, professional service manual illustration.`,
      `Exploded diagram of ${pgName} mounting and fixation points.`,
      `Shows ${tool1} and ${tool2} in use, numbered bolt positions, torque indicator arrows.`,
      firstSteps ? `Key steps illustrated: ${firstSteps}.` : '',
      prerequisite ? `Setup: ${prerequisite.slice(0, 60)}.` : '',
      `Component orientation guide, service manual style.`,
      `--ar ${spec.aspect_ratio}`,
    ]
      .filter(Boolean)
      .join(' ');

    const altText = spec.alt_template.replace('{gamme_name}', pgName);
    const caption = `${pgName} — schema de montage et fixation`;

    return { promptText, altText, caption };
  }

  // ── Helpers ──

  private getImageSpec(slotId: string): MediaSlotImageContract | null {
    for (const sectionSlots of Object.values(MEDIA_LAYOUT_CONTRACT)) {
      const slot = sectionSlots.find((s) => s.slot_id === slotId);
      if (slot?.image_spec) return slot.image_spec;
    }
    return null;
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
