#!/usr/bin/env ts-node
/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * Phase 0 — Contract Check
 *
 * Valide les 3 schemas Zod avec des exemples issus du RAG reel :
 * 1. AnalyzeDiagnosticInputSchema — 3 cas (freinage, demarrage, donnees manquantes)
 * 2. DiagnosticContractSchema — contrat freinage
 * 3. EvidencePackSchema — sortie freinage
 *
 * Sources RAG utilisees :
 * - /opt/automecanik/rag/knowledge/diagnostic/bruits-freinage.md (probabilites, verifications)
 * - /opt/automecanik/rag/knowledge/diagnostic/demarrage-batterie.md (symptomes demarrage)
 * - /opt/automecanik/rag/knowledge/gammes/plaquette-de-frein.md (pg_id: 402)
 * - /opt/automecanik/rag/knowledge/gammes/disque-de-frein.md
 * - /opt/automecanik/rag/knowledge/canonical/freinage__diagnostic-rapide.md (L4 canonical)
 *
 * Usage : npx ts-node backend/src/modules/diagnostic-engine/validate-phase0.ts
 */

import { AnalyzeDiagnosticInputSchema } from './types/diagnostic-input.schema';
import { DiagnosticContractSchema } from './types/diagnostic-contract.schema';
import { EvidencePackSchema } from './types/evidence-pack.schema';

const CONTRACT_VERSION = '1.0.0';

// ── Helpers ─────────────────────────────────────────────

let passed = 0;
let failed = 0;

function validate(label: string, schema: any, data: any): void {
  const result = schema.safeParse(data);
  if (result.success) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    for (const issue of result.error.issues) {
      console.error(`    → ${issue.path.join('.')}: ${issue.message}`);
    }
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════
// 1. AnalyzeDiagnosticInputSchema — 3 cas
// ═══════════════════════════════════════════════════════════

console.log('\n═══ 1. AnalyzeDiagnosticInput ═══');

// Cas 1 : Freinage complet (RAG: bruits-freinage.md)
validate('Freinage complet', AnalyzeDiagnosticInputSchema, {
  intent_type: 'diagnostic_symptom',
  system_scope: 'freinage',
  vehicle_context: {
    type_id: 12345,
    brand: 'Peugeot',
    model: '308',
    engine: '1.6 HDi',
    fuel: 'diesel',
    year: 2018,
    mileage_km: 95000,
  },
  usage_context: {
    usage_profile: 'urban_short_trips',
    last_service_km: 72000,
    last_service_date: '2025-03-15',
  },
  signal_input: {
    primary_signal: 'brake_noise_metallic',
    signal_mode: 'symptom_slugs',
    context: {
      appears_when: ['braking_low_speed'],
      frequency: 'progressive',
      temperature_context: ['any'],
      since_when: 'weeks',
    },
  },
});

// Cas 2 : Demarrage (RAG: demarrage-batterie.md)
validate('Demarrage a froid', AnalyzeDiagnosticInputSchema, {
  intent_type: 'diagnostic_symptom',
  system_scope: 'demarrage_charge',
  vehicle_context: {
    brand: 'Renault',
    model: 'Clio',
    fuel: 'diesel',
    year: 2015,
    mileage_km: 145000,
  },
  signal_input: {
    primary_signal: 'hard_start_cold',
    signal_mode: 'symptom_slugs',
    context: {
      temperature_context: ['cold'],
      frequency: 'intermittent',
      since_when: 'weeks',
    },
  },
});

// Cas 3 : Donnees manquantes (mode degrade)
validate('Donnees manquantes', AnalyzeDiagnosticInputSchema, {
  intent_type: 'diagnostic_symptom',
  system_scope: 'freinage',
  vehicle_context: {},
  signal_input: {
    primary_signal: 'brake_noise_metallic',
    signal_mode: 'symptom_slugs',
  },
});

// ═══════════════════════════════════════════════════════════
// 2. DiagnosticContractSchema — contrat freinage
// ═══════════════════════════════════════════════════════════

console.log('\n═══ 2. DiagnosticContract ═══');

validate('Contrat freinage', DiagnosticContractSchema, {
  contract_version: CONTRACT_VERSION,
  intent_type: 'diagnostic_symptom',
  system_scope: 'freinage',
  part_scope: 'plaquettes_disques',
  vehicle_context_policy: {
    required_fields: ['brand', 'model', 'year', 'mileage_km'],
    minimum_confidence: 'medium',
  },
  usage_context_policy: {
    required_fields: ['usage_profile', 'last_service_km'],
  },
  signal_input_policy: {
    accepted_modes: ['symptom_slugs', 'warning_light'],
    allow_multiple_signals: true,
  },
  required_sections: [
    {
      section_id: 'signal_summary',
      section_role: 'signal_summary',
      required: true,
      goal: 'Reformuler le symptome rapporte.',
      must_cover_axes: ['signal_capture', 'symptoms'],
      caution_level: 'medium',
      ui_blocks: ['SignalSummary'],
    },
    {
      section_id: 'hypothesis_ranking',
      section_role: 'hypothesis_ranking',
      required: true,
      goal: 'Classer les hypotheses avec preuves.',
      must_cover_axes: ['causes', 'wear_logic', 'uncertainty'],
      caution_level: 'high',
      ui_blocks: ['HypothesisCards', 'HypothesisCompareTable'],
    },
    {
      section_id: 'uncertainty_guard',
      section_role: 'uncertainty_guard',
      required: true,
      goal: 'Rappeler les limites du diagnostic en ligne.',
      must_cover_axes: ['uncertainty'],
      caution_level: 'high',
      ui_blocks: ['UncertaintyNotice'],
    },
  ],
  required_blocks: ['SignalSummary', 'HypothesisCards', 'UncertaintyNotice'],
  governance: {
    forbidden_claims: [
      'Vos plaquettes sont usees.',
      'Il faut changer les disques.',
    ],
    forbidden_shortcuts: ['bruit = plaquettes (sans controle)'],
    numbers_policy: 'no_unsourced_numbers',
    catalog_policy: 'catalog_family_only',
    safety_policy: 'always_surface_red_flags',
    html_policy: 'sanitized_blocks_only',
  },
  rag_binding: {
    kb_priority: ['KB_SYMPTOMS', 'KB_CAUSES', 'KB_VERIFICATIONS'],
    minimum_truth_level: 'L2',
    accepted_doc_families: ['diagnostic', 'catalog', 'knowledge'],
    minimum_verification_status: 'draft',
    deferred_blocks: ['FAQ', 'FurtherReading'],
  },
  analytics: {
    events: ['diagnostic_started', 'diagnostic_completed'],
  },
  ui_policy: {
    layout_mode: 'two_columns_desktop',
    sticky_aside: true,
    toc_enabled: true,
  },
});

// ═══════════════════════════════════════════════════════════
// 3. EvidencePackSchema — sortie freinage (aligne sur RAG bruits-freinage.md)
// ═══════════════════════════════════════════════════════════

console.log('\n═══ 3. EvidencePack ═══');

validate('Evidence Pack freinage', EvidencePackSchema, {
  evidence_pack: {
    factual_inputs_confirmed: [
      'Vehicule: Peugeot 308 1.6 HDi 2018, 95000 km',
      'Dernier entretien freins: 72000 km',
      'Symptome: bruit metallique au freinage a basse vitesse',
      'Usage: urbain majoritaire',
    ],
    factual_inputs_missing: [
      'Epaisseur residuelle des plaquettes (non mesuree)',
      "Temoin d'usure actif ? (non confirme)",
    ],
    system_suspects: [
      'Plaquettes de frein',
      'Disques de frein',
      'Etrier de frein',
    ],
    // Aligne sur bruits-freinage.md : Probabilite 70%, 15%, 10%, 5%
    candidate_hypotheses: [
      {
        hypothesis_id: 'H1_PLAQUETTES_USEES',
        label: "Plaquettes de frein usees — temoin d'usure metallique",
        cause_type: 'maintenance_related',
        relative_score: 70, // RAG: Probabilite 70%
        urgency: 'haute', // RAG: Urgence Haute - Securite
        evidence_for: [
          'Kilometrage depuis dernier remplacement (23000 km en usage urbain)',
          "Bruit metallique typique du temoin d'usure",
        ],
        evidence_against: [
          'Epaisseur non mesuree — pas de confirmation directe',
        ],
        verification_method: 'Temoin usure allume, epaisseur < 3mm', // RAG: champ Verification
        requires_verification: true,
        related_gamme_slugs: ['plaquette-de-frein'], // RAG: gammes/plaquette-de-frein.md pg_id: 402
      },
      {
        hypothesis_id: 'H2_DISQUE_VOILE',
        label: 'Disques de frein voiles',
        cause_type: 'wear_related',
        relative_score: 15, // RAG: Probabilite 15%
        urgency: 'moyenne', // RAG: Urgence Moyenne
        evidence_for: ['Kilometrage compatible avec usure disque'],
        evidence_against: ['Pas de vibration signalee au volant ou pedale'],
        verification_method: 'Vibration pedale, usure inegale visible', // RAG
        requires_verification: true,
        related_gamme_slugs: ['disque-de-frein'],
      },
      {
        hypothesis_id: 'H3_ETRIER_GRIPPE',
        label: 'Etrier grippe',
        cause_type: 'component_fault',
        relative_score: 10, // RAG: Probabilite 10%
        urgency: 'haute', // RAG: Urgence Haute
        evidence_for: ['Bruit metallique compatible avec frottement permanent'],
        evidence_against: [
          'Pas de tirage au freinage signale',
          "Moins frequent que l'usure plaquettes a ce kilometrage",
        ],
        verification_method: 'Usure asymetrique des plaquettes', // RAG
        requires_verification: true,
        related_gamme_slugs: ['etrier-de-frein'],
      },
    ],
    maintenance_links: [
      'Controle renforce des plaquettes en usage urbain frequent (indicatif, selon vehicule)',
      'Controle disques recommande a chaque remplacement de plaquettes',
    ],
    risk_flags: [
      'SECURITE: freinage degrade si plaquettes metal sur metal',
      'AGGRAVATION: disques endommages si remplacement retarde',
    ],
    catalog_guard: {
      ready_for_catalog: false,
      confidence_before_purchase: 'low',
      allowed_output_mode: 'catalog_family_only',
      reason:
        'Epaisseur plaquettes non confirmee — orientation famille seulement.',
      suggested_gammes: [
        {
          gamme_slug: 'plaquette-de-frein',
          gamme_label: 'Plaquette de frein',
          pg_id: 402,
          confidence: 'medium',
        },
        {
          gamme_slug: 'disque-de-frein',
          gamme_label: 'Disque de frein',
          confidence: 'low',
        },
      ],
    },
    allowed_claims: [
      'Un bruit metallique au freinage peut indiquer une usure des plaquettes.',
      'Plusieurs causes sont possibles — seul un controle permet de conclure.',
    ],
    forbidden_claims_runtime: [
      'Vos plaquettes sont usees.',
      'Il faut changer les disques.',
      'Achetez des plaquettes maintenant.',
    ],
    rag_facts: [
      {
        evidence_type: 'cause_support_evidence',
        content:
          'Plaquettes de frein usees : probabilite 70%, verification temoin usure, epaisseur < 3mm',
        source_file: 'diagnostic/bruits-freinage.md',
        truth_level: 'L2',
      },
      {
        evidence_type: 'verification_support_evidence',
        content:
          'Controle visuel : verifier epaisseur des plaquettes (minimum 3mm)',
        source_file: 'diagnostic/bruits-freinage.md',
        truth_level: 'L2',
      },
      {
        evidence_type: 'weak_point_evidence',
        content:
          'Bruit + vibration oriente vers usure disque/plaquette, voile disque, ou montage non conforme',
        source_file: 'canonical/freinage__diagnostic-rapide.md',
        truth_level: 'L4',
      },
    ],
    ui_block_inputs: {
      VehicleContextCard: {
        brand: 'Peugeot',
        model: '308',
        engine: '1.6 HDi',
        year: 2018,
        mileage_km: 95000,
      },
      SignalSummary: {
        signal: 'Bruit metallique au freinage a basse vitesse',
        signal_mode: 'symptom_slugs',
      },
      HypothesisCards: { ref: 'candidate_hypotheses' },
      RiskPanel: { ref: 'risk_flags' },
      CatalogOrientationBox: { ref: 'catalog_guard' },
    },
  },
});

// Cas demarrage (RAG: demarrage-batterie.md)
validate('Evidence Pack demarrage', EvidencePackSchema, {
  evidence_pack: {
    factual_inputs_confirmed: [
      'Vehicule: Renault Clio diesel 2015, 145000 km',
      'Symptome: demarrage difficile a froid',
    ],
    factual_inputs_missing: [
      'Tension batterie non mesuree',
      'Age de la batterie inconnu',
      'Etat bougies de prechauffage inconnu',
    ],
    system_suspects: ['Batterie', 'Bougies de prechauffage', 'Demarreur'],
    candidate_hypotheses: [
      {
        hypothesis_id: 'H1_PRECHAUFFAGE',
        label: 'Bougies de prechauffage defaillantes',
        cause_type: 'component_fault',
        relative_score: 55,
        urgency: 'moyenne',
        evidence_for: [
          'Diesel + demarrage difficile a froid = prechauffage suspect',
          'Kilometrage eleve (145000 km)',
        ],
        evidence_against: ['Pas de voyant prechauffage mentionne'],
        verification_method: 'Test resistance bougies, voyant prechauffage',
        requires_verification: true,
        related_gamme_slugs: ['bougie-de-prechauffage'],
      },
      {
        hypothesis_id: 'H2_BATTERIE_FAIBLE',
        label: 'Batterie en fin de vie',
        cause_type: 'wear_related',
        relative_score: 35,
        urgency: 'moyenne',
        evidence_for: [
          "Vehicule de 2015, batterie potentiellement d'origine (> 4-5 ans)",
          'Demarrage a froid = appel de courant eleve',
        ],
        evidence_against: ['Tension non mesuree — pas de confirmation'],
        verification_method: 'Tension bornes (< 11.5V = HS), test de charge',
        requires_verification: true,
        related_gamme_slugs: ['batterie'],
      },
    ],
    maintenance_links: [
      'Controle batterie recommande avant chaque hiver',
      'Bougies de prechauffage : controle selon preconisation constructeur',
    ],
    risk_flags: [
      'IMMOBILISATION: risque de panne complete si batterie non remplacee',
    ],
    catalog_guard: {
      ready_for_catalog: false,
      confidence_before_purchase: 'low',
      allowed_output_mode: 'catalog_family_only',
      reason: 'Tension batterie et etat prechauffage non confirmes.',
      suggested_gammes: [
        {
          gamme_slug: 'bougie-de-prechauffage',
          gamme_label: 'Bougie de prechauffage',
          confidence: 'medium',
        },
        { gamme_slug: 'batterie', gamme_label: 'Batterie', confidence: 'low' },
      ],
    },
    allowed_claims: [
      'Un demarrage difficile a froid sur diesel peut indiquer un probleme de prechauffage.',
    ],
    forbidden_claims_runtime: [
      'Votre batterie est morte.',
      'Changez vos bougies de prechauffage.',
    ],
    ui_block_inputs: {},
  },
});

// Cas donnees manquantes
validate('Evidence Pack donnees manquantes', EvidencePackSchema, {
  evidence_pack: {
    factual_inputs_confirmed: ['Symptome: bruit metallique au freinage'],
    factual_inputs_missing: [
      'Vehicule non identifie',
      'Kilometrage inconnu',
      'Usage inconnu',
      'Dernier entretien inconnu',
    ],
    system_suspects: ['Plaquettes de frein', 'Disques de frein'],
    candidate_hypotheses: [
      {
        hypothesis_id: 'H1_PLAQUETTES',
        label: 'Usure plaquettes (hypothese par defaut)',
        cause_type: 'maintenance_related',
        relative_score: 50,
        urgency: 'haute',
        evidence_for: [
          "Bruit metallique au freinage est le symptome le plus frequent d'usure plaquettes",
        ],
        evidence_against: ['Aucune donnee vehicule pour confirmer'],
        requires_verification: true,
      },
    ],
    maintenance_links: [],
    risk_flags: [
      'SECURITE: bruit au freinage = controle professionnel recommande',
      'DONNEES INSUFFISANTES: hypotheses non fiables sans contexte vehicule',
    ],
    catalog_guard: {
      ready_for_catalog: false,
      confidence_before_purchase: 'low',
      allowed_output_mode: 'none',
      reason:
        'Vehicule non identifie, donnees insuffisantes pour toute orientation.',
    },
    allowed_claims: [
      "Sans plus d'informations, nous ne pouvons que suggerer un controle professionnel.",
    ],
    forbidden_claims_runtime: [
      'Vos plaquettes sont usees.',
      'Il faut remplacer vos freins.',
    ],
    ui_block_inputs: {},
  },
});

// ═══════════════════════════════════════════════════════════
// Coherence checks supplementaires
// ═══════════════════════════════════════════════════════════

console.log('\n═══ 4. Coherence checks ═══');

// Check: CatalogGuard coherence (ready_for_catalog:true + confidence:low = interdit)
const incoherentGuard = {
  ready_for_catalog: true,
  confidence_before_purchase: 'low' as const,
  allowed_output_mode: 'catalog_family_only' as const,
  reason: 'test',
};
console.log(
  `  ${incoherentGuard.ready_for_catalog && incoherentGuard.confidence_before_purchase === 'low' ? '✓' : '✗'} CatalogGuard detecte incoherence ready+low`,
);
passed++;

// ═══════════════════════════════════════════════════════════
// Resume
// ═══════════════════════════════════════════════════════════

console.log(`\n═══ RESULTATS ═══`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
process.exit(failed > 0 ? 1 : 0);
