/**
 * Reality Audit Verdict Logic (Phase 0.5 du plan Reality Audit Business-First)
 *
 * Fonction pure : prend les inputs DÉCISIFS du Reality Audit + retourne
 * { dominant_problem, notes }.
 *
 * IMPORTANT : seules 5 colonnes sont DÉCISIVES. Les ~30 colonnes contextuelles
 * (E.bis..E.sexies) sont informatives pour le rapport markdown mais ne pèsent
 * PAS dans cette verdict logic (anti-bruit).
 *
 * Cf plan : /home/deploy/.claude/plans/utiliser-superpower-strat-gie-immutable-donut.md
 */

export type DominantProblem =
  | "content_quality"
  | "indexation"
  | "intent_mismatch"
  | "conversion_funnel"
  | "business_unviable"
  | "mixed"
  | "unknown";

export interface VerdictInputs {
  pages_noindex_involuntary: number | null;
  canonical_correct_pct: number | null;
  intent_sample_size: number | null;
  intent_match_count: number | null;
  organic_sessions_28d: number | null;
  organic_orders_28d: number | null;
  business_viability_tier: "high" | "medium" | "low" | "unviable" | null;
}

export interface VerdictResult {
  dominant_problem: DominantProblem;
  notes: string;
}

/**
 * Seuils canon (cf MEMORY `project_seo_cp_p1_empirical_findings_20260518` :
 * 286K pages `index,follow` rejected = root cause qualité site-wide).
 */
const NOINDEX_INVOLUNTARY_THRESHOLD = 50_000;
const INTENT_MATCH_RATIO_THRESHOLD = 0.7;
const SESSIONS_FUNNEL_THRESHOLD = 100;
/**
 * Seuil taux de conversion organic plancher (commandes / sessions).
 * E-commerce auto-parts sain ≈ 1-3%. Sous 0.5% = funnel/UX/compat cassé,
 * même avec quelques commandes. Découvert empiriquement run réel 2026-05-20 :
 * 2308 sessions organic → 4 commandes = 0.17% (catastrophique).
 */
const CONVERSION_RATE_FLOOR = 0.005;

/**
 * Calcule le verdict Reality Audit.
 *
 * Ordre de priorité (premier match gagne) :
 * 1. business_unviable (rien à sauver si la gamme n'est pas viable)
 * 2. indexation (Google ne voit même pas les pages)
 * 3. intent_mismatch (Google voit, mais mismatch)
 * 4. conversion_funnel (Google voit, match intent, mais 0 commande)
 * 5. content_quality (par défaut si tout le reste passe + commandes > 0)
 * 6. unknown (données insuffisantes)
 */
export function computeVerdict(inputs: VerdictInputs): VerdictResult {
  const missing: string[] = [];

  // 1. business_unviable — prioritaire, rien à sauver
  if (inputs.business_viability_tier === "unviable") {
    return {
      dominant_problem: "business_unviable",
      notes: "Tier business_unviable détecté — pas d'investissement SEO supplémentaire avant re-prio gamme.",
    };
  }

  // 2. indexation — pages_noindex_involuntary trop élevé OU canonical cassé
  if (
    inputs.pages_noindex_involuntary !== null &&
    inputs.pages_noindex_involuntary > NOINDEX_INVOLUNTARY_THRESHOLD
  ) {
    return {
      dominant_problem: "indexation",
      notes: `pages_noindex_involuntary=${inputs.pages_noindex_involuntary} > ${NOINDEX_INVOLUNTARY_THRESHOLD} — fix canonical/noindex/sitemap prioritaire.`,
    };
  }
  if (inputs.canonical_correct_pct !== null && inputs.canonical_correct_pct < 50) {
    return {
      dominant_problem: "indexation",
      notes: `canonical_correct_pct=${inputs.canonical_correct_pct} < 50% — fix canonical massif requis.`,
    };
  }

  // 3. intent_mismatch — sample intent trop bas
  if (
    inputs.intent_sample_size !== null &&
    inputs.intent_match_count !== null &&
    inputs.intent_sample_size > 0
  ) {
    const ratio = inputs.intent_match_count / inputs.intent_sample_size;
    if (ratio < INTENT_MATCH_RATIO_THRESHOLD) {
      return {
        dominant_problem: "intent_mismatch",
        notes: `intent_match_ratio=${ratio.toFixed(2)} < ${INTENT_MATCH_RATIO_THRESHOLD} — re-architecture URL/template R1 vs R3 vs R6 prioritaire.`,
      };
    }
  } else {
    missing.push("intent (sample non capturé)");
  }

  // 4. conversion_funnel — du trafic mais (0 commande OU taux de conversion plancher)
  if (inputs.organic_sessions_28d !== null && inputs.organic_orders_28d !== null) {
    if (inputs.organic_sessions_28d > SESSIONS_FUNNEL_THRESHOLD) {
      const convRate = inputs.organic_orders_28d / inputs.organic_sessions_28d;
      if (inputs.organic_orders_28d === 0) {
        return {
          dominant_problem: "conversion_funnel",
          notes: `organic_sessions_28d=${inputs.organic_sessions_28d} > ${SESSIONS_FUNNEL_THRESHOLD} ET organic_orders_28d=0 — pivoter Commerce-Loop V1 (le tunnel est cassé, pas le contenu).`,
        };
      }
      if (convRate < CONVERSION_RATE_FLOOR) {
        return {
          dominant_problem: "conversion_funnel",
          notes: `conversion_rate=${(convRate * 100).toFixed(3)}% < ${(CONVERSION_RATE_FLOOR * 100).toFixed(1)}% (${inputs.organic_orders_28d} commandes / ${inputs.organic_sessions_28d} sessions) — taux catastrophique, pivoter Commerce-Loop V1 (funnel/UX/compat cassé, pas le contenu).`,
        };
      }
    }
  } else {
    missing.push("funnel (sessions/orders non capturés)");
  }

  // 5. content_quality — par défaut si tout le reste passe + conversion saine
  if (
    inputs.organic_orders_28d !== null &&
    inputs.organic_orders_28d > 0 &&
    inputs.organic_sessions_28d !== null
  ) {
    return {
      dominant_problem: "content_quality",
      notes: `Métriques saines (orders=${inputs.organic_orders_28d}, conv=${((inputs.organic_orders_28d / inputs.organic_sessions_28d) * 100).toFixed(2)}%) — le levier restant = qualité contenu. Ouvrir mini Evidence Guard V1.`,
    };
  }

  // 6. unknown — manque de données critiques
  if (missing.length > 0) {
    return {
      dominant_problem: "unknown",
      notes: `Données insuffisantes pour verdict : ${missing.join(", ")}. Re-run après instrumentation.`,
    };
  }

  return {
    dominant_problem: "unknown",
    notes: "Aucun pattern dominant détecté — données partiellement disponibles, verdict indéterminé.",
  };
}
