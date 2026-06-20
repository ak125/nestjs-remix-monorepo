import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  SCRIPT_SYSTEM_PROMPTS,
  buildUserPrompt,
} from './script-generator.prompts';
import type {
  VideoClaimEntry,
  VideoEvidenceEntry,
  DisclaimerPlan,
} from '../types/video.types';

export interface GenerateScriptInput {
  briefId: string;
  videoType: string;
  vertical: string;
  gammeAlias?: string | null;
  regenerate?: boolean;
}

export interface GenerateScriptResult {
  scriptText: string;
  claimCount: number;
  evidenceCount: number;
  estimatedDurationSecs: number;
  model: string;
  artefactsStatus: {
    claimTable: boolean;
    evidencePack: boolean;
    disclaimerPlan: boolean;
    knowledgeContract: boolean;
    narrativeStylePack: boolean;
    derivativePolicy: boolean;
  };
}

@Injectable()
export class ScriptGeneratorService extends SupabaseBaseService {
  protected override readonly logger = new Logger(ScriptGeneratorService.name);
  private readonly groqApiKey: string;
  private readonly groqModel: string;

  constructor(configService: ConfigService) {
    super(configService);
    this.groqApiKey = configService.get<string>('GROQ_API_KEY') ?? '';
    this.groqModel =
      configService.get<string>('SCRIPT_GENERATOR_MODEL') ??
      'llama-3.3-70b-versatile';
  }

  private async callGroq(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    if (!this.groqApiKey) {
      this.logger.warn('GROQ_API_KEY absent — generation video desactivee.');
      throw new Error('Generation video desactivee (LLM externe supprime)');
    }

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.groqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 8000,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Groq');
    }

    return content;
  }

  async generateScript(
    input: GenerateScriptInput,
  ): Promise<GenerateScriptResult> {
    const { briefId, videoType, vertical, gammeAlias, regenerate } = input;

    // Check if script already exists
    if (!regenerate) {
      const { data: existing } = await this.client
        .from('__video_productions')
        .select('script_text')
        .eq('brief_id', briefId)
        .single();

      if (existing?.script_text) {
        throw new Error(
          `Script already exists for ${briefId}. Use regenerate=true to overwrite.`,
        );
      }
    }

    // Load GOVERNED content context (DB __seo_*, NEVER RAG — canon ADR-031/046/086 : RAG=chatbot only).
    const contentContext = await this.loadContentContext(
      vertical,
      gammeAlias ?? null,
    );

    // Get system prompt
    const systemPrompt = SCRIPT_SYSTEM_PROMPTS[videoType];
    if (!systemPrompt) {
      throw new Error(`No system prompt for video type: ${videoType}`);
    }

    const userPrompt = buildUserPrompt(
      vertical,
      videoType,
      gammeAlias ?? null,
      contentContext,
    );

    this.logger.log(
      `Generating script for ${briefId} (${videoType}/${vertical}) with Groq/${this.groqModel}`,
    );

    const content = await this.callGroq(systemPrompt, userPrompt);

    const parsed = JSON.parse(content);

    // Extract artefacts from response
    const scriptText = parsed.script_text ?? '';
    const claimTable: VideoClaimEntry[] = (parsed.claim_table ?? []).map(
      (c: Record<string, unknown>, i: number) => ({
        id: c.id ?? `CLM-${String(i + 1).padStart(3, '0')}`,
        kind: c.kind ?? 'dimension',
        rawText: c.rawText ?? c.raw_text ?? '',
        value: String(c.value ?? ''),
        unit: String(c.unit ?? ''),
        sectionKey: c.sectionKey ?? c.section_key ?? '',
        sourceRef: c.sourceRef ?? c.source_ref ?? null,
        evidenceId: c.evidenceId ?? c.evidence_id ?? null,
        status: c.status ?? 'unverified',
        requiresHumanValidation:
          c.requiresHumanValidation ?? c.requires_human_validation ?? false,
      }),
    );

    const evidencePack: VideoEvidenceEntry[] = (parsed.evidence_pack ?? []).map(
      (e: Record<string, unknown>) => ({
        docId: e.docId ?? e.doc_id ?? '',
        heading: e.heading ?? '',
        charRange: e.charRange ?? e.char_range ?? [0, 0],
        rawExcerpt: e.rawExcerpt ?? e.raw_excerpt ?? '',
        confidence: e.confidence ?? 0.5,
        sourceHash: e.sourceHash ?? e.source_hash ?? undefined,
      }),
    );

    const disclaimerPlan: DisclaimerPlan = parsed.disclaimer_plan ?? {
      disclaimers: [],
    };
    const knowledgeContract = parsed.knowledge_contract ?? null;
    const narrativeStylePack = parsed.narrative_style_pack ?? null;
    const derivativePolicy = parsed.derivative_policy ?? null;
    const estimatedDurationSecs = parsed.estimated_duration_secs ?? 0;

    // Save all artefacts to __video_productions
    const { error } = await this.client
      .from('__video_productions')
      .update({
        script_text: scriptText,
        script_generated_at: new Date().toISOString(),
        script_model: `groq/${this.groqModel}`,
        claim_table: claimTable,
        evidence_pack: evidencePack,
        disclaimer_plan: disclaimerPlan,
        knowledge_contract: knowledgeContract,
        narrative_style_pack: narrativeStylePack,
        derivative_policy: derivativePolicy,
        status: 'pending_review',
        updated_at: new Date().toISOString(),
      })
      .eq('brief_id', briefId);

    if (error) {
      this.logger.error(
        `Failed to save script for ${briefId}: ${error.message}`,
      );
      throw error;
    }

    this.logger.log(
      `Script generated for ${briefId}: ${claimTable.length} claims, ${evidencePack.length} evidences, ~${estimatedDurationSecs}s`,
    );

    return {
      scriptText,
      claimCount: claimTable.length,
      evidenceCount: evidencePack.length,
      estimatedDurationSecs,
      model: `groq/${this.groqModel}`,
      artefactsStatus: {
        claimTable: claimTable.length > 0,
        evidencePack: evidencePack.length > 0,
        disclaimerPlan: (disclaimerPlan.disclaimers?.length ?? 0) > 0,
        knowledgeContract: knowledgeContract !== null,
        narrativeStylePack: narrativeStylePack !== null,
        derivativePolicy: derivativePolicy !== null,
      },
    };
  }

  async updateScript(
    briefId: string,
    updates: {
      scriptText?: string;
      claimTable?: VideoClaimEntry[];
      disclaimerPlan?: DisclaimerPlan;
    },
  ): Promise<{ updatedFields: string[] }> {
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    const updatedFields: string[] = [];

    if (updates.scriptText !== undefined) {
      dbUpdates.script_text = updates.scriptText;
      updatedFields.push('script_text');
    }
    if (updates.claimTable !== undefined) {
      dbUpdates.claim_table = updates.claimTable;
      updatedFields.push('claim_table');
    }
    if (updates.disclaimerPlan !== undefined) {
      dbUpdates.disclaimer_plan = updates.disclaimerPlan;
      updatedFields.push('disclaimer_plan');
    }

    const { error } = await this.client
      .from('__video_productions')
      .update(dbUpdates)
      .eq('brief_id', briefId);

    if (error) {
      throw error;
    }

    return { updatedFields };
  }

  /**
   * Load GOVERNED content context from the canonical content DB (__seo_gamme + __seo_gamme_conseil),
   * resolved by gamme alias. NEVER reads the RAG store (__rag_knowledge) — canon ADR-031/046/086 :
   * RAG = retrieval chatbot only, jamais source de contenu/SEO. Le script vidéo STRUCTURE ce contenu
   * déjà sourcé/gouverné ; il n'invente pas (ADR-086 « le contenu ne crée jamais l'information »).
   */
  private async loadContentContext(
    vertical: string,
    gammeAlias: string | null,
  ): Promise<string> {
    if (!gammeAlias) {
      return 'Aucun contexte contenu gouverné (gammeAlias absent).';
    }

    // Resolve gamme alias -> pg_id (pieces_gamme) — même pattern que le reste du backend.
    const { data: gammeRow, error: gammeErr } = await this.client
      .from('pieces_gamme')
      .select('pg_id')
      .eq('pg_alias', gammeAlias)
      .maybeSingle();

    if (gammeErr || !gammeRow?.pg_id) {
      this.logger.warn(
        `loadContentContext: alias "${gammeAlias}" non résolu (${gammeErr?.message ?? 'introuvable'}).`,
      );
      return 'Aucun contexte contenu gouverné (gamme non résolue).';
    }
    const pgId = String(gammeRow.pg_id);
    const parts: string[] = [];

    // Contenu gamme R1 gouverné (__seo_gamme.sg_content)
    const { data: seoGamme } = await this.client
      .from('__seo_gamme')
      .select('sg_content')
      .eq('sg_pg_id', pgId)
      .maybeSingle();
    if (seoGamme?.sg_content) {
      parts.push(
        `## Contenu gamme (R1)\n${this.stripHtml(String(seoGamme.sg_content)).slice(0, 4000)}`,
      );
    }

    // Sections conseil R3 gouvernées (__seo_gamme_conseil.sgc_content)
    const { data: conseils } = await this.client
      .from('__seo_gamme_conseil')
      .select('sgc_section_type, sgc_content')
      .eq('sgc_pg_id', pgId)
      .limit(12);
    for (const row of (conseils ?? []) as Record<string, unknown>[]) {
      if (row.sgc_content) {
        parts.push(
          `## ${row.sgc_section_type ?? 'conseil'}\n${this.stripHtml(String(row.sgc_content)).slice(0, 2000)}`,
        );
      }
    }

    if (parts.length === 0) {
      return `Aucun contenu gouverné publié pour la gamme "${gammeAlias}" (vertical: ${vertical}).`;
    }

    return parts.join('\n\n---\n\n');
  }

  /** Strip HTML for a clean LLM context (sg_content/sgc_content sont du HTML). */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
