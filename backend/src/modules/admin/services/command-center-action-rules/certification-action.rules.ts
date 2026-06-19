/**
 * Certification / repair rules — derived ONLY from the canon snapshot
 * (deterministic, no DB query). For each business-critical department that is not
 * CERTIFIED, and for each incomplete handoff feeding sales, emit a "fix/certify the
 * source" action. These are the highest-leverage P0s (fix the funnel + supplier-truth
 * before optimizing anything downstream) — and they are honest because the canon is
 * reliable about WHAT is broken (so data_confidence is high).
 */
import { CONFIDENCE_BY_CERT, type RawAction } from './score-action';

interface DeptView {
  id: string;
  label: string;
  certification: string; // CERTIFIED|PARTIAL|UNKNOWN|BROKEN
  kpi_primary: string | null;
  priority?: string | null; // P0|P1|P2|P3 (canon) — drives generic repair coverage
}
interface ChainView {
  id: string;
  from: string;
  to: string;
  state: string; // EXISTS|PARTIAL|ASPIRATIONAL
  incomplete: boolean;
}

/** Department → concrete repair playbook (what fixing it unlocks). Canon-grounded. */
const REPAIR_PLAYBOOK: Record<
  string,
  {
    source: RawAction['source'];
    impact: number;
    urgency: number;
    effort: number;
    risk: number;
    step: string;
  }
> = {
  sales: {
    source: 'orders',
    impact: 10, // CA / conversion
    urgency: 9,
    effort: 4,
    risk: 2,
    step: "Réparer l'instrumentation funnel (events panier→commande→paiement) avant toute analyse conversion.",
  },
  supplier: {
    source: 'suppliers',
    impact: 9, // annulations / ruptures
    urgency: 8,
    effort: 5,
    risk: 3,
    step: 'Activer/certifier supplier-truth (dispo live vs fichier) avant tout signal de rupture fournisseur.',
  },
  data: {
    source: 'data',
    impact: 8,
    urgency: 7,
    effort: 4,
    risk: 2,
    step: 'Définir le verdict de fiabilité data (tracking-integrity) — la data conditionne sales & SEO.',
  },
  runtime: {
    source: 'runtime',
    impact: 7,
    urgency: 6,
    effort: 3,
    risk: 2,
    step: 'Définir un SLA runtime/data unifié (health + RPC alerts + fraîcheur).',
  },
};

/**
 * Conservative generic weights for a non-curated P0 department. Lower than the
 * curated playbooks (so the funnel/supplier P0s stay on top) but high enough to
 * surface — an uncertified P0 department must NEVER be invisible in the queue.
 * 'governance' is the only valid catch-all source in the action contract enum
 * (same fallback the wire rule already uses below).
 */
const GENERIC_P0_REPAIR = {
  source: 'governance' as RawAction['source'],
  impact: 6,
  urgency: 6,
  effort: 4,
  risk: 2,
};

export function buildCertificationActions(
  departments: DeptView[],
  chains: ChainView[],
): RawAction[] {
  const out: RawAction[] = [];

  // Repair coverage is canon-priority-driven, NOT a hardcoded allowlist. Before,
  // CRITICAL_DEPTS = Object.keys(REPAIR_PLAYBOOK) silently skipped every other
  // uncertified P0 (audit 2026-06-11 angle mort: catalog, finance, logistics,
  // support, governance had no action at all). Now: every uncertified department
  // that is curated OR P0 gets a repair/certification action.
  for (const d of departments) {
    if (d.certification === 'CERTIFIED') continue; // already trustworthy

    const pb = REPAIR_PLAYBOOK[d.id];
    if (!pb && d.priority !== 'P0') continue; // curated always; generic only for P0
    const w = pb ?? GENERIC_P0_REPAIR;

    out.push({
      id: `repair:${d.id}`,
      title: `Fiabiliser « ${d.label} » (source ${d.certification})`,
      department: d.id,
      source: w.source,
      action_type: d.certification === 'BROKEN' ? 'repair' : 'certification',
      impact: w.impact,
      urgency: w.urgency,
      // canon is reliable about WHAT is broken → high confidence in the need to fix
      data_confidence: CONFIDENCE_BY_CERT.CERTIFIED,
      effort: w.effort,
      risk: w.risk,
      reason: `Le département est ${d.certification} dans la carte opérationnelle — ses signaux ne sont pas fiables tant qu'il n'est pas certifié.`,
      evidence: [
        '.spec/00-canon/ai-registry/agent-operating-map.yaml',
        `dept:${d.id}`,
      ],
      next_step:
        pb?.step ??
        `Définir le verdict de fiabilité de « ${d.label} » (preuve + certification au canon) avant d'exploiter ses signaux.`,
    });
  }

  // incomplete handoffs that feed sales/catalog are commerce-loop blockers
  for (const c of chains) {
    if (!c.incomplete) continue;
    if (c.to !== 'sales' && c.to !== 'catalog') continue;
    out.push({
      id: `wire:${c.id}`,
      title: `Câbler le contrat ${c.from}→${c.to} (${c.state})`,
      department: c.from,
      source: (REPAIR_PLAYBOOK[c.from]?.source ??
        'governance') as RawAction['source'],
      action_type: 'certification',
      impact: 7,
      urgency: 6,
      data_confidence: CONFIDENCE_BY_CERT.CERTIFIED,
      effort: 4,
      risk: 2,
      reason: `Handoff ${c.from}→${c.to} en état ${c.state} (incomplet) — la chaîne commerce casse ici.`,
      evidence: [
        '.spec/00-canon/ai-registry/agent-operating-map.yaml',
        `chain:${c.id}`,
      ],
      next_step: `Définir/valider le contrat ${c.id} (gate + preuve) pour fermer la chaîne.`,
    });
  }

  return out;
}

export type { DeptView, ChainView };
