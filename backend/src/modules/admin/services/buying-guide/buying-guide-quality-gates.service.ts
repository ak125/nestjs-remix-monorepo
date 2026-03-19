import { Injectable, Logger } from '@nestjs/common';
import {
  type GammeContentQualityFlag,
  MIN_NARRATIVE_LENGTH,
  MAX_NARRATIVE_LENGTH,
  GENERIC_PHRASES,
  FAMILY_REQUIRED_TERMS,
  ACTION_MARKERS,
  MIN_SELECTION_CRITERIA,
  MIN_ANTI_MISTAKES_BUYING_GUIDE as MIN_ANTI_MISTAKES,
  MIN_DECISION_NODES,
  MIN_FAQS,
  MIN_SYMPTOMS,
  MIN_FAQ_ANSWER_LENGTH,
} from '../../../../config/buying-guide-quality.constants';
import type { SectionValidationResult } from './buying-guide.types';

/**
 * Quality validation gates for buying guide enrichment.
 * Pure sync logic — no DB, no I/O.
 */
@Injectable()
export class BuyingGuideQualityGatesService {
  private readonly logger = new Logger(BuyingGuideQualityGatesService.name);

  failedSection(
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

  validateSection(
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
        // Advisory only — most RAG content uses nominal phrases without action verbs
        this.logger.debug(
          `Section ${sectionKey}: no action markers found in anti-mistakes (advisory)`,
        );
        flags.push('ANTI_MISTAKES_NO_ACTION');
      }
    }

    // 7. FAQ answer quality check (advisory, not blocking gate)
    if (sectionKey === 'faq' && Array.isArray(content) && content.length > 0) {
      const answers = (
        content as Array<{ question: string; answer: string }>
      ).map((f) => f.answer?.length || 0);
      const avgLen = answers.reduce((sum, l) => sum + l, 0) / answers.length;
      if (avgLen < MIN_FAQ_ANSWER_LENGTH) {
        flags.push('FAQ_ANSWERS_TOO_SHORT');
      }
    }

    return { ok: flags.length === 0, flags };
  }

  checkAntiWikiGate(sections: Record<string, SectionValidationResult>): {
    ok: boolean;
    reasons: string[];
  } {
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

    // D1: Check guidance is not a mere copy of label in selection_criteria
    if (
      criteria?.ok &&
      Array.isArray(criteria.content) &&
      criteria.content.length > 0
    ) {
      const guidanceCopies = (
        criteria.content as Array<{ label?: string; guidance?: string }>
      ).filter(
        (c) =>
          c.guidance?.trim() === c.label?.trim() + '.' ||
          c.guidance?.trim() === c.label?.trim(),
      );
      if (guidanceCopies.length > criteria.content.length / 2) {
        reasons.push(
          `GUIDANCE_COPIES_LABEL (${guidanceCopies.length}/${criteria.content.length} criteria have guidance identical to label)`,
        );
      }
    }

    // D2: Check anti_mistakes are actual errors, not positive actions
    if (
      antiMistakes?.ok &&
      Array.isArray(antiMistakes.content) &&
      antiMistakes.content.length > 0
    ) {
      const positiveStarters = [
        'remplacement',
        'entretien',
        'nettoyage',
        'controle',
        'verification',
      ];
      const positiveItems = (antiMistakes.content as string[]).filter((m) =>
        positiveStarters.some((p) => m.toLowerCase().startsWith(p)),
      );
      if (positiveItems.length > antiMistakes.content.length / 2) {
        reasons.push(
          `ANTI_MISTAKES_NOT_ERRORS (${positiveItems.length}/${antiMistakes.content.length} items look like positive actions instead of errors to avoid)`,
        );
      }
    }

    // D3: Check use_cases are user profiles, not product types
    const useCases = sections['use_cases'];
    if (
      useCases?.ok &&
      Array.isArray(useCases.content) &&
      useCases.content.length >= 2
    ) {
      const profileMarkers = [
        'conduite',
        'usage',
        'route',
        'urbain',
        'ville',
        'sport',
        'montagne',
        'autoroute',
        'city',
        'highway',
      ];
      const hasProfile = (
        useCases.content as Array<{ id?: string; label?: string }>
      ).some((uc) =>
        profileMarkers.some(
          (m) =>
            uc.id?.toLowerCase().includes(m) ||
            uc.label?.toLowerCase().includes(m),
        ),
      );
      if (!hasProfile) {
        reasons.push(
          'USE_CASES_NOT_PROFILES (use_cases should describe driver profiles, not product types)',
        );
      }
    }

    return { ok: reasons.length === 0, reasons };
  }
}
