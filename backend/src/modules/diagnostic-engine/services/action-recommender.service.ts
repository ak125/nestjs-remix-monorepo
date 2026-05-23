/**
 * ActionRecommender — V1A.0 pure rules
 *
 * intent + EvidencePack + vehicle_ctx_present → recommended_actions[] ordonné par backend.
 *
 * BACKEND est SoT unique : frontend ne tri ni ne filtre les actions.
 * Aucune logique métier dans le frontend.
 *
 * Séquences canon par intent (priority 1 → N) :
 *   urgence       : appel → human_resolution → garage → devis
 *   garage        : garage → devis → appel → guide
 *   maintenance   : guide → entretien_pack → piece → devis
 *   commerce      : piece → entretien_pack → devis → guide
 *   devis         : devis → piece → garage → appel
 *   education     : assistant_diagnostic → faq → guide → devis
 *   reassurance   : faq → guide → entretien_pack → piece
 *   safety_rail ON: (override) human_resolution → assistant_diagnostic → appel → faq
 *
 * Overrides déterministes :
 *   - vehicle_ctx.absent → demote `piece` après `assistant_diagnostic`
 *   - catalog allowed_output_mode = 'none' → drop `piece` entirely
 */
import { Injectable } from '@nestjs/common';
import type { EvidencePack } from '../types/evidence-pack.schema';
import type { DiagnosticIntent } from '../types/diagnostic-intent';
import type {
  ActionType,
  RecommendedAction,
  TargetRole,
} from '../types/recommended-action';
import type { DiagnosticReasonCode } from '../types/diagnostic-reason-code';
import type { IntentResult } from './intent-classifier.service';

type EvidencePackInner = EvidencePack['evidence_pack'];

const SEQUENCES: Record<DiagnosticIntent | 'safety_rail', ActionType[]> = {
  urgence: ['appel', 'human_resolution', 'garage', 'devis'],
  garage: ['garage', 'devis', 'appel', 'guide'],
  maintenance: ['guide', 'entretien_pack', 'piece', 'devis'],
  commerce: ['piece', 'entretien_pack', 'devis', 'guide'],
  devis: ['devis', 'piece', 'garage', 'appel'],
  education: ['assistant_diagnostic', 'faq', 'guide', 'devis'],
  reassurance: ['faq', 'guide', 'entretien_pack', 'piece'],
  safety_rail: [
    'human_resolution',
    'assistant_diagnostic',
    'appel',
    'faq',
  ],
};

const TYPE_TO_TARGET_ROLE: Record<ActionType, TargetRole> = {
  piece: 'R2',
  devis: 'devis',
  appel: 'human',
  garage: 'garage',
  guide: 'R3',
  entretien_pack: 'R2',
  faq: 'R3',
  assistant_diagnostic: 'R3',
  human_resolution: 'human',
};

const LABEL_KEY_BY_TYPE: Record<ActionType, string> = {
  piece: 'diagnostic.action.piece',
  devis: 'diagnostic.action.devis',
  appel: 'diagnostic.action.appel',
  garage: 'diagnostic.action.garage',
  guide: 'diagnostic.action.guide',
  entretien_pack: 'diagnostic.action.entretien_pack',
  faq: 'diagnostic.action.faq',
  assistant_diagnostic: 'diagnostic.action.assistant_diagnostic',
  human_resolution: 'diagnostic.action.human_resolution',
};

@Injectable()
export class ActionRecommenderService {
  /**
   * Pure recommendation. Same input → same output.
   *
   * @returns RecommendedAction[] ordonné par priority ascendante stricte (1..N).
   */
  recommend(
    intent: IntentResult,
    pack: EvidencePackInner,
    vehicleContextPresent: boolean,
  ): RecommendedAction[] {
    const sequenceKey = intent.safety_rail
      ? 'safety_rail'
      : intent.value;
    let sequence = [...SEQUENCES[sequenceKey]];

    // Override #1 : si vehicle absent, déplacer `piece` après `assistant_diagnostic`
    if (!vehicleContextPresent) {
      sequence = this.demotePieceWhenVehicleAbsent(sequence);
    }

    // Override #2 : si catalog allowed_output_mode = 'none', drop `piece` complètement
    if (pack.catalog_guard.allowed_output_mode === 'none') {
      sequence = sequence.filter((a) => a !== 'piece');
    }

    return sequence.map((type, idx) =>
      this.buildAction({
        type,
        priority: idx + 1,
        intent,
        pack,
        vehicleContextPresent,
      }),
    );
  }

  private demotePieceWhenVehicleAbsent(sequence: ActionType[]): ActionType[] {
    const pieceIdx = sequence.indexOf('piece');
    if (pieceIdx === -1) return sequence;

    const assistantIdx = sequence.indexOf('assistant_diagnostic');
    // Si assistant pas présent, append `assistant_diagnostic` puis garder piece à la fin
    if (assistantIdx === -1) {
      const next: ActionType[] = sequence.filter((a) => a !== 'piece');
      next.push('assistant_diagnostic', 'piece');
      return next;
    }

    // Sinon, retirer piece et le ré-insérer juste après assistant_diagnostic
    const next: ActionType[] = sequence.filter((a) => a !== 'piece');
    const newAssistantIdx = next.indexOf('assistant_diagnostic');
    next.splice(newAssistantIdx + 1, 0, 'piece');
    return next;
  }

  private buildAction(params: {
    type: ActionType;
    priority: number;
    intent: IntentResult;
    pack: EvidencePackInner;
    vehicleContextPresent: boolean;
  }): RecommendedAction {
    const { type, priority, intent, pack, vehicleContextPresent } = params;

    const target = this.buildTarget(type, pack);
    const target_role = TYPE_TO_TARGET_ROLE[type];
    const label_key = LABEL_KEY_BY_TYPE[type];
    const confidence = this.computeActionConfidence(type, intent, pack);
    const rationale_codes = this.buildRationaleCodes({
      type,
      priority,
      intent,
      vehicleContextPresent,
    });

    return {
      type,
      priority,
      target,
      label_key,
      confidence,
      rationale_codes,
      target_role,
    };
  }

  /**
   * Stable target par action type.
   * `piece` utilise `pg_id` + `gamme_slug` depuis SuggestedGamme (DB-driven, pas hardcodé).
   */
  private buildTarget(type: ActionType, pack: EvidencePackInner): string {
    switch (type) {
      case 'piece': {
        const gamme = pack.catalog_guard.suggested_gammes?.[0];
        if (gamme?.pg_id && gamme.gamme_slug) {
          return `/pieces/${gamme.gamme_slug}/${gamme.pg_id}`;
        }
        // Fallback dégradé : page gamme générique (jamais hardcodé slug)
        return '/pieces';
      }
      case 'devis':
        return '/devis';
      case 'appel':
        return '/contact';
      case 'garage':
        return '/garages-proches';
      case 'guide': {
        const slug = pack.catalog_guard.suggested_gammes?.[0]?.gamme_slug;
        return slug ? `/conseil/${slug}` : '/conseil';
      }
      case 'entretien_pack':
        return '/entretien';
      case 'faq':
        return '/faq';
      case 'assistant_diagnostic':
        return '/diagnostic-auto';
      case 'human_resolution':
        return '/devis-humain';
    }
  }

  private computeActionConfidence(
    type: ActionType,
    intent: IntentResult,
    pack: EvidencePackInner,
  ): number {
    if (type === 'piece') {
      const conf = pack.catalog_guard.confidence_before_purchase;
      const map = { high: 0.9, medium: 0.7, low: 0.5 } as const;
      return map[conf];
    }
    if (
      type === 'human_resolution' ||
      type === 'appel' ||
      type === 'assistant_diagnostic'
    ) {
      return intent.safety_rail ? 0.95 : 0.8;
    }
    return 0.7;
  }

  private buildRationaleCodes(params: {
    type: ActionType;
    priority: number;
    intent: IntentResult;
    vehicleContextPresent: boolean;
  }): DiagnosticReasonCode[] {
    const { type, priority, intent, vehicleContextPresent } = params;
    const codes: DiagnosticReasonCode[] = [];

    // Top action hérite des reason_codes de l'intent classification
    if (priority === 1) {
      codes.push(...intent.reason_codes);
    }

    // Code de handoff selon target_role
    if (type === 'piece' || type === 'entretien_pack') {
      codes.push('DR_HANDOFF_TO_COMMERCE');
    }
    if (type === 'human_resolution' || type === 'appel') {
      codes.push('DR_HANDOFF_TO_HUMAN');
    }

    // Codes d'override appliqués
    if (!vehicleContextPresent && type === 'piece') {
      codes.push('DR_OVERRIDE_VEHICLE_ABSENT_DEMOTE_PIECE');
    }
    if (intent.value === 'garage' && type === 'garage') {
      codes.push('DR_OVERRIDE_DIFFICULTY_HIGH_PROMOTE_GARAGE');
    }
    if (intent.safety_rail && type === 'human_resolution') {
      codes.push('DR_OVERRIDE_URGENCY_PROMOTE_HUMAN');
    }

    // Dédup pour stabilité analytics
    return [...new Set(codes)];
  }
}
