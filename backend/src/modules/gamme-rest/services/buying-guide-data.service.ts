import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { PURCHASE_GUIDE_VALIDATION } from '../../seo/validation/purchase-guide-validation.constants';
import {
  type GammeContentQualityFlag,
  CONTRACT_VERSION,
  BUYING_GUIDE_VERSION,
  MIN_NARRATIVE_LENGTH,
  MAX_NARRATIVE_LENGTH,
  MIN_ANTI_MISTAKES_CONTENT as MIN_ANTI_MISTAKES,
  MIN_ARGUMENTS,
  MIN_SELECTION_CRITERIA as BUYING_GUIDE_MIN_SELECTION_CRITERIA,
  MIN_ANTI_MISTAKES_BUYING_GUIDE as BUYING_GUIDE_MIN_ANTI_MISTAKES,
  MIN_DECISION_NODES as BUYING_GUIDE_MIN_DECISION_NODES,
  ACTION_MARKERS_NORMALIZED as BUYING_GUIDE_ACTION_MARKERS,
  GENERIC_PHRASES,
  FAMILY_REQUIRED_TERMS,
  type FamilyKey,
  FAMILY_MARKERS,
  FLAG_PENALTIES,
  TRUSTED_SOURCE_PREFIXES,
} from '../../../config/buying-guide-quality.constants';

// Re-export type for backward compatibility (other files import it from here)
export type { GammeContentQualityFlag } from '../../../config/buying-guide-quality.constants';
const REQUIRE_BUYING_GUIDE_SOURCE =
  process.env.REQUIRE_BUYING_GUIDE_SOURCE ??
  process.env.REQUIRE_PURCHASE_GUIDE_SOURCE;
const REQUIRE_BUYING_GUIDE_SOURCE_VERIFIED =
  process.env.REQUIRE_BUYING_GUIDE_SOURCE_VERIFIED ??
  process.env.REQUIRE_PURCHASE_GUIDE_SOURCE_VERIFIED;
const BUYING_GUIDE_ALLOW_LEGACY_IMPLICIT_VERIFIED =
  process.env.BUYING_GUIDE_ALLOW_LEGACY_IMPLICIT_VERIFIED ??
  process.env.PURCHASE_GUIDE_ALLOW_LEGACY_IMPLICIT_VERIFIED;
const ENFORCE_SOURCE_PROVENANCE = REQUIRE_BUYING_GUIDE_SOURCE !== 'false';
const ENFORCE_SOURCE_VERIFIED =
  REQUIRE_BUYING_GUIDE_SOURCE_VERIFIED !== 'false';

export interface GammeContentQuality {
  score: number;
  flags: GammeContentQualityFlag[];
  version: typeof CONTRACT_VERSION;
  source: string;
  verified: boolean;
}

export interface GammeBuyingGuideQuality {
  score: number;
  flags: GammeContentQualityFlag[];
  version: typeof BUYING_GUIDE_VERSION;
  source: string;
  verified: boolean;
}

export interface BuyingGuideAntiWikiGateResult {
  ok: boolean;
  reasons: string[];
}

/**
 * Contrat éditorial source (sans H1) lu en DB et converti en buying guide.
 * Le H1 reste piloté uniquement par le SEO/CMS principal.
 */
export interface BuyingGuideContractV1 {
  id: number;
  pgId: string;
  // Section 1: À quoi ça sert
  intro: {
    title: string;
    role: string;
    syncParts: string[];
  };
  // Section 2: Pourquoi c'est critique
  risk: {
    title: string;
    explanation: string;
    consequences: string[];
    costRange: string;
    conclusion: string;
  };
  // Section 3: Quand changer
  timing: {
    title: string;
    years: string;
    km: string;
    note: string;
  };
  // Section 4: Pourquoi acheter chez nous (4 arguments)
  arguments: Array<{
    title: string;
    content: string;
    icon: string;
  }>;
  // Nouvelles sections (sans H1)
  howToChoose: string | null;
  symptoms: string[];
  antiMistakes: string[];
  faq: Array<{ question: string; answer: string }>;
  quality: GammeContentQuality;
  // RAG-enriched structured data (optional — used when DB columns are populated)
  enrichedSelectionCriteria?: GammeBuyingGuideSelectionCriterion[] | null;
  enrichedDecisionTree?: GammeBuyingGuideDecisionNode[] | null;
  enrichedUseCases?: GammeBuyingGuideUseCase[] | null;
  enrichedAntiMistakes?: string[] | null;
}
/** @deprecated utiliser BuyingGuideContractV1 */
export type GammeContentContractV1 = BuyingGuideContractV1;

export interface GammeBuyingGuideDecisionOption {
  label: string;
  outcome: 'continue' | 'check' | 'replace' | 'stop';
  nextId?: string;
  note?: string;
}

export interface GammeBuyingGuideDecisionNode {
  id: string;
  question: string;
  options: GammeBuyingGuideDecisionOption[];
}

export interface GammeBuyingGuideSelectionCriterion {
  key: string;
  label: string;
  guidance: string;
  priority: 'required' | 'recommended';
}

export interface GammeBuyingGuideUseCase {
  id: string;
  label: string;
  recommendation: string;
}

export interface GammeBuyingGuidePairing {
  required: string[];
  recommended: string[];
  checks: string[];
}

export interface GammeBuyingGuideTrustArgument {
  title: string;
  content: string;
  icon: string;
}

export interface GammeBuyingGuideInputs {
  vehicle: string;
  position: string;
  dimensionsOrReference: string;
  discType: string;
  constraints: string[];
}

export interface GammeBuyingGuideOutput {
  selectedSpec: string;
  pairingAdvice: string[];
  warnings: string[];
}

/**
 * Contrat orienté achat (sans H1)
 * Objectif: réduire l'erreur de sélection et accélérer la décision.
 */
export interface GammeBuyingGuideV1 {
  id: number;
  pgId: string;
  inputs: GammeBuyingGuideInputs;
  decisionTree: GammeBuyingGuideDecisionNode[];
  compatibilityRules: string[];
  antiMistakes: string[];
  selectionCriteria: GammeBuyingGuideSelectionCriterion[];
  useCases: GammeBuyingGuideUseCase[];
  pairing: GammeBuyingGuidePairing;
  output: GammeBuyingGuideOutput;
  faq: Array<{ question: string; answer: string }>;
  symptoms: string[];
  trustArguments: GammeBuyingGuideTrustArgument[];
  quality: GammeBuyingGuideQuality;
  sectionSources?: Record<string, 'db' | 'fallback'>;
}

type BuyingGuideContractWithoutQuality = Omit<BuyingGuideContractV1, 'quality'>;

/**
 * Service pour récupérer et fabriquer le contrat buying guide.
 */
@Injectable()
export class BuyingGuideDataService extends SupabaseBaseService {
  protected override readonly logger = new Logger(BuyingGuideDataService.name);

  /**
   * Récupère les données du guide d'achat V2 pour une gamme
   */
  async getBuyingGuideContractV1(
    pgId: string,
  ): Promise<BuyingGuideContractV1 | null> {
    try {
      const baseSelect = `
        sgpg_id,
        sgpg_pg_id,
        sgpg_intro_title,
        sgpg_intro_role,
        sgpg_intro_sync_parts,
        sgpg_risk_title,
        sgpg_risk_explanation,
        sgpg_risk_consequences,
        sgpg_risk_cost_range,
        sgpg_risk_conclusion,
        sgpg_timing_title,
        sgpg_timing_years,
        sgpg_timing_km,
        sgpg_timing_note,
        sgpg_arg1_title,
        sgpg_arg1_content,
        sgpg_arg1_icon,
        sgpg_arg2_title,
        sgpg_arg2_content,
        sgpg_arg2_icon,
        sgpg_arg3_title,
        sgpg_arg3_content,
        sgpg_arg3_icon,
        sgpg_arg4_title,
        sgpg_arg4_content,
        sgpg_arg4_icon,
        sgpg_how_to_choose,
        sgpg_symptoms,
        sgpg_faq,
        sgpg_anti_mistakes,
        sgpg_selection_criteria,
        sgpg_decision_tree,
        sgpg_use_cases
      `;

      const provenanceSelect = `
        ${baseSelect},
        sgpg_source_type,
        sgpg_source_uri,
        sgpg_source_ref,
        sgpg_source_verified,
        sgpg_source_verified_at,
        sgpg_source_verified_by
      `;

      const provenanceQuery = await this.client
        .from('__seo_gamme_purchase_guide')
        .select(provenanceSelect)
        .eq('sgpg_pg_id', pgId)
        .neq('sgpg_is_draft', true)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = provenanceQuery.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let error: any = provenanceQuery.error;

      if (
        error &&
        (String(error.code || '') === '42703' ||
          /column .* does not exist/i.test(String(error.message || '')))
      ) {
        this.logger.warn(
          `Colonnes de provenance absentes sur __seo_gamme_purchase_guide, fallback base select (pgId=${pgId})`,
        );

        const fallbackQuery = await this.client
          .from('__seo_gamme_purchase_guide')
          .select(baseSelect)
          .eq('sgpg_pg_id', pgId)
          .neq('sgpg_is_draft', true)
          .single();

        data = fallbackQuery.data;
        error = fallbackQuery.error;
      }

      if (error) {
        if (error.code === 'PGRST116') {
          // Pas de données pour cette gamme
          this.logger.debug(`Pas de guide d'achat pour gamme ${pgId}`);
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      // Transformer les données brutes en structure V2
      const transformed = this.transformToV2(data);

      // Source pro obligatoire: rejeter le contrat si provenance non fiable
      if (
        ENFORCE_SOURCE_PROVENANCE &&
        transformed.quality.flags.includes('MISSING_SOURCE_PROVENANCE')
      ) {
        this.logger.warn(
          `Guide achat rejeté (source provenance manquante/non fiable) pour gamme ${pgId}`,
        );
        return null;
      }

      return transformed;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du guide d'achat pour gamme ${pgId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Récupère le guide enrichi SANS enforcement de la provenance.
   * Usage: preview admin pour valider le contenu avant activation en prod.
   */
  async getEnrichedGuideRaw(pgId: string): Promise<GammeBuyingGuideV1 | null> {
    try {
      const baseSelect = `
        sgpg_id,
        sgpg_pg_id,
        sgpg_h1_override,
        sgpg_intro_title,
        sgpg_intro_role,
        sgpg_intro_sync_parts,
        sgpg_risk_title,
        sgpg_risk_explanation,
        sgpg_risk_consequences,
        sgpg_risk_cost_range,
        sgpg_risk_conclusion,
        sgpg_timing_title,
        sgpg_timing_years,
        sgpg_timing_km,
        sgpg_timing_note,
        sgpg_arg1_title,
        sgpg_arg1_content,
        sgpg_arg1_icon,
        sgpg_arg2_title,
        sgpg_arg2_content,
        sgpg_arg2_icon,
        sgpg_arg3_title,
        sgpg_arg3_content,
        sgpg_arg3_icon,
        sgpg_arg4_title,
        sgpg_arg4_content,
        sgpg_arg4_icon,
        sgpg_how_to_choose,
        sgpg_symptoms,
        sgpg_faq,
        sgpg_anti_mistakes,
        sgpg_selection_criteria,
        sgpg_decision_tree,
        sgpg_use_cases,
        sgpg_source_type,
        sgpg_source_uri,
        sgpg_source_ref,
        sgpg_source_verified,
        sgpg_source_verified_at,
        sgpg_source_verified_by
      `;

      const { data, error } = await this.client
        .from('__seo_gamme_purchase_guide')
        .select(baseSelect)
        .eq('sgpg_pg_id', pgId)
        .neq('sgpg_is_draft', true)
        .single();

      if (error || !data) return null;

      // Transformer sans rejeter (bypass provenance gate)
      const transformed = this.transformToV2(data);
      return this.toBuyingGuideV1(transformed);
    } catch (error) {
      this.logger.error(
        `Erreur getEnrichedGuideRaw pour gamme ${pgId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Construit le contrat orienté achat à partir du contrat éditorial validé.
   * Ce mapping permet de migrer la data sans casser l'UI existante.
   */
  toBuyingGuideV1(contract: BuyingGuideContractV1): GammeBuyingGuideV1 {
    const base = this.toContentWithoutQuality(contract);
    const familyKey = this.inferFamilyKey(base);
    const gammeName = this.inferGammeName(base);

    // Prefer DB-enriched structured data, fallback to heuristic builders
    const decisionTree = contract.enrichedDecisionTree?.length
      ? contract.enrichedDecisionTree
      : this.buildDecisionTree(contract, gammeName, familyKey);
    const selectionCriteria = contract.enrichedSelectionCriteria?.length
      ? contract.enrichedSelectionCriteria
      : this.buildSelectionCriteria(gammeName, familyKey);
    const useCases =
      contract.enrichedUseCases?.length &&
      contract.enrichedUseCases.every((uc) => uc.recommendation?.trim())
        ? contract.enrichedUseCases
        : this.buildUseCases(familyKey);
    const antiMistakes = contract.enrichedAntiMistakes?.length
      ? contract.enrichedAntiMistakes
      : contract.antiMistakes || [];

    const guide: GammeBuyingGuideV1 = {
      id: contract.id,
      pgId: contract.pgId,
      inputs: this.buildInputs(gammeName, familyKey),
      decisionTree,
      compatibilityRules: this.buildCompatibilityRules(
        contract,
        gammeName,
        familyKey,
      ),
      antiMistakes: antiMistakes.slice(0, 10),
      selectionCriteria,
      useCases,
      pairing: this.buildPairing(contract, familyKey),
      output: this.buildOutput(gammeName, familyKey),
      faq: (contract.faq || []).slice(0, 8),
      symptoms: (contract.symptoms || []).slice(0, 8),
      trustArguments: this.buildTrustArguments(contract),
      quality: {
        score: contract.quality.score,
        flags: [...contract.quality.flags],
        version: BUYING_GUIDE_VERSION,
        source: contract.quality.source,
        verified: contract.quality.verified,
      },
      sectionSources: {
        decisionTree: contract.enrichedDecisionTree?.length ? 'db' : 'fallback',
        selectionCriteria: contract.enrichedSelectionCriteria?.length
          ? 'db'
          : 'fallback',
        useCases: contract.enrichedUseCases?.length ? 'db' : 'fallback',
        antiMistakes: contract.enrichedAntiMistakes?.length ? 'db' : 'fallback',
        faq: 'db',
        symptoms: 'db',
      },
    };

    return this.ensureBuyingGuideRequiredSections(
      guide,
      contract,
      gammeName,
      familyKey,
    );
  }

  /**
   * Génère un contrat orienté achat "safe" quand aucune donnée guide n'est disponible.
   * Objectif: toujours fournir les sections de décision d'achat côté backend.
   * Ce contrat ne contient jamais de H1.
   */
  buildAutoBuyingGuideV1(params: {
    pgId: string;
    pgName?: string | null;
    familyName?: string | null;
  }): GammeBuyingGuideV1 {
    const pgId = this.cleanText(params.pgId || '');
    const fallbackPgId = pgId || '0';
    const gammeName =
      this.cleanText(params.pgName || params.familyName || '') || 'cette pièce';
    const familyName = this.cleanText(params.familyName || '');
    const familyKey = this.inferFamilyKeyFromLabels(gammeName, familyName);

    const contract = this.buildAutoContractV1(
      fallbackPgId,
      gammeName,
      familyKey,
    );
    return this.toBuyingGuideV1(contract);
  }

  /**
   * Quality gate anti-wiki:
   * - >= 5 critères de choix
   * - >= 4 erreurs à éviter
   * - arbre de décision présent
   * - pas de blabla générique sans action
   */
  passesBuyingGuideAntiWikiGate(
    guide: GammeBuyingGuideV1 | null | undefined,
  ): BuyingGuideAntiWikiGateResult {
    const reasons: string[] = [];

    if (!guide) {
      return { ok: false, reasons: ['MISSING_GUIDE'] };
    }

    const validSelectionCriteria = (guide.selectionCriteria || []).filter(
      (item) =>
        this.cleanText(item?.label).length > 0 &&
        this.cleanText(item?.guidance).length > 0,
    );
    if (validSelectionCriteria.length < BUYING_GUIDE_MIN_SELECTION_CRITERIA) {
      reasons.push('MISSING_SELECTION_CRITERIA');
    }

    const antiMistakesCount = this.dedupeStrings(guide.antiMistakes || [])
      .values.length;
    if (antiMistakesCount < BUYING_GUIDE_MIN_ANTI_MISTAKES) {
      reasons.push('MISSING_ANTI_MISTAKES');
    }

    const validDecisionNodes = (guide.decisionTree || []).filter((node) => {
      const question = this.cleanText(node?.question);
      const options = (node?.options || []).filter(
        (opt) => this.cleanText(opt?.label).length > 0,
      );
      return question.length > 0 && options.length > 0;
    });
    if (validDecisionNodes.length < BUYING_GUIDE_MIN_DECISION_NODES) {
      reasons.push('MISSING_DECISION_TREE');
    }

    const textChunks = [
      ...(guide.compatibilityRules || []),
      ...(guide.antiMistakes || []),
      ...validSelectionCriteria.map((item) => item.guidance),
      ...(guide.faq || []).flatMap((item) => [item.question, item.answer]),
      ...validDecisionNodes.flatMap((node) => [
        node.question,
        ...(node.options || []).map((opt) => opt.label),
        ...(node.options || []).map((opt) => opt.note || ''),
      ]),
    ]
      .map((value) => this.cleanText(value))
      .filter((value) => value.length > 0);

    const hasGenericChunk = textChunks.some((chunk) =>
      this.containsGenericPhrase(chunk),
    );
    const hasActionableChunk = textChunks.some((chunk) =>
      this.hasActionableMarker(chunk),
    );
    if (hasGenericChunk && !hasActionableChunk) {
      reasons.push('GENERIC_WITHOUT_ACTION');
    }

    return { ok: reasons.length === 0, reasons };
  }

  private toContentWithoutQuality(
    contract: BuyingGuideContractV1,
  ): BuyingGuideContractWithoutQuality {
    return {
      id: contract.id,
      pgId: contract.pgId,
      intro: contract.intro,
      risk: contract.risk,
      timing: contract.timing,
      arguments: contract.arguments,
      howToChoose: contract.howToChoose,
      symptoms: contract.symptoms,
      antiMistakes: contract.antiMistakes,
      faq: contract.faq,
    };
  }

  private buildDecisionTree(
    contract: BuyingGuideContractV1,
    gammeName: string,
    familyKey: FamilyKey | null,
  ): GammeBuyingGuideDecisionNode[] {
    if (familyKey === 'freinage') {
      return [
        {
          id: 'vehicle-identification',
          question: 'Le véhicule est-il identifié avec certitude ?',
          options: [
            { label: 'Oui', outcome: 'continue', nextId: 'axle-position' },
            {
              label: 'Non',
              outcome: 'check',
              note: 'Demander plaque/VIN ou au minimum: marque, modèle, année, motorisation, puissance, type de frein arrière (disque/tambour), diamètre jante.',
            },
          ],
        },
        {
          id: 'axle-position',
          question: 'Quel essieu est concerné (avant ou arrière) ?',
          options: [
            {
              label: 'Avant',
              outcome: 'continue',
              nextId: 'original-disc-type',
            },
            {
              label: 'Arrière - disque classique',
              outcome: 'continue',
              nextId: 'original-disc-type',
            },
            {
              label: 'Arrière - disque avec tambour intégré (frein de parking)',
              outcome: 'continue',
              nextId: 'original-disc-type',
              note: 'Vérifier la configuration de frein de parking avant sélection.',
            },
          ],
        },
        {
          id: 'original-disc-type',
          question:
            "Le type de disque imposé par le montage d'origine est-il confirmé (plein/ventilé) ?",
          options: [
            {
              label: "Oui, type d'origine confirmé",
              outcome: 'continue',
              nextId: 'critical-dimensions',
            },
            {
              label: 'Je souhaite upgrader (perforé/rainuré)',
              outcome: 'check',
              nextId: 'critical-dimensions',
              note: 'Contrôler épaisseur, offset, entraxe, alésage, hauteur, diamètre et compatibilité étrier/porte-étrier.',
            },
            {
              label: 'Type non confirmé',
              outcome: 'check',
              note: "Vérifier la référence d'origine avant commande.",
            },
          ],
        },
        {
          id: 'critical-dimensions',
          question:
            'Les cotes critiques correspondent-elles (Ø, épaisseur neuf/mini, hauteur H, entraxe/nb trous, alésage central, déport offset) ?',
          options: [
            {
              label: 'Oui, toutes les cotes correspondent',
              outcome: 'continue',
              nextId: 'replacement',
            },
            {
              label: 'Une cote ne correspond pas',
              outcome: 'stop',
              note: 'STOP: incompatibilité probable, ne pas commander.',
            },
            {
              label: 'Une cote reste incertaine',
              outcome: 'check',
              note: 'Mesurer/contrôler la cote manquante avant validation panier.',
            },
          ],
        },
        {
          id: 'replacement',
          question: `Faut-il remplacer ${gammeName} maintenant ?`,
          options: [
            {
              label: `Oui, symptômes présents (${contract.symptoms?.[0] || 'vibrations/bruit au freinage'})`,
              outcome: 'replace',
            },
            {
              label: 'Non, seulement contrôle préventif',
              outcome: 'check',
              note: 'Planifier un contrôle atelier des tolérances avant prochain entretien.',
            },
          ],
        },
      ];
    }

    const specLabel =
      'Référence constructeur et contraintes de montage correspondent';
    const replaceHint =
      contract.symptoms?.[0] || 'Symptômes persistants malgré usage normal';

    return [
      {
        id: 'vehicle',
        question:
          'Votre véhicule est-il identifié précisément (marque, modèle, type, année) ?',
        options: [
          { label: 'Oui', outcome: 'continue', nextId: 'compatibility' },
          {
            label: 'Non',
            outcome: 'check',
            note: 'Récupérez les données carte grise avant commande.',
          },
        ],
      },
      {
        id: 'compatibility',
        question: specLabel,
        options: [
          { label: 'Oui', outcome: 'continue', nextId: 'replacement' },
          {
            label: 'Je ne suis pas certain',
            outcome: 'check',
            note: 'Validez les dimensions/référence avant validation panier.',
          },
          {
            label: 'Non',
            outcome: 'stop',
            note: `Ne pas commander ${gammeName} tant que la compatibilité n'est pas confirmée.`,
          },
        ],
      },
      {
        id: 'replacement',
        question: `Faut-il remplacer ${gammeName} maintenant ?`,
        options: [
          {
            label: `Oui, symptômes présents (${replaceHint})`,
            outcome: 'replace',
          },
          {
            label: 'Non, seulement contrôle préventif',
            outcome: 'check',
            note: 'Contrôlez les tolérances constructeur à la prochaine révision.',
          },
        ],
      },
    ];
  }

  private buildInputs(
    gammeName: string,
    familyKey: FamilyKey | null,
  ): GammeBuyingGuideInputs {
    if (familyKey === 'freinage') {
      return {
        vehicle:
          'Identifier le véhicule via immatriculation, VIN ou type mine. À défaut: marque, modèle, année, motorisation, puissance, type de frein arrière (disque/tambour), diamètre jante.',
        position: "Préciser l'essieu: avant ou arrière.",
        dimensionsOrReference:
          'Valider diamètre, épaisseur (neuf/mini), hauteur H, entraxe/nb trous, alésage central, offset et référence OEM/WVA/PR avant commande.',
        discType:
          'Confirmer le type de disque (plein/ventilé, puis percé/rainuré si usage spécifique).',
        constraints: [
          "Vérifier la compatibilité jante et l'encombrement étrier.",
          'Contrôler les contraintes de montage sur le train concerné.',
          'Vérifier les systèmes associés (ABS/ESP, frein de parking arrière si concerné).',
        ],
      };
    }

    return {
      vehicle:
        'Identifier précisément véhicule, motorisation, année et variante.',
      position:
        'Identifier la position/zone concernée par le remplacement sur le véhicule.',
      dimensionsOrReference:
        'Comparer référence constructeur et cotes de montage avant validation.',
      discType: `Confirmer la version exacte de ${gammeName} requise pour le véhicule.`,
      constraints: [
        "Vérifier les contraintes d'encombrement et de fixation.",
        'Contrôler la compatibilité avec les pièces associées.',
      ],
    };
  }

  private buildOutput(
    gammeName: string,
    familyKey: FamilyKey | null,
  ): GammeBuyingGuideOutput {
    if (familyKey === 'freinage') {
      return {
        selectedSpec:
          "Sélection d'un disque compatible (essieu, diamètre, épaisseur, hauteur H, entraxe/nb trous, alésage, offset, type, perçage/référence).",
        pairingAdvice: [
          'Remplacer les disques toujours par paire sur le même essieu (avant ensemble ou arrière ensemble).',
          'Recommandation forte: remplacer disques et plaquettes ensemble pour limiter bruit, glaçage et usure accélérée.',
          'Appliquer la procédure de montage constructeur puis un rodage progressif sur 200 à 300 km selon usage (éviter les freinages violents répétés au début).',
        ],
        warnings: [
          "Arrêt du choix si une cote ou référence n'est pas confirmée.",
          'Alerte incompatibilité si conflit essieu, type ou dimensions.',
          'Validation atelier recommandée en cas de doute sur montage ou symptômes.',
        ],
      };
    }

    return {
      selectedSpec: `Sélection d'une référence ${gammeName} compatible avec le véhicule.`,
      pairingAdvice: [
        'Vérifier les pièces associées pour un remplacement cohérent.',
        'Respecter la procédure constructeur et les couples de serrage.',
      ],
      warnings: [
        'Bloquer la commande si la compatibilité de référence reste incertaine.',
      ],
    };
  }

  private buildCompatibilityRules(
    contract: BuyingGuideContractV1,
    gammeName: string,
    familyKey: FamilyKey | null,
  ): string[] {
    const baseRules = [
      `Toujours valider ${gammeName} avec la configuration véhicule complète.`,
      ...((contract.intro?.syncParts || []).map(
        (item) => `Contrôler la cohérence avec ${item}.`,
      ) as string[]),
      ...((contract.antiMistakes || []).filter((item) =>
        /\b(compatibil|référence|reference|dimension|montage|paire|essieu)\b/i.test(
          item,
        ),
      ) as string[]),
    ];

    if (familyKey === 'freinage') {
      baseRules.push(
        'Ne pas mélanger des références de disques non équivalentes sur le même essieu.',
      );
      baseRules.push(
        'Le remplacement se fait par paire sur le même essieu pour conserver un freinage équilibré.',
      );
      baseRules.push(
        'Vérifier sur le train arrière la présence éventuelle d’un tambour intégré pour le frein de parking.',
      );
      baseRules.push(
        'Gauche/droite sont généralement identiques sur un essieu, mais contrôler les exceptions constructeur.',
      );
    }

    const deduped = this.dedupeStrings(baseRules).values;
    if (deduped.length >= 3) {
      return deduped.slice(0, 8);
    }

    return this.dedupeStrings([
      ...deduped,
      ...this.fallbackCompatibilityRules(gammeName, familyKey),
    ]).values.slice(0, 8);
  }

  private buildSelectionCriteria(
    gammeName: string,
    familyKey: FamilyKey | null,
  ): GammeBuyingGuideSelectionCriterion[] {
    if (familyKey === 'freinage') {
      return [
        {
          key: 'diameter',
          label: 'Diamètre disque',
          guidance: 'Doit correspondre exactement à la monte véhicule.',
          priority: 'required',
        },
        {
          key: 'thickness',
          label: 'Épaisseur et cote mini',
          guidance:
            'Vérifier l’épaisseur nominale et la tolérance constructeur.',
          priority: 'required',
        },
        {
          key: 'disc-type',
          label: 'Type de disque',
          guidance:
            'Plein, ventilé, percé ou rainuré selon la référence d’origine.',
          priority: 'required',
        },
        {
          key: 'height',
          label: 'Hauteur H',
          guidance:
            'Comparer la hauteur H avec la cote constructeur avant montage.',
          priority: 'required',
        },
        {
          key: 'bolt-pattern',
          label: 'Entraxe / nombre de trous',
          guidance:
            "Vérifier entraxe et nombre de trous pour éviter l'incompatibilité de fixation.",
          priority: 'required',
        },
        {
          key: 'center-bore',
          label: 'Alésage central',
          guidance:
            "Contrôler l'alésage central pour garantir un centrage correct du disque.",
          priority: 'required',
        },
        {
          key: 'offset',
          label: 'Déport (offset)',
          guidance:
            "Valider le déport (offset) pour préserver l'alignement avec l'étrier.",
          priority: 'required',
        },
        {
          key: 'axle',
          label: 'Essieu',
          guidance: 'Identifier avant/arrière avant toute validation.',
          priority: 'required',
        },
        {
          key: 'parking-brake-drum',
          label: 'Arrière avec tambour intégré',
          guidance:
            "Sur l'essieu arrière, vérifier la présence d'un tambour de frein de parking intégré si applicable.",
          priority: 'required',
        },
        {
          key: 'left-right-config',
          label: 'Configuration gauche/droite',
          guidance:
            'Sur certaines configurations, valider explicitement la référence côté gauche/droite.',
          priority: 'required',
        },
        {
          key: 'heat-dissipation',
          label: 'Capacité de dissipation',
          guidance:
            'Comparer ventilation, masse et capacité thermique selon usage (ville, route, charge).',
          priority: 'recommended',
        },
        {
          key: 'fade-resistance',
          label: 'Résistance au fading',
          guidance:
            'Prioriser les références qui gardent une constance de freinage sous forte chauffe.',
          priority: 'recommended',
        },
        {
          key: 'nvh-comfort',
          label: 'Confort bruit/vibrations',
          guidance:
            'Évaluer le compromis performance/confort pour limiter vibrations, sifflements et à-coups.',
          priority: 'recommended',
        },
        {
          key: 'service-life',
          label: 'Durée de vie',
          guidance:
            'Comparer qualité matière, finition et stabilité à long terme selon votre conduite.',
          priority: 'recommended',
        },
        {
          key: 'anti-corrosion-coating',
          label: 'Revêtement anticorrosion',
          guidance:
            'Privilégier un revêtement anticorrosion (bol/voile) en environnement humide ou salin.',
          priority: 'recommended',
        },
        {
          key: 'machining-quality',
          label: 'Qualité d’usinage',
          guidance:
            "Vérifier la planéité et l'équilibrage pour réduire les risques de voile et vibrations.",
          priority: 'recommended',
        },
        {
          key: 'range-positioning',
          label: 'Marque et gamme',
          guidance:
            'Arbitrer entre OEM, premium et performance selon usage réel, budget et maintenance.',
          priority: 'recommended',
        },
        {
          key: 'total-cost',
          label: 'Coût total intervention',
          guidance:
            "Calculer disque + plaquettes + main d'œuvre pour comparer le coût complet plutôt que le prix unitaire.",
          priority: 'recommended',
        },
        {
          key: 'return-risk',
          label: 'Risque de retour',
          guidance:
            "Le risque d'incompatibilité augmente fortement si le véhicule est mal identifié (VIN/plaque).",
          priority: 'recommended',
        },
        {
          key: 'expected-longevity',
          label: 'Longévité attendue',
          guidance:
            'Projeter la durée de vie selon style de conduite, charge, relief et fréquence de freinage.',
          priority: 'recommended',
        },
        {
          key: 'usage',
          label: 'Usage véhicule',
          guidance:
            'Ajuster la gamme selon ville, autoroute, montagne, charge.',
          priority: 'recommended',
        },
      ];
    }

    return [
      {
        key: 'oe-ref',
        label: 'Référence constructeur',
        guidance: `Vérifier la correspondance OE pour ${gammeName}.`,
        priority: 'required',
      },
      {
        key: 'dimensions',
        label: 'Contraintes dimensionnelles',
        guidance: 'Contrôler les cotes et interfaces de montage.',
        priority: 'required',
      },
      {
        key: 'vehicle-version',
        label: 'Version véhicule',
        guidance: 'Confirmer année, motorisation et variante avant validation.',
        priority: 'required',
      },
      {
        key: 'mounting',
        label: 'Interface de montage',
        guidance: 'Comparer fixations, connectiques et sens de montage.',
        priority: 'required',
      },
      {
        key: 'usage',
        label: 'Contexte d’usage',
        guidance:
          'Choisir la qualité selon usage urbain, route, charge et fréquence.',
        priority: 'recommended',
      },
    ];
  }

  private buildUseCases(
    familyKey: FamilyKey | null,
  ): GammeBuyingGuideUseCase[] {
    if (familyKey === 'freinage') {
      return [
        {
          id: 'city',
          label: 'Ville',
          recommendation:
            'Privilégier des disques stables à froid et résistants aux cycles arrêt/redémarrage.',
        },
        {
          id: 'highway',
          label: 'Autoroute',
          recommendation:
            'Favoriser l’endurance thermique pour les freinages prolongés à vitesse élevée.',
        },
        {
          id: 'mountain',
          label: 'Montagne',
          recommendation:
            'Priorité au refroidissement (disques ventilés) et à la tenue en température.',
        },
        {
          id: 'sport-towing',
          label: 'Sport / Remorquage',
          recommendation:
            'Choisir une monte à capacité thermique renforcée et vérifier les pièces associées.',
        },
      ];
    }

    return [
      {
        id: 'daily',
        label: 'Usage quotidien',
        recommendation:
          "Privilégier la référence conforme à l'usage majoritaire du véhicule.",
      },
      {
        id: 'mixed',
        label: 'Usage mixte',
        recommendation:
          'Vérifier le compromis fiabilité/performance avant validation.',
      },
      {
        id: 'intensive',
        label: 'Usage intensif',
        recommendation:
          'Choisir une qualité renforcée et suivre les intervalles de contrôle atelier.',
      },
    ];
  }

  private buildPairing(
    contract: BuyingGuideContractV1,
    familyKey: FamilyKey | null,
  ): GammeBuyingGuidePairing {
    const required: string[] = [];
    const recommended = this.dedupeStrings(
      contract.intro?.syncParts || [],
    ).values;
    const checks: string[] = [];

    if (familyKey === 'freinage') {
      required.push(
        'Remplacement obligatoire par paire sur le même essieu (avant ensemble / arrière ensemble).',
      );
      required.push(
        'Recommandation forte: remplacer disques et plaquettes ensemble, puis contrôler le système de guidage avant remontage.',
      );
      required.push(
        "Vérifier la présence d'un capteur d'usure si la monte véhicule en est équipée.",
      );
      checks.push(
        'Valider couple de serrage et propreté des surfaces de contact.',
      );
      checks.push(
        'Contrôler l’absence de voile et respecter un rodage progressif sur 200 à 300 km selon usage.',
      );
      checks.push("Confirmer le branchement du capteur d'usure quand présent.");
    } else {
      required.push(
        'Vérifier les références des pièces associées avant montage.',
      );
      checks.push(
        'Respecter la procédure constructeur et les couples de serrage.',
      );
    }

    if (familyKey === 'freinage' && recommended.length === 0) {
      recommended.push(
        'plaquettes de frein',
        'étriers',
        "capteur d'usure (si équipé)",
      );
    }

    return {
      required: this.dedupeStrings(required).values.slice(0, 6),
      recommended: this.dedupeStrings(recommended).values.slice(0, 6),
      checks: this.dedupeStrings(checks).values.slice(0, 6),
    };
  }

  private buildTrustArguments(
    contract: BuyingGuideContractV1,
  ): GammeBuyingGuideTrustArgument[] {
    const mapped: GammeBuyingGuideTrustArgument[] = (
      contract.arguments || []
    ).map((item) => ({
      title: item.title,
      content: item.content,
      icon: item.icon || 'check-circle',
    }));

    const ensureTrustTopic = (
      matcher: RegExp,
      fallback: GammeBuyingGuideTrustArgument,
    ) => {
      const exists = mapped.some((item) =>
        matcher.test(`${item.title} ${item.content}`),
      );
      if (!exists) mapped.push(fallback);
    };

    ensureTrustTopic(/(oe|oem|origine)/i, {
      title: 'Qualité OE/OEM contrôlée',
      content:
        'Références alignées sur les spécifications constructeur pour limiter les erreurs de choix.',
      icon: 'shield-check',
    });
    ensureTrustTopic(/(tol[eé]rance|cote|dimension|montage)/i, {
      title: 'Tolérances de montage maîtrisées',
      content:
        'Points de contrôle dimensionnels et montage rappelés avant validation panier.',
      icon: 'list-check',
    });
    ensureTrustTopic(/(retour|[eé]change)/i, {
      title: 'Retours et échanges facilités',
      content:
        'Processus de retour clair en cas de référence inadaptée malgré les contrôles.',
      icon: 'refresh-ccw',
    });
    ensureTrustTopic(/(livraison|exp[eé]dition|transport)/i, {
      title: 'Livraison rapide',
      content:
        'Disponibilités et expédition suivie pour réduire l’immobilisation du véhicule.',
      icon: 'truck',
    });

    if (contract.quality?.source) {
      mapped.push({
        title: 'Source technique tracée',
        content: `Contrat alimenté depuis une source tracée: ${contract.quality.source}.`,
        icon: 'shield-check',
      });
    }

    const unique = new Map<string, GammeBuyingGuideTrustArgument>();
    for (const item of mapped) {
      const key = this.normalizeForMatch(`${item.title}|${item.content}`);
      if (!unique.has(key)) {
        unique.set(key, item);
      }
    }

    return Array.from(unique.values()).slice(0, 6);
  }

  /**
   * Transforme les données brutes de la DB en structure V2
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformToV2(raw: any): BuyingGuideContractV1 {
    // Construire le tableau d'arguments (4 max)
    const args: Array<{ title: string; content: string; icon: string }> = [];

    if (raw.sgpg_arg1_title && raw.sgpg_arg1_content) {
      args.push({
        title: raw.sgpg_arg1_title,
        content: raw.sgpg_arg1_content,
        icon: raw.sgpg_arg1_icon || 'check-circle',
      });
    }
    if (raw.sgpg_arg2_title && raw.sgpg_arg2_content) {
      args.push({
        title: raw.sgpg_arg2_title,
        content: raw.sgpg_arg2_content,
        icon: raw.sgpg_arg2_icon || 'shield-check',
      });
    }
    if (raw.sgpg_arg3_title && raw.sgpg_arg3_content) {
      args.push({
        title: raw.sgpg_arg3_title,
        content: raw.sgpg_arg3_content,
        icon: raw.sgpg_arg3_icon || 'currency-euro',
      });
    }
    if (raw.sgpg_arg4_title && raw.sgpg_arg4_content) {
      args.push({
        title: raw.sgpg_arg4_title,
        content: raw.sgpg_arg4_content,
        icon: raw.sgpg_arg4_icon || 'cube',
      });
    }

    // Parser syncParts et consequences (peuvent être TEXT[] ou JSONB)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseSyncParts = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [val];
        }
      }
      return [];
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseConsequences = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [val];
        }
      }
      return [];
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseFaq = (
      val: any,
    ): Array<{ question: string; answer: string }> => {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val
          .map((item) => ({
            question: String(item?.question || '').trim(),
            answer: String(item?.answer || '').trim(),
          }))
          .filter((item) => item.question.length > 0 && item.answer.length > 0);
      }
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          if (!Array.isArray(parsed)) return [];
          return parsed
            .map((item) => ({
              question: String(item?.question || '').trim(),
              answer: String(item?.answer || '').trim(),
            }))
            .filter(
              (item) => item.question.length > 0 && item.answer.length > 0,
            );
        } catch {
          return [];
        }
      }
      return [];
    };

    const howToChoose = raw.sgpg_how_to_choose?.trim() || null;
    const symptoms = parseSyncParts(raw.sgpg_symptoms);
    const faq = parseFaq(raw.sgpg_faq);

    // Use DB-enriched anti_mistakes if available, otherwise fallback to heuristic
    const dbAntiMistakes = parseSyncParts(raw.sgpg_anti_mistakes);
    const antiMistakes =
      dbAntiMistakes.length > 0
        ? dbAntiMistakes
        : this.buildAntiMistakes({
            howToChoose,
            timingNote: raw.sgpg_timing_note || '',
            riskExplanation: raw.sgpg_risk_explanation || '',
            riskConclusion: raw.sgpg_risk_conclusion || '',
            faq,
          });

    // Parse enriched structured columns (JSONB)
    const parseJsonbArray = <T>(val: unknown): T[] | null => {
      if (!val) return null;
      if (Array.isArray(val)) return val as T[];
      if (typeof val === 'string') {
        try {
          return JSON.parse(val) as T[];
        } catch {
          return null;
        }
      }
      return null;
    };

    const enrichedSelectionCriteria =
      parseJsonbArray<GammeBuyingGuideSelectionCriterion>(
        raw.sgpg_selection_criteria,
      );
    const enrichedDecisionTree = parseJsonbArray<GammeBuyingGuideDecisionNode>(
      raw.sgpg_decision_tree,
    );
    const enrichedUseCases = parseJsonbArray<GammeBuyingGuideUseCase>(
      raw.sgpg_use_cases,
    );

    const content: BuyingGuideContractWithoutQuality = {
      id: raw.sgpg_id,
      pgId: String(raw.sgpg_pg_id),
      intro: {
        title: raw.sgpg_intro_title || 'À quoi ça sert ?',
        role: raw.sgpg_intro_role || '',
        syncParts: parseSyncParts(raw.sgpg_intro_sync_parts),
      },
      risk: {
        title: raw.sgpg_risk_title || 'Pourquoi ne jamais attendre ?',
        explanation: raw.sgpg_risk_explanation || '',
        consequences: parseConsequences(raw.sgpg_risk_consequences),
        costRange: raw.sgpg_risk_cost_range || '',
        conclusion: raw.sgpg_risk_conclusion || '',
      },
      timing: {
        title: raw.sgpg_timing_title || 'Quand faut-il la changer ?',
        years: raw.sgpg_timing_years || '',
        km: raw.sgpg_timing_km || '',
        note: raw.sgpg_timing_note || '',
      },
      arguments: args,
      howToChoose,
      symptoms,
      antiMistakes,
      faq,
      enrichedSelectionCriteria,
      enrichedDecisionTree,
      enrichedUseCases,
      enrichedAntiMistakes: dbAntiMistakes.length > 0 ? dbAntiMistakes : null,
    };

    const qualityGate = this.applyQualityGate(content, raw);

    return {
      ...qualityGate.content,
      quality: this.buildQuality(qualityGate.content, qualityGate.flags, raw),
    };
  }

  private cleanText(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim();
  }

  private normalizeForMatch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private dedupeStrings(items: string[]): {
    values: string[];
    hasDuplicates: boolean;
  } {
    const map = new Map<string, string>();
    let hasDuplicates = false;

    for (const item of items) {
      const value = this.cleanText(item);
      if (!value) continue;
      const key = this.normalizeForMatch(value);
      if (map.has(key)) {
        hasDuplicates = true;
        continue;
      }
      map.set(key, value);
    }

    return { values: Array.from(map.values()), hasDuplicates };
  }

  private dedupeFaq(faq: Array<{ question: string; answer: string }>): {
    values: Array<{ question: string; answer: string }>;
    hasDuplicates: boolean;
  } {
    const map = new Map<string, { question: string; answer: string }>();
    let hasDuplicates = false;

    for (const item of faq) {
      const question = this.cleanText(item?.question);
      const answer = this.cleanText(item?.answer);
      if (!question || !answer) continue;

      const key = this.normalizeForMatch(question);
      if (map.has(key)) {
        hasDuplicates = true;
        continue;
      }
      map.set(key, { question, answer });
    }

    return { values: Array.from(map.values()), hasDuplicates };
  }

  private containsGenericPhrase(value: string): boolean {
    const normalized = this.normalizeForMatch(value);
    if (!normalized) return false;

    return GENERIC_PHRASES.some((phrase) =>
      normalized.includes(this.normalizeForMatch(phrase)),
    );
  }

  /**
   * Detects when intro_role describes a different piece than the guide's title.
   * Extracts the piece name before ':' in intro_role and checks for shared
   * significant words with gammeName (articles stripped).
   */
  private isIntroRoleMismatch(introRole: string, gammeName: string): boolean {
    const colonIdx = introRole.indexOf(':');
    if (colonIdx < 1) return false;

    const rolePiece = this.normalizeForMatch(introRole.slice(0, colonIdx));
    const titleNorm = this.normalizeForMatch(gammeName);

    if (!rolePiece || !titleNorm) return false;

    const stripArticles = (s: string) =>
      s.replace(/^(le |la |les |l'|l'|un |une |des )/i, '').trim();

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

  private hasActionableMarker(value: string): boolean {
    const normalized = this.normalizeForMatch(value);
    if (!normalized) return false;
    return BUYING_GUIDE_ACTION_MARKERS.some((marker) =>
      normalized.includes(marker),
    );
  }

  private inferGammeName(content: BuyingGuideContractWithoutQuality): string {
    const fromTitle = this.cleanText(content.intro?.title || '')
      .replace(/^a quoi sert\s+/i, '')
      .replace(/\?+$/, '')
      .trim();

    if (fromTitle.length > 2) return fromTitle;

    const fromRisk = this.cleanText(content.risk?.title || '')
      .replace(/^pourquoi remplacer\s+/i, '')
      .replace(/\s+a temps\s*\?*$/i, '')
      .trim();

    if (fromRisk.length > 2) return fromRisk;
    return 'cette pièce';
  }

  private inferFamilyKey(
    content: BuyingGuideContractWithoutQuality,
  ): FamilyKey | null {
    const corpus = [
      this.cleanText(content.intro?.title || ''),
      this.cleanText(content.intro?.role || ''),
      this.cleanText(content.risk?.explanation || ''),
      this.cleanText(content.howToChoose || ''),
    ].join(' ');

    const normalized = this.normalizeForMatch(corpus);
    if (!normalized) return null;

    for (const [family, markers] of Object.entries(FAMILY_MARKERS) as Array<
      [FamilyKey, string[]]
    >) {
      if (
        markers.some((marker) =>
          normalized.includes(this.normalizeForMatch(marker)),
        )
      ) {
        return family;
      }
    }

    return null;
  }

  private fallbackIntroRole(
    gammeName: string,
    familyKey: FamilyKey | null,
  ): string {
    if (familyKey === 'freinage') {
      return `${gammeName} participe directement au freinage du véhicule. Une pièce conforme maintient la distance d'arrêt et la stabilité lors des freinages appuyés.`;
    }
    return `${gammeName} est une pièce mécanique liée à la fiabilité du véhicule. Une référence compatible permet de conserver les performances prévues par le constructeur.`;
  }

  private fallbackRisk(
    gammeName: string,
    familyKey: FamilyKey | null,
  ): {
    explanation: string;
    consequences: string[];
    costRange: string;
    conclusion: string;
  } {
    if (familyKey === 'freinage') {
      return {
        explanation: `Reporter le remplacement de ${gammeName} dégrade progressivement le freinage, allonge la distance d'arrêt et peut provoquer des dommages sur d'autres composants.`,
        consequences: [
          'Perte d’efficacité au freinage en usage urbain et autoroutier.',
          "Usure accélérée des pièces associées et hausse du coût d'intervention.",
          "Risque d'immobilisation du véhicule si la défaillance progresse.",
        ],
        costRange: '120 à 1200 EUR selon véhicule et gravité.',
        conclusion:
          'Un remplacement anticipé limite le risque sécurité et les surcoûts atelier.',
      };
    }

    return {
      explanation: `Rouler avec ${gammeName} usé augmente le risque de panne secondaire et peut dégrader le comportement global du véhicule.`,
      consequences: [
        "Risque d'usure accélérée d'éléments mécaniques liés.",
        "Risque d'immobilisation avec intervention plus coûteuse.",
        'Perte de fiabilité et de confort de conduite.',
      ],
      costRange: 'Coût variable selon la référence et la main-d’œuvre.',
      conclusion:
        'Un diagnostic précoce permet de sécuriser le montage et de maîtriser le budget.',
    };
  }

  private fallbackHowToChoose(
    gammeName: string,
    familyKey: FamilyKey | null,
  ): string {
    if (familyKey === 'freinage') {
      return `Sélectionnez marque, modèle, type moteur et année. Vérifiez ensuite les dimensions et la référence constructeur pour confirmer ${gammeName} et préserver un freinage sûr.`;
    }
    return `Renseignez marque, modèle, motorisation et année, puis validez la référence constructeur pour confirmer ${gammeName} compatible avec votre véhicule.`;
  }

  private fallbackSymptoms(familyKey: FamilyKey | null): string[] {
    if (familyKey === 'freinage') {
      return [
        'Vibrations ou pulsations ressenties au freinage.',
        'Bruit de frottement, grincement ou sifflement anormal.',
        "Distance d'arrêt qui augmente dans les mêmes conditions.",
      ];
    }

    return [
      'Perte progressive de performance dans les usages courants.',
      'Bruits ou comportements anormaux qui augmentent avec le temps.',
      'Ressenti de conduite dégradé nécessitant un contrôle rapide.',
    ];
  }

  private fallbackCompatibilityRules(
    gammeName: string,
    familyKey: FamilyKey | null,
  ): string[] {
    if (familyKey === 'freinage') {
      return [
        `Confirmer ${gammeName} pour le bon essieu (avant/arrière) avant commande.`,
        'Vérifier strictement diamètre, épaisseur mini (MIN TH) et type de disque (plein/ventilé).',
        'Comparer la référence constructeur et les dimensions avant validation panier.',
      ];
    }

    return [
      `Vérifier la référence exacte de ${gammeName} selon véhicule et motorisation.`,
      'Comparer les cotes techniques de montage avant achat.',
      'Valider la commande uniquement après confirmation de compatibilité constructeur.',
    ];
  }

  private fallbackAntiMistakes(
    gammeName: string,
    familyKey: FamilyKey | null = null,
  ): string[] {
    if (familyKey === 'freinage') {
      return [
        `Ne pas mélanger ${gammeName} avant/arrière sans validation stricte.`,
        'Toujours remplacer les disques par paire sur le même essieu.',
        "Ne pas ignorer la cote d'épaisseur minimale (MIN TH).",
        'Ne pas valider le montage sans contrôle du couple de serrage constructeur.',
      ];
    }

    return [
      `Ne pas commander ${gammeName} sans vérifier la compatibilité véhicule/moteur.`,
      'Ne pas ignorer les préconisations constructeur de montage.',
      'Ne pas différer le remplacement en cas de symptômes persistants.',
      'Ne pas valider le panier sans comparaison des références de montage.',
    ];
  }

  private fallbackFaq(
    gammeName: string,
    familyKey: FamilyKey | null = null,
  ): Array<{ question: string; answer: string }> {
    if (familyKey === 'freinage') {
      return [
        {
          question: "Puis-je monter du ventilé à l'arrière ?",
          answer:
            "Uniquement si le montage d'origine et la référence constructeur le prévoient pour votre véhicule.",
        },
        {
          question: 'Dois-je changer les plaquettes en même temps ?',
          answer:
            "Oui, c'est recommandé pour garantir un appui correct et limiter les vibrations au freinage.",
        },
        {
          question: 'Que vérifier avec des jantes 16/17 pouces ?',
          answer:
            'Contrôlez diamètre, épaisseur et encombrement selon la configuration constructeur de votre véhicule.',
        },
      ];
    }

    return [
      {
        question: `Comment choisir ${gammeName} compatible ?`,
        answer:
          'Renseignez marque, modèle, type moteur et année, puis contrôlez la référence constructeur avant validation de la commande.',
      },
      {
        question: `Quand remplacer ${gammeName} ?`,
        answer:
          'Remplacez la pièce dès apparition de symptômes persistants ou dès qu’un contrôle atelier confirme une usure hors tolérance.',
      },
      {
        question: `${gammeName} se remplace-t-il seul ?`,
        answer:
          'Le montage peut nécessiter des contrôles de sécurité et de couple. En cas de doute, suivez la procédure constructeur ou un atelier qualifié.',
      },
    ];
  }

  private splitSentences(value: string): string[] {
    return value
      .replace(/\r/g, ' ')
      .split(/[\n.!?;]+/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length >= 12);
  }

  private normalizeAdvice(value: string): string {
    const normalized = value
      .replace(/^[-•\d.)\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized.endsWith('.') ? normalized : `${normalized}.`;
  }

  private buildAntiMistakes(input: {
    howToChoose: string | null;
    timingNote: string;
    riskExplanation: string;
    riskConclusion: string;
    faq: Array<{ question: string; answer: string }>;
  }): string[] {
    const pattern =
      /\b(ne pas|n['’]oubliez pas|évitez|jamais|attention|erreur|toujours)\b/i;

    const textSources = [
      input.howToChoose || '',
      input.timingNote,
      input.riskExplanation,
      input.riskConclusion,
      ...input.faq.map((item) => item.answer),
    ];

    const unique = new Map<string, string>();

    for (const text of textSources) {
      for (const sentence of this.splitSentences(text)) {
        if (!pattern.test(sentence)) continue;
        const advice = this.normalizeAdvice(sentence);
        const key = advice.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, advice);
        }
      }
    }

    const result = Array.from(unique.values()).slice(0, 6);

    const fallback = [
      'Ne montez jamais la pièce sans vérifier la compatibilité exacte véhicule/moteur.',
      "N'attendez pas l'apparition de plusieurs symptômes pour remplacer la pièce.",
      'Toujours respecter le montage par paire quand la recommandation constructeur le demande.',
    ];

    for (const item of fallback) {
      if (result.length >= 3) break;
      const key = item.toLowerCase();
      if (!unique.has(key)) {
        result.push(item);
        unique.set(key, item);
      }
    }

    return result.slice(0, 6);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyQualityGate(
    content: BuyingGuideContractWithoutQuality,
    raw: any,
  ): {
    content: BuyingGuideContractWithoutQuality;
    flags: GammeContentQualityFlag[];
  } {
    const gated: BuyingGuideContractWithoutQuality = {
      ...content,
      intro: {
        title: this.cleanText(content.intro?.title || 'À quoi ça sert ?'),
        role: this.cleanText(content.intro?.role || ''),
        syncParts: this.dedupeStrings(
          content.intro?.syncParts || [],
        ).values.slice(0, 6),
      },
      risk: {
        title: this.cleanText(
          content.risk?.title || 'Pourquoi remplacer à temps ?',
        ),
        explanation: this.cleanText(content.risk?.explanation || ''),
        consequences: this.dedupeStrings(
          content.risk?.consequences || [],
        ).values.slice(0, 6),
        costRange: this.cleanText(content.risk?.costRange || ''),
        conclusion: this.cleanText(content.risk?.conclusion || ''),
      },
      timing: {
        title: this.cleanText(content.timing?.title || 'Quand intervenir ?'),
        years: this.cleanText(content.timing?.years || ''),
        km: this.cleanText(content.timing?.km || ''),
        note: this.cleanText(content.timing?.note || ''),
      },
      arguments: (content.arguments || [])
        .map((item) => ({
          title: this.cleanText(item?.title),
          content: this.cleanText(item?.content),
          icon: this.cleanText(item?.icon) || 'check-circle',
        }))
        .filter((item) => item.title.length > 0 && item.content.length > 0)
        .slice(0, 6),
      howToChoose: this.cleanText(content.howToChoose || '') || null,
      symptoms: this.dedupeStrings(content.symptoms || []).values.slice(0, 12),
      antiMistakes: this.dedupeStrings(content.antiMistakes || []).values.slice(
        0,
        12,
      ),
      faq: this.dedupeFaq(content.faq || []).values.slice(0, 8),
    };

    const flags: GammeContentQualityFlag[] = [];
    const addFlag = (flag: GammeContentQualityFlag) => {
      if (!flags.includes(flag)) flags.push(flag);
    };

    const gammeName = this.inferGammeName(gated);
    const familyKey = this.inferFamilyKey(gated);

    // Intro role
    const introRole = this.cleanText(gated.intro.role);
    if (introRole.length < MIN_NARRATIVE_LENGTH) {
      addFlag('TOO_SHORT');
      gated.intro.role = this.fallbackIntroRole(gammeName, familyKey);
    } else if (introRole.length > MAX_NARRATIVE_LENGTH) {
      addFlag('TOO_LONG');
      gated.intro.role = this.fallbackIntroRole(gammeName, familyKey);
    } else if (this.containsGenericPhrase(introRole)) {
      addFlag('GENERIC_PHRASES');
      gated.intro.role = this.fallbackIntroRole(gammeName, familyKey);
    } else if (this.isIntroRoleMismatch(introRole, gammeName)) {
      addFlag('INTRO_ROLE_MISMATCH');
      gated.intro.role = this.fallbackIntroRole(gammeName, familyKey);
    }

    // Risk section
    const riskExplanation = this.cleanText(gated.risk.explanation);
    if (riskExplanation.length < MIN_NARRATIVE_LENGTH) {
      addFlag('TOO_SHORT');
      const fallback = this.fallbackRisk(gammeName, familyKey);
      gated.risk.explanation = fallback.explanation;
      gated.risk.consequences = fallback.consequences;
      gated.risk.costRange = gated.risk.costRange || fallback.costRange;
      gated.risk.conclusion = gated.risk.conclusion || fallback.conclusion;
    } else if (riskExplanation.length > MAX_NARRATIVE_LENGTH) {
      addFlag('TOO_LONG');
      const fallback = this.fallbackRisk(gammeName, familyKey);
      gated.risk.explanation = fallback.explanation;
      gated.risk.consequences = fallback.consequences;
      gated.risk.costRange = gated.risk.costRange || fallback.costRange;
      gated.risk.conclusion = gated.risk.conclusion || fallback.conclusion;
    } else if (this.containsGenericPhrase(riskExplanation)) {
      addFlag('GENERIC_PHRASES');
      const fallback = this.fallbackRisk(gammeName, familyKey);
      gated.risk.explanation = fallback.explanation;
      gated.risk.consequences = fallback.consequences;
      gated.risk.costRange = gated.risk.costRange || fallback.costRange;
      gated.risk.conclusion = gated.risk.conclusion || fallback.conclusion;
    }

    // How to choose
    const howToChoose = this.cleanText(gated.howToChoose || '');
    if (howToChoose.length < MIN_NARRATIVE_LENGTH) {
      addFlag('TOO_SHORT');
      gated.howToChoose = this.fallbackHowToChoose(gammeName, familyKey);
    } else if (howToChoose.length > MAX_NARRATIVE_LENGTH) {
      addFlag('TOO_LONG');
      gated.howToChoose = this.fallbackHowToChoose(gammeName, familyKey);
    } else if (this.containsGenericPhrase(howToChoose)) {
      addFlag('GENERIC_PHRASES');
      gated.howToChoose = this.fallbackHowToChoose(gammeName, familyKey);
    }

    // Arguments
    const uniqueArguments = new Map<string, (typeof gated.arguments)[number]>();
    let duplicateArguments = false;
    for (const item of gated.arguments) {
      const key = this.normalizeForMatch(`${item.title}|${item.content}`);
      if (uniqueArguments.has(key)) {
        duplicateArguments = true;
        continue;
      }
      uniqueArguments.set(key, item);
    }
    gated.arguments = Array.from(uniqueArguments.values());
    if (duplicateArguments) addFlag('DUPLICATE_ITEMS');

    if (gated.arguments.length < MIN_ARGUMENTS) {
      const fallbackArgs = [
        {
          title: 'Compatibilité vérifiée',
          content: 'Sélection guidée par véhicule et référence technique.',
          icon: 'check-circle',
        },
        {
          title: 'Décision plus sûre',
          content: 'Le guide réduit les erreurs de référence avant commande.',
          icon: 'shield-check',
        },
        {
          title: 'Montage maîtrisé',
          content:
            'Les points de contrôle essentiels sont rappelés avant intervention.',
          icon: 'list-check',
        },
      ];

      for (const arg of fallbackArgs) {
        if (gated.arguments.length >= MIN_ARGUMENTS) break;
        const exists = gated.arguments.some(
          (item) =>
            this.normalizeForMatch(item.title) ===
            this.normalizeForMatch(arg.title),
        );
        if (!exists) gated.arguments.push(arg);
      }
      addFlag('TOO_SHORT');
    }

    // Symptoms
    const dedupedSymptoms = this.dedupeStrings(gated.symptoms || []);
    gated.symptoms = dedupedSymptoms.values.slice(0, 10);
    if (dedupedSymptoms.hasDuplicates) addFlag('DUPLICATE_ITEMS');
    if (gated.symptoms.length < PURCHASE_GUIDE_VALIDATION.MIN_SYMPTOMS) {
      addFlag('SYMPTOMS_TOO_SMALL');
      gated.symptoms = this.fallbackSymptoms(familyKey);
    }

    // Anti-mistakes
    const dedupedAntiMistakes = this.dedupeStrings(gated.antiMistakes || []);
    gated.antiMistakes = dedupedAntiMistakes.values.slice(0, 10);
    if (dedupedAntiMistakes.hasDuplicates) addFlag('DUPLICATE_ITEMS');
    if (gated.antiMistakes.length < MIN_ANTI_MISTAKES) {
      gated.antiMistakes = this.fallbackAntiMistakes(gammeName, familyKey);
      addFlag('TOO_SHORT');
    }

    // FAQ
    const dedupedFaq = this.dedupeFaq(gated.faq || []);
    gated.faq = dedupedFaq.values.slice(0, 8);
    if (dedupedFaq.hasDuplicates) addFlag('DUPLICATE_ITEMS');

    gated.faq = gated.faq.map((item) => {
      const answer = this.cleanText(item.answer);
      if (answer.length >= PURCHASE_GUIDE_VALIDATION.MIN_FAQ_ANSWER_LENGTH) {
        return item;
      }
      addFlag('TOO_SHORT');
      return {
        question: item.question,
        answer:
          'Vérifiez la référence exacte selon le véhicule et suivez la procédure constructeur pour sécuriser le remplacement.',
      };
    });

    if (gated.faq.length < PURCHASE_GUIDE_VALIDATION.MIN_FAQS) {
      addFlag('FAQ_TOO_SMALL');
      gated.faq = this.fallbackFaq(gammeName, familyKey);
    }

    // Required terms by family
    if (familyKey) {
      const requiredTerms = FAMILY_REQUIRED_TERMS[familyKey];
      const corpus = this.normalizeForMatch(
        [
          gated.intro.role,
          gated.risk.explanation,
          gated.howToChoose || '',
          ...gated.symptoms,
        ].join(' '),
      );

      const missingTerms = requiredTerms.filter(
        (term) => !corpus.includes(this.normalizeForMatch(term)),
      );

      if (missingTerms.length > 0) {
        addFlag('MISSING_REQUIRED_TERMS');
        gated.howToChoose = this.fallbackHowToChoose(gammeName, familyKey);
      }
    }

    // Safety values always present
    if (!gated.timing.years) gated.timing.years = 'Contrôle annuel recommandé';
    if (!gated.timing.km)
      gated.timing.km = 'Contrôle à chaque révision constructeur';
    if (!gated.timing.note)
      gated.timing.note = 'Respecter les tolérances constructeur.';

    if (!gated.risk.costRange) {
      const fallback = this.fallbackRisk(gammeName, familyKey);
      gated.risk.costRange = fallback.costRange;
    }
    if (!gated.risk.conclusion) {
      const fallback = this.fallbackRisk(gammeName, familyKey);
      gated.risk.conclusion = fallback.conclusion;
    }

    const source = this.resolveQualitySource(raw, gated.pgId);
    if (!this.isAcceptedProvenance(raw, source)) {
      addFlag('MISSING_SOURCE_PROVENANCE');
    }

    return { content: gated, flags };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveQualitySource(raw: any, pgId: string): string {
    const sourceUriRaw = this.cleanText(raw?.sgpg_source_uri);
    const sourceType = this.cleanText(raw?.sgpg_source_type).toLowerCase();
    const sourceRef = this.cleanText(raw?.sgpg_source_ref);
    let sourceUri = sourceUriRaw;

    if (sourceUri && sourceType) {
      const normalizedUri = this.normalizeForMatch(sourceUri);
      const hasTypedPrefix =
        normalizedUri.startsWith(`${sourceType}://`) ||
        normalizedUri.startsWith(`${sourceType}:`);

      if (!hasTypedPrefix) {
        if (sourceType === 'scraping' && /^https?:\/\//i.test(sourceUri)) {
          sourceUri = `scraping:${sourceUri}`;
        } else if (!sourceUri.includes('://')) {
          sourceUri = `${sourceType}:${sourceUri}`;
        }
      }
    }

    if (sourceUri) {
      if (sourceRef) return `${sourceUri}#${sourceRef}`;
      return sourceUri;
    }

    if (sourceType && sourceRef) {
      return `${sourceType}:${sourceRef}`;
    }

    return `db:__seo_gamme_purchase_guide:${pgId}`;
  }

  private isTrustedProvenance(source: string): boolean {
    const normalized = this.normalizeForMatch(source);
    return TRUSTED_SOURCE_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix),
    );
  }

  private parseBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = this.normalizeForMatch(String(value || ''));
    return ['1', 'true', 't', 'yes', 'y'].includes(normalized);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isSourceVerified(raw: any): boolean {
    // Mode strict par défaut: sans colonne explicite de vérification,
    // la source est considérée non vérifiée. Le mode legacy doit être activé
    // explicitement par variable d'environnement.
    if (
      !raw ||
      !Object.prototype.hasOwnProperty.call(raw, 'sgpg_source_verified')
    ) {
      return this.parseBoolean(BUYING_GUIDE_ALLOW_LEGACY_IMPLICIT_VERIFIED);
    }
    return this.parseBoolean(raw?.sgpg_source_verified);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isAcceptedProvenance(raw: any, source: string): boolean {
    if (!this.isTrustedProvenance(source)) return false;
    if (!ENFORCE_SOURCE_VERIFIED) return true;
    return this.isSourceVerified(raw);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildQuality(
    content: BuyingGuideContractWithoutQuality,
    flags: GammeContentQualityFlag[],
    raw: any,
  ): GammeContentQuality {
    let score = 100;
    const uniqueFlags: GammeContentQualityFlag[] = [];
    for (const flag of flags) {
      if (!uniqueFlags.includes(flag)) uniqueFlags.push(flag);
    }

    for (const flag of uniqueFlags) {
      score -= FLAG_PENALTIES[flag] || 0;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      flags: uniqueFlags,
      version: CONTRACT_VERSION,
      source: this.resolveQualitySource(raw, content.pgId),
      verified: this.isSourceVerified(raw),
    };
  }

  private inferFamilyKeyFromLabels(
    gammeName: string,
    familyName: string,
  ): FamilyKey | null {
    const normalized = this.normalizeForMatch(`${gammeName} ${familyName}`);
    if (!normalized) return null;

    for (const [family, markers] of Object.entries(FAMILY_MARKERS) as Array<
      [FamilyKey, string[]]
    >) {
      if (
        markers.some((marker) =>
          normalized.includes(this.normalizeForMatch(marker)),
        )
      ) {
        return family;
      }
    }

    return null;
  }

  private buildAutoContractV1(
    pgId: string,
    gammeName: string,
    familyKey: FamilyKey | null,
  ): BuyingGuideContractV1 {
    const risk = this.fallbackRisk(gammeName, familyKey);
    const numericId = Number.parseInt(pgId, 10);
    const safeId = Number.isFinite(numericId) ? numericId : 0;
    const syncParts =
      familyKey === 'freinage'
        ? ['plaquettes de frein', 'étriers', "capteur d'usure (si équipé)"]
        : ['pièces associées au montage', 'fixations', 'consommables atelier'];

    return {
      id: safeId,
      pgId,
      intro: {
        title: `À quoi sert ${gammeName} ?`,
        role: this.fallbackIntroRole(gammeName, familyKey),
        syncParts,
      },
      risk: {
        title: `Pourquoi remplacer ${gammeName} à temps ?`,
        explanation: risk.explanation,
        consequences: risk.consequences,
        costRange: risk.costRange,
        conclusion: risk.conclusion,
      },
      timing: {
        title: 'Quand intervenir ?',
        years: 'Contrôle annuel recommandé',
        km: 'Contrôle à chaque révision constructeur',
        note: 'Valider les tolérances constructeur avant décision de remplacement.',
      },
      arguments: [
        {
          title: 'Compatibilité vérifiée',
          content: 'Sélection guidée par véhicule et référence technique.',
          icon: 'check-circle',
        },
        {
          title: 'Décision anti-erreur',
          content:
            'Les points de contrôle critiques sont structurés avant validation panier.',
          icon: 'shield-check',
        },
        {
          title: 'Montage maîtrisé',
          content:
            'Les contrôles de montage et de sécurité sont rappelés avant intervention.',
          icon: 'list-check',
        },
      ],
      howToChoose: this.fallbackHowToChoose(gammeName, familyKey),
      symptoms: this.fallbackSymptoms(familyKey),
      antiMistakes: this.fallbackAntiMistakes(gammeName, familyKey),
      faq: this.fallbackFaq(gammeName, familyKey),
      quality: {
        score: 95,
        flags: [],
        version: CONTRACT_VERSION,
        source: `fallback://automecanik/gamme-buying-guide-template#pg=${pgId}`,
        verified: false,
      },
    };
  }

  private ensureBuyingGuideRequiredSections(
    guide: GammeBuyingGuideV1,
    contract: BuyingGuideContractV1,
    gammeName: string,
    familyKey: FamilyKey | null,
  ): GammeBuyingGuideV1 {
    const next: GammeBuyingGuideV1 = {
      ...guide,
      inputs: {
        ...guide.inputs,
        constraints: [...(guide.inputs?.constraints || [])],
      },
      decisionTree: [...(guide.decisionTree || [])],
      compatibilityRules: [...(guide.compatibilityRules || [])],
      antiMistakes: [...(guide.antiMistakes || [])],
      selectionCriteria: [...(guide.selectionCriteria || [])],
      useCases: [...(guide.useCases || [])],
      pairing: {
        required: [...(guide.pairing?.required || [])],
        recommended: [...(guide.pairing?.recommended || [])],
        checks: [...(guide.pairing?.checks || [])],
      },
      output: {
        ...guide.output,
        pairingAdvice: [...(guide.output?.pairingAdvice || [])],
        warnings: [...(guide.output?.warnings || [])],
      },
      faq: [...(guide.faq || [])],
    };

    if (!this.cleanText(next.inputs?.vehicle)) {
      next.inputs = this.buildInputs(gammeName, familyKey);
    } else {
      next.inputs = {
        ...next.inputs,
        constraints: this.dedupeStrings(
          next.inputs.constraints || [],
        ).values.slice(0, 6),
      };
    }

    if (next.decisionTree.length < BUYING_GUIDE_MIN_DECISION_NODES) {
      next.decisionTree = this.buildDecisionTree(
        contract,
        gammeName,
        familyKey,
      );
    }

    if (next.selectionCriteria.length < BUYING_GUIDE_MIN_SELECTION_CRITERIA) {
      next.selectionCriteria = this.buildSelectionCriteria(
        gammeName,
        familyKey,
      );
    }

    if (next.useCases.length === 0) {
      next.useCases = this.buildUseCases(familyKey);
    }

    const fallbackRules = this.fallbackCompatibilityRules(gammeName, familyKey);
    next.compatibilityRules = this.dedupeStrings([
      ...next.compatibilityRules,
      ...fallbackRules,
    ]).values.slice(0, 8);

    const fallbackFaq = this.fallbackFaq(gammeName, familyKey);
    const faqByQuestion = new Map<
      string,
      { question: string; answer: string }
    >();
    for (const item of [...next.faq, ...fallbackFaq]) {
      const question = this.cleanText(item?.question);
      const answer = this.cleanText(item?.answer);
      if (!question || !answer) continue;
      const key = this.normalizeForMatch(question);
      if (!faqByQuestion.has(key)) {
        faqByQuestion.set(key, { question, answer });
      }
    }
    next.faq = Array.from(faqByQuestion.values()).slice(0, 8);

    next.antiMistakes = this.dedupeStrings([
      ...(next.antiMistakes || []),
      ...this.fallbackAntiMistakes(gammeName, familyKey),
    ]).values.slice(0, 10);

    next.output = {
      ...next.output,
      pairingAdvice: this.dedupeStrings([
        ...(next.output?.pairingAdvice || []),
        ...next.pairing.required,
        ...next.pairing.recommended,
        ...next.pairing.checks,
      ]).values.slice(0, 8),
      warnings: this.dedupeStrings(next.output?.warnings || []).values.slice(
        0,
        8,
      ),
    };

    if (
      !this.cleanText(next.output?.selectedSpec) ||
      next.output.pairingAdvice.length === 0 ||
      next.output.warnings.length === 0
    ) {
      next.output = this.buildOutput(gammeName, familyKey);
    }

    return next;
  }
}
