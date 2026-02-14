import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RagProxyService } from '../../rag-proxy/rag-proxy.service';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  SelectionCriterionSchema,
  DecisionNodeSchema,
  FaqItemSchema,
  UseCaseSchema,
  type SectionResult,
  type EnrichmentResult,
} from '../dto/buying-guide-enrich.dto';
import type { GammeContentQualityFlag } from '../../gamme-rest/services/buying-guide-data.service';

// ── Quality gate constants (mirrored from buying-guide-data.service.ts) ──

const MIN_NARRATIVE_LENGTH = 40;
const MAX_NARRATIVE_LENGTH = 420;

const GENERIC_PHRASES = [
  'rôle essentiel',
  'entretien régulier',
  'pièce importante',
  'bon fonctionnement',
  'il est recommandé',
  'il est conseillé',
  'en bon état',
  'pièce indispensable',
];

const FAMILY_REQUIRED_TERMS: Record<string, string[]> = {
  freinage: ['frein', 'freinage', 'distance', 'sécurité'],
  moteur: ['moteur', 'combustion', 'lubrification', 'fiabilité'],
  suspension: ['suspension', 'stabilité', 'amortissement', 'tenue'],
  transmission: ['transmission', 'couple', 'embrayage', 'motricité'],
  electrique: ['électrique', 'charge', 'alimentation', 'batterie'],
  climatisation: ['climatisation', 'froid', 'pression', 'compresseur'],
};

const FLAG_PENALTIES: Record<GammeContentQualityFlag, number> = {
  GENERIC_PHRASES: 18,
  MISSING_REQUIRED_TERMS: 16,
  TOO_SHORT: 10,
  TOO_LONG: 8,
  FAQ_TOO_SMALL: 14,
  SYMPTOMS_TOO_SMALL: 12,
  DUPLICATE_ITEMS: 8,
  MISSING_SOURCE_PROVENANCE: 20,
};

const FAMILY_MARKERS: Record<string, string[]> = {
  freinage: ['frein', 'disque', 'plaquette', 'étrier', 'abs'],
  moteur: ['moteur', 'injecteur', 'distribution', 'lubrification'],
  suspension: ['suspension', 'amortisseur', 'coupelle', 'ressort'],
  transmission: ['embrayage', 'cardan', 'boîte', 'transmission'],
  electrique: ['alternateur', 'batterie', 'démarreur', 'électrique'],
  climatisation: ['climatisation', 'compresseur', 'condenseur', 'évaporateur'],
};

const ACTION_MARKERS = [
  'vérifier',
  'contrôler',
  'choisir',
  'comparer',
  'identifier',
  'confirmer',
  'mesurer',
  'valider',
  'respecter',
  'remplacer',
  'éviter',
  'filtrer',
  'sélectionner',
];

// Min thresholds for anti-wiki gate
const MIN_SELECTION_CRITERIA = 5;
const MIN_ANTI_MISTAKES = 4;
const MIN_DECISION_NODES = 1;
const MIN_FAQS = 3;
const MIN_SYMPTOMS = 3;

// RAG confidence threshold
const MIN_RAG_CONFIDENCE = 0.7;
const MIN_VERIFIED_CONFIDENCE = 0.8;
const MIN_QUALITY_SCORE = 70;

// ── Section definitions ──

interface SectionDef {
  key: string;
  prompt: () => string;
  dbColumn: string;
  parse: (rawText: string) => unknown;
  zodSchema?: z.ZodSchema;
}

const RiskSchema = z.object({
  explanation: z.string().min(20),
  consequences: z.array(z.string().min(5)).min(2),
  costRange: z.string().min(5),
  conclusion: z.string().min(10),
});

interface SectionValidationResult {
  ok: boolean;
  flags: GammeContentQualityFlag[];
  content: unknown;
  sources: string[];
  confidence: number;
  sourcesCitation: string;
  rawAnswer: string;
}

export interface EnrichDryRunSection {
  content: unknown;
  sources: string[];
  confidence: number;
  flags: GammeContentQualityFlag[];
  ok: boolean;
  rawAnswer: string;
}

export interface EnrichDryRunResult {
  pgId: string;
  gammeName: string;
  family: string;
  sections: Record<string, EnrichDryRunSection>;
  qualityScore: number;
  qualityFlags: GammeContentQualityFlag[];
  antiWikiGate: { ok: boolean; reasons: string[] };
  wouldUpdate: boolean;
}

@Injectable()
export class BuyingGuideEnricherService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    BuyingGuideEnricherService.name,
  );

  constructor(
    configService: ConfigService,
    private readonly ragService: RagProxyService,
  ) {
    super(configService);
  }

  /**
   * Enrich one or more buying guides using RAG-sourced content.
   * dryRun=true → returns preview with quality gates
   * dryRun=false → writes to DB
   */
  async enrich(
    pgIds: string[],
    dryRun: boolean,
  ): Promise<(EnrichmentResult | EnrichDryRunResult)[]> {
    const results: (EnrichmentResult | EnrichDryRunResult)[] = [];

    for (const pgId of pgIds) {
      try {
        const result = await this.enrichSingle(pgId, dryRun);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to enrich pgId=${pgId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (dryRun) {
          results.push({
            pgId,
            gammeName: '',
            family: '',
            sections: {},
            qualityScore: 0,
            qualityFlags: [],
            antiWikiGate: {
              ok: false,
              reasons: [
                `ERROR: ${error instanceof Error ? error.message : String(error)}`,
              ],
            },
            wouldUpdate: false,
          } satisfies EnrichDryRunResult);
        }
      }
    }

    return results;
  }

  private async enrichSingle(
    pgId: string,
    dryRun: boolean,
  ): Promise<EnrichmentResult | EnrichDryRunResult> {
    // 1. Fetch gamme metadata
    const meta = await this.fetchGammeMetadata(pgId);
    if (!meta) {
      throw new Error(`Gamme not found for pgId=${pgId}`);
    }
    const { gammeName, family } = meta;

    this.logger.log(
      `Enriching pgId=${pgId} (${gammeName}, family=${family}) dryRun=${dryRun}`,
    );

    // 2. Build section definitions with gamme-specific prompts
    const sections = this.buildSectionDefs(gammeName);

    // 3. Process each section through RAG + quality gates
    const sectionResults: Record<string, SectionValidationResult> = {};
    const allFlags: GammeContentQualityFlag[] = [];

    for (const section of sections) {
      const result = await this.processSection(section, family);
      sectionResults[section.key] = result;
      allFlags.push(...result.flags);
    }

    // 4. Calculate quality score
    const uniqueFlags = [...new Set(allFlags)];
    const penalty = uniqueFlags.reduce(
      (sum, flag) => sum + (FLAG_PENALTIES[flag] || 0),
      0,
    );
    const qualityScore = Math.max(0, 100 - penalty);

    // 5. Anti-wiki gate check
    const antiWikiGate = this.checkAntiWikiGate(sectionResults);

    // 6. DryRun → return preview
    if (dryRun) {
      const dryRunSections: Record<string, EnrichDryRunSection> = {};
      for (const [key, result] of Object.entries(sectionResults)) {
        dryRunSections[key] = {
          content: result.content,
          sources: result.sources,
          confidence: result.confidence,
          flags: result.flags,
          ok: result.ok,
          rawAnswer: result.rawAnswer,
        };
      }

      return {
        pgId,
        gammeName,
        family,
        sections: dryRunSections,
        qualityScore,
        qualityFlags: uniqueFlags,
        antiWikiGate,
        wouldUpdate: qualityScore >= MIN_QUALITY_SCORE && antiWikiGate.ok,
      } satisfies EnrichDryRunResult;
    }

    // 7. Write to DB
    const okSections = Object.entries(sectionResults).filter(([, r]) => r.ok);
    const skippedSections = Object.entries(sectionResults)
      .filter(([, r]) => !r.ok)
      .map(([key]) => key);

    if (okSections.length === 0) {
      return {
        pgId,
        sections: {},
        averageConfidence: 0,
        updated: false,
        sectionsUpdated: 0,
        skippedSections: Object.keys(sectionResults),
      };
    }

    // Build sources URI from all successful sections
    const allSources = okSections.flatMap(([, r]) => r.sources);
    const uniqueSources = [...new Set(allSources)];
    const sourceUri = 'rag://' + uniqueSources.slice(0, 10).join('+');
    const allCitations = okSections
      .map(([, r]) => r.sourcesCitation)
      .filter(Boolean);
    const sourceRef = allCitations.join(' | ');
    const avgConfidence =
      okSections.reduce((sum, [, r]) => sum + r.confidence, 0) /
      okSections.length;

    // Build update payload
    const updatePayload = this.buildUpdatePayload(
      sectionResults,
      sourceUri,
      sourceRef,
      avgConfidence,
      qualityScore,
    );

    await this.upsertBuyingGuide(pgId, updatePayload);

    const resultSections: Record<string, SectionResult> = {};
    for (const [key, result] of Object.entries(sectionResults)) {
      resultSections[key] = {
        content: result.content,
        sources: result.sources,
        confidence: result.confidence,
        sourcesCitation: result.sourcesCitation,
      };
    }

    return {
      pgId,
      sections: resultSections,
      averageConfidence: avgConfidence,
      updated: true,
      sectionsUpdated: okSections.length,
      skippedSections,
    };
  }

  // ── RAG call + parse + validate per section ──

  private async processSection(
    section: SectionDef,
    family: string,
  ): Promise<SectionValidationResult> {
    try {
      // Call RAG
      const ragResponse = await this.ragService.chat({
        message: section.prompt(),
        context: {
          intent_routing: {
            userIntent: 'choose',
            intentFamily: 'catalog',
            pageIntent: 'selection',
          },
        },
      });

      // Check RAG guardrails
      if (!ragResponse.passedGuardrails) {
        this.logger.warn(`Section ${section.key}: RAG guardrails failed`);
        return this.failedSection(section.key, 'RAG guardrails failed');
      }

      if (ragResponse.confidence < MIN_RAG_CONFIDENCE) {
        this.logger.warn(
          `Section ${section.key}: confidence too low (${ragResponse.confidence})`,
        );
        return this.failedSection(
          section.key,
          `Confidence ${ragResponse.confidence} < ${MIN_RAG_CONFIDENCE}`,
        );
      }

      // Parse raw text to structured content
      const parsed = section.parse(ragResponse.answer);

      // Validate with Zod if schema provided
      if (section.zodSchema) {
        const zodResult = section.zodSchema.safeParse(parsed);
        if (!zodResult.success) {
          this.logger.warn(
            `Section ${section.key}: Zod validation failed: ${zodResult.error.message}`,
          );
          return this.failedSection(
            section.key,
            `Zod: ${zodResult.error.issues[0]?.message || 'validation failed'}`,
            ragResponse.answer,
          );
        }
      }

      // Quality gate validation
      const validation = this.validateSection(section.key, parsed, family);

      return {
        ok: validation.ok,
        flags: validation.flags,
        content: parsed,
        sources: ragResponse.sources || [],
        confidence: ragResponse.confidence,
        sourcesCitation: ragResponse.sourcesCitation || '',
        rawAnswer: ragResponse.answer,
      };
    } catch (error) {
      this.logger.error(
        `Section ${section.key} error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.failedSection(
        section.key,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private failedSection(
    _key: string,
    _reason: string,
    rawAnswer = '',
  ): SectionValidationResult {
    return {
      ok: false,
      flags: [],
      content: null,
      sources: [],
      confidence: 0,
      sourcesCitation: '',
      rawAnswer,
    };
  }

  // ── Quality gates (mirrors buying-guide-data.service.ts constants) ──

  private validateSection(
    sectionKey: string,
    content: unknown,
    family: string,
  ): { ok: boolean; flags: GammeContentQualityFlag[] } {
    const flags: GammeContentQualityFlag[] = [];

    // 1. Generic phrases check (text sections)
    if (typeof content === 'string') {
      const lower = content.toLowerCase();
      if (GENERIC_PHRASES.some((g) => lower.includes(g))) {
        flags.push('GENERIC_PHRASES');
      }
    }

    // 2. Family required terms
    if (typeof content === 'string') {
      const required = FAMILY_REQUIRED_TERMS[family] || [];
      const lower = content.toLowerCase();
      if (required.length > 0 && !required.some((t) => lower.includes(t))) {
        flags.push('MISSING_REQUIRED_TERMS');
      }
    }

    // 3. Length checks (narrative sections)
    if (
      typeof content === 'string' &&
      ['intro_role', 'how_to_choose'].includes(sectionKey)
    ) {
      if (content.length < MIN_NARRATIVE_LENGTH) flags.push('TOO_SHORT');
      if (content.length > MAX_NARRATIVE_LENGTH) flags.push('TOO_LONG');
    }

    // 4. Array minimums
    if (
      sectionKey === 'faq' &&
      Array.isArray(content) &&
      content.length < MIN_FAQS
    ) {
      flags.push('FAQ_TOO_SMALL');
    }
    if (
      sectionKey === 'symptoms' &&
      Array.isArray(content) &&
      content.length < MIN_SYMPTOMS
    ) {
      flags.push('SYMPTOMS_TOO_SMALL');
    }

    // 5. Duplicate detection
    if (Array.isArray(content)) {
      const strings = content.map((c) =>
        typeof c === 'string' ? c : JSON.stringify(c),
      );
      if (new Set(strings).size < strings.length) {
        flags.push('DUPLICATE_ITEMS');
      }
    }

    // 6. Action markers check (anti-mistakes, selection_criteria guidance)
    if (sectionKey === 'anti_mistakes' && Array.isArray(content)) {
      const allText = content.join(' ').toLowerCase();
      const hasAction = ACTION_MARKERS.some((m) => allText.includes(m));
      if (!hasAction) {
        // Not a blocking flag, but logged
        this.logger.warn(
          `Section ${sectionKey}: no action markers found in anti-mistakes`,
        );
      }
    }

    return { ok: flags.length === 0, flags };
  }

  private checkAntiWikiGate(
    sections: Record<string, SectionValidationResult>,
  ): { ok: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check selection criteria count
    const criteria = sections['selection_criteria'];
    if (
      !criteria?.ok ||
      !Array.isArray(criteria.content) ||
      criteria.content.length < MIN_SELECTION_CRITERIA
    ) {
      reasons.push(
        `MISSING_SELECTION_CRITERIA (got ${Array.isArray(criteria?.content) ? criteria.content.length : 0}, need ${MIN_SELECTION_CRITERIA})`,
      );
    }

    // Check anti-mistakes count
    const antiMistakes = sections['anti_mistakes'];
    if (
      !antiMistakes?.ok ||
      !Array.isArray(antiMistakes.content) ||
      antiMistakes.content.length < MIN_ANTI_MISTAKES
    ) {
      reasons.push(
        `MISSING_ANTI_MISTAKES (got ${Array.isArray(antiMistakes?.content) ? antiMistakes.content.length : 0}, need ${MIN_ANTI_MISTAKES})`,
      );
    }

    // Check decision tree
    const tree = sections['decision_tree'];
    if (
      !tree?.ok ||
      !Array.isArray(tree.content) ||
      tree.content.length < MIN_DECISION_NODES
    ) {
      reasons.push('MISSING_DECISION_TREE');
    }

    // Check generic without action across all text
    const textChunks: string[] = [];
    for (const [, result] of Object.entries(sections)) {
      if (!result.ok) continue;
      if (typeof result.content === 'string') {
        textChunks.push(result.content);
      }
      if (Array.isArray(result.content)) {
        for (const item of result.content) {
          if (typeof item === 'string') textChunks.push(item);
          if (typeof item === 'object' && item !== null) {
            textChunks.push(JSON.stringify(item));
          }
        }
      }
    }

    const hasGeneric = textChunks.some((chunk) =>
      GENERIC_PHRASES.some((g) => chunk.toLowerCase().includes(g)),
    );
    const hasAction = textChunks.some((chunk) =>
      ACTION_MARKERS.some((m) => chunk.toLowerCase().includes(m)),
    );
    if (hasGeneric && !hasAction) {
      reasons.push('GENERIC_WITHOUT_ACTION');
    }

    return { ok: reasons.length === 0, reasons };
  }

  // ── Section definitions with parse functions ──

  private buildSectionDefs(gammeName: string): SectionDef[] {
    return [
      {
        key: 'intro_role',
        prompt: () =>
          `En 2-3 phrases techniques, explique le rôle du ${gammeName} dans le système de freinage d'un véhicule. Appuie-toi uniquement sur les documents techniques disponibles (catalogues constructeurs, manuels).`,
        dbColumn: 'sgpg_intro_role',
        parse: (raw) => raw.trim(),
        zodSchema: z
          .string()
          .min(MIN_NARRATIVE_LENGTH)
          .max(MAX_NARRATIVE_LENGTH),
      },
      {
        key: 'risk',
        prompt: () =>
          `Quels sont les risques concrets de rouler avec un ${gammeName} usé ? Réponds en JSON avec les champs: "explanation" (texte explicatif), "consequences" (tableau de conséquences), "costRange" (fourchette de coût), "conclusion" (phrase de conclusion). Base-toi uniquement sur les données techniques disponibles.`,
        dbColumn: 'sgpg_risk',
        parse: (raw) => this.parseJsonFromRag(raw, RiskSchema),
        zodSchema: RiskSchema,
      },
      {
        key: 'symptoms',
        prompt: () =>
          `Liste au minimum 5 symptômes observables d'un ${gammeName} défaillant. Pour chaque symptôme, donne une phrase courte et technique. Réponds en JSON: un tableau de chaînes de caractères. Base-toi sur les documents techniques disponibles.`,
        dbColumn: 'sgpg_symptoms',
        parse: (raw) => this.parseArrayFromRag(raw),
        zodSchema: z.array(z.string().min(10)).min(MIN_SYMPTOMS),
      },
      {
        key: 'selection_criteria',
        prompt: () =>
          `Liste au minimum 6 critères techniques à vérifier pour choisir un ${gammeName} compatible. Pour chaque critère, donne en JSON: {"key": "identifiant_technique", "label": "Nom du critère", "guidance": "Conseil de vérification", "priority": "required" ou "recommended"}. Réponds avec un tableau JSON. Base-toi sur les catalogues et manuels techniques.`,
        dbColumn: 'sgpg_selection_criteria',
        parse: (raw) =>
          this.parseJsonFromRag(raw, z.array(SelectionCriterionSchema)),
        zodSchema: z
          .array(SelectionCriterionSchema)
          .min(MIN_SELECTION_CRITERIA),
      },
      {
        key: 'anti_mistakes',
        prompt: () =>
          `Liste au minimum 5 erreurs fréquentes lors de l'achat d'un ${gammeName}. Chaque erreur en 1 phrase actionnable commençant par un verbe d'action (vérifier, contrôler, éviter, mesurer...). Réponds en JSON: un tableau de chaînes. Base-toi sur les documents techniques.`,
        dbColumn: 'sgpg_anti_mistakes',
        parse: (raw) => this.parseArrayFromRag(raw),
        zodSchema: z.array(z.string().min(10)).min(MIN_ANTI_MISTAKES),
      },
      {
        key: 'decision_tree',
        prompt: () =>
          `Construis un arbre de décision en 4-5 étapes pour déterminer si un ${gammeName} doit être remplacé. Chaque étape en JSON: {"id": "step-id", "question": "La question", "options": [{"label": "Option", "outcome": "continue|check|replace|stop", "nextId": "step-suivant", "note": "remarque optionnelle"}]}. Réponds avec un tableau JSON. Base-toi sur les procédures de diagnostic techniques.`,
        dbColumn: 'sgpg_decision_tree',
        parse: (raw) => this.parseJsonFromRag(raw, z.array(DecisionNodeSchema)),
        zodSchema: z.array(DecisionNodeSchema).min(MIN_DECISION_NODES),
      },
      {
        key: 'faq',
        prompt: () =>
          `Réponds aux 5 questions les plus fréquentes sur le ${gammeName}. Chaque réponse doit être technique et factuelle (minimum 20 mots). Réponds en JSON: [{"question": "...", "answer": "..."}]. Base-toi uniquement sur les documents techniques disponibles.`,
        dbColumn: 'sgpg_faq',
        parse: (raw) => this.parseJsonFromRag(raw, z.array(FaqItemSchema)),
        zodSchema: z.array(FaqItemSchema).min(MIN_FAQS),
      },
      {
        key: 'how_to_choose',
        prompt: () =>
          `En 1 paragraphe de 120 à 300 mots, résume la méthode complète pour choisir le bon ${gammeName} pour son véhicule. Inclus les critères de compatibilité, dimensions, type et marque. Base-toi sur les catalogues constructeurs et guides techniques.`,
        dbColumn: 'sgpg_how_to_choose',
        parse: (raw) => raw.trim(),
        zodSchema: z
          .string()
          .min(MIN_NARRATIVE_LENGTH)
          .max(MAX_NARRATIVE_LENGTH),
      },
      {
        key: 'use_cases',
        prompt: () =>
          `Quels types de ${gammeName} pour quels usages ? (ville, autoroute, montagne, sport). Pour chaque usage, donne en JSON: {"id": "usage-id", "label": "Nom de l'usage", "recommendation": "Recommandation technique"}. Réponds avec un tableau JSON.`,
        dbColumn: 'sgpg_use_cases',
        parse: (raw) => this.parseJsonFromRag(raw, z.array(UseCaseSchema)),
        zodSchema: z.array(UseCaseSchema).min(2),
      },
    ];
  }

  // ── RAG response parsers ──

  private parseJsonFromRag<T>(raw: string, schema: z.ZodSchema<T>): T {
    // Try to extract JSON from RAG text response
    const jsonMatch = raw.match(/\[[\s\S]*\]/) || raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in RAG response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return schema.parse(parsed);
  }

  private parseArrayFromRag(raw: string): string[] {
    // Try JSON first
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const arr = JSON.parse(jsonMatch[0]);
        if (Array.isArray(arr)) {
          return arr
            .map((item) =>
              typeof item === 'string' ? item.trim() : String(item).trim(),
            )
            .filter((s) => s.length > 0);
        }
      } catch {
        // Fall through to line parsing
      }
    }

    // Parse as bullet list
    return raw
      .split('\n')
      .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter((line) => line.length >= 10);
  }

  // ── DB operations ──

  private async fetchGammeMetadata(
    pgId: string,
  ): Promise<{ gammeName: string; family: string } | null> {
    const { data, error } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_parent, pg_level')
      .eq('pg_id', pgId)
      .single();

    if (error || !data) {
      this.logger.warn(`Gamme metadata not found for pgId=${pgId}`);
      return null;
    }

    const gammeName = (data.pg_name as string) || 'cette pièce';

    // Infer family key from gamme name using FAMILY_MARKERS
    let family = 'unknown';
    const lower = gammeName.toLowerCase();
    for (const [key, markers] of Object.entries(FAMILY_MARKERS)) {
      if (markers.some((m) => lower.includes(m))) {
        family = key;
        break;
      }
    }

    return { gammeName, family };
  }

  private buildUpdatePayload(
    sections: Record<string, SectionValidationResult>,
    sourceUri: string,
    sourceRef: string,
    avgConfidence: number,
    qualityScore: number,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      sgpg_source_type: 'rag',
      sgpg_source_uri: sourceUri,
      sgpg_source_ref: sourceRef,
      sgpg_source_verified:
        avgConfidence >= MIN_VERIFIED_CONFIDENCE &&
        qualityScore >= MIN_QUALITY_SCORE,
      sgpg_source_verified_by: 'pipeline:rag-enrich',
      sgpg_source_verified_at: new Date().toISOString(),
    };

    // Map each OK section to its DB column
    for (const [key, result] of Object.entries(sections)) {
      if (!result.ok) continue;

      switch (key) {
        case 'intro_role':
          payload.sgpg_intro_role = result.content;
          break;
        case 'risk':
          if (typeof result.content === 'object' && result.content !== null) {
            const risk = result.content as {
              explanation: string;
              consequences: string[];
              costRange: string;
              conclusion: string;
            };
            payload.sgpg_risk_explanation = risk.explanation;
            payload.sgpg_risk_consequences = risk.consequences;
            payload.sgpg_risk_cost_range = risk.costRange;
            payload.sgpg_risk_conclusion = risk.conclusion;
          }
          break;
        case 'symptoms':
          payload.sgpg_symptoms = result.content;
          break;
        case 'selection_criteria':
          payload.sgpg_selection_criteria = result.content;
          break;
        case 'anti_mistakes':
          payload.sgpg_anti_mistakes = result.content;
          break;
        case 'decision_tree':
          payload.sgpg_decision_tree = result.content;
          break;
        case 'faq':
          payload.sgpg_faq = result.content;
          break;
        case 'how_to_choose':
          payload.sgpg_how_to_choose = result.content;
          break;
        case 'use_cases':
          payload.sgpg_use_cases = result.content;
          break;
      }
    }

    return payload;
  }

  private async upsertBuyingGuide(
    pgId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.client
      .from('__seo_gamme_purchase_guide')
      .update(payload)
      .eq('sgpg_pg_id', pgId);

    if (error) {
      this.logger.error(
        `Failed to update buying guide for pgId=${pgId}: ${error.message}`,
      );
      throw new Error(`DB update failed: ${error.message}`);
    }

    this.logger.log(`Buying guide updated for pgId=${pgId}`);
  }
}
