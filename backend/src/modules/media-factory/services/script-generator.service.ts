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
      throw new Error(
        'GROQ_API_KEY is not configured — cannot generate script',
      );
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

    // Load RAG context
    const ragContext = await this.loadRagContext(vertical, gammeAlias ?? null);

    // Get system prompt
    const systemPrompt = SCRIPT_SYSTEM_PROMPTS[videoType];
    if (!systemPrompt) {
      throw new Error(`No system prompt for video type: ${videoType}`);
    }

    const userPrompt = buildUserPrompt(
      vertical,
      videoType,
      gammeAlias ?? null,
      ragContext,
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

  private async loadRagContext(
    vertical: string,
    _gammeAlias: string | null,
  ): Promise<string> {
    // Load relevant RAG knowledge docs for the vertical
    let query = this.client
      .from('__rag_knowledge')
      .select('doc_id, title, content, truth_level, domain')
      .in('truth_level', ['L1', 'L2'])
      .order('truth_level', { ascending: true })
      .limit(10);

    // Filter by domain matching the vertical
    if (vertical) {
      query = query.ilike('domain', `%${vertical}%`);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.warn(
        `Failed to load RAG context for ${vertical}: ${error.message}`,
      );
      return 'Aucun contexte RAG disponible.';
    }

    if (!data || data.length === 0) {
      // Fallback: try broader search
      const { data: fallback } = await this.client
        .from('__rag_knowledge')
        .select('doc_id, title, content, truth_level')
        .in('truth_level', ['L1', 'L2'])
        .limit(5);

      if (!fallback || fallback.length === 0) {
        return 'Aucun contexte RAG disponible.';
      }

      return fallback
        .map(
          (doc: Record<string, unknown>) =>
            `## ${doc.title ?? doc.doc_id}\n${String(doc.content ?? '').slice(0, 2000)}`,
        )
        .join('\n\n---\n\n');
    }

    return data
      .map(
        (doc: Record<string, unknown>) =>
          `## ${doc.title ?? doc.doc_id} (${doc.truth_level})\n${String(doc.content ?? '').slice(0, 2000)}`,
      )
      .join('\n\n---\n\n');
  }
}
