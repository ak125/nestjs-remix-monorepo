/**
 * SeoBriefService — générateur de briefs SEO **evidence-driven** (ADR-059/086/090, D1).
 *
 * Compose un brief par surface (R3/R8) à partir de la PROJECTION WIKI (get_active_seo_projection,
 * forme réglée par PR-0 : blocs `content.{content_md, source_ids, truth_level, …}`), JAMAIS depuis le RAG
 * ni le top-kw brut contaminé. Le contenu vient de la vérité métier (WIKI sourcée), il n'est jamais inventé.
 *
 * Gate de substance **déterministe** (le LLM n'est jamais le juge) :
 *   - SUBSTANCE_FLOOR : ≥ N éléments propriétaires par rôle ;
 *   - EVIDENCE_BOUND  : tout élément propriétaire porte un source_id ;
 *   - SOURCE_MIX      : jamais 100 % éditorial/inféré (au moins une preuve db_owned|sourced).
 *
 * Dégradation **observable** (jamais de fallback silencieux, CLAUDE.md) : projection absente / RPC en erreur /
 * flag OFF → `wiki_available=false` + log → l'appelant retombe sur le chemin keyword-first existant.
 * R2 est **exclu au niveau type** (BriefRole) — la page transactionnelle reste la plus stricte, traitée en dernier.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { FeatureFlagsService } from '@config/feature-flags.service';

/** Rôles composables par cette fabrique. **R2 exclu structurellement** (transactionnel = chemin dédié strict). */
export type BriefRole = 'R3_CONSEILS' | 'R3_GUIDE' | 'R8_VEHICLE';

export type BlockTruthLevel = 'db_owned' | 'sourced' | 'inferred' | 'editorial';

export interface SubstanceElement {
  /** Extrait court (PAS le contenu complet — audit/traçabilité, pas une recopie). */
  text: string;
  source_id: string | null;
  truth_level: BlockTruthLevel;
  /** Champ d'origine (section/usefulness_target/block_kind). */
  field: string;
}

export interface SubstanceGateResult {
  pass: boolean;
  /** Nombre d'éléments propriétaires (db_owned|sourced AVEC source_id). */
  count: number;
  floor: number;
  reasons: string[];
}

export interface BriefEvidenceBundle {
  entity_id: string;
  page_role: BriefRole;
  wiki_available: boolean;
  proprietary_count: number;
  substance_gate: SubstanceGateResult;
  brief_source: 'keyword' | 'wiki_evidence';
  brief_fields: {
    angles_obligatoires: string[];
    preuves: string[];
    termes_techniques: string[];
  };
  substance_elements: SubstanceElement[];
  evidence_source_mix: Record<BlockTruthLevel, number>;
  /** Signal de demande GSC (WARN-only, JAMAIS un gate). Additif ultérieur ; jamais fabriqué. */
  demand_signal: Record<string, unknown>;
}

/** Planchers par rôle (constantes nommées — pas de magic number). Calibrables avant passage en BLOCKING. */
export const SUBSTANCE_FLOOR_BY_ROLE: Record<BriefRole, number> = {
  R3_CONSEILS: 5,
  R3_GUIDE: 5,
  R8_VEHICLE: 3,
};

const PROPRIETARY_TRUTH_LEVELS: ReadonlySet<BlockTruthLevel> =
  new Set<BlockTruthLevel>(['db_owned', 'sourced']);

interface ProjectionBlock {
  role?: string;
  block_kind?: string;
  content?: {
    content_md?: string;
    source_ids?: string[];
    truth_level?: BlockTruthLevel;
    section?: string;
    usefulness_target?: string;
  } | null;
}

interface ProjectionEnvelope {
  entity_id: string;
  entity_type: string;
  slug: string;
  facts: unknown[];
  blocks: ProjectionBlock[];
}

// ── Fonctions PURES (déterministes, sans I/O — le cœur testable du gate, partagé avec D2) ──

/**
 * Extrait les éléments d'une liste de blocs projetés (filtre par rôle). PURE.
 * Lit `block.content.truth_level` / `content.source_ids` (forme réglée par PR-0 — DANS content, pas top-level).
 */
export function extractSubstanceElements(
  blocks: ProjectionBlock[],
  role: string,
): SubstanceElement[] {
  const out: SubstanceElement[] = [];
  for (const b of blocks ?? []) {
    if (b.role && b.role !== role) continue;
    const c = b.content ?? {};
    const tl = c.truth_level;
    if (!tl) continue;
    const sids = Array.isArray(c.source_ids)
      ? c.source_ids.filter((s) => typeof s === 'string' && s.length > 0)
      : [];
    out.push({
      text: (c.content_md ?? '').slice(0, 200),
      source_id: sids[0] ?? null,
      truth_level: tl,
      field: c.section ?? c.usefulness_target ?? b.block_kind ?? 'block',
    });
  }
  return out;
}

/** Compte propriétaire = truth_level ∈ {db_owned, sourced} ET ≥1 source_id réel. PURE. */
export function countProprietary(elements: SubstanceElement[]): number {
  return elements.filter(
    (e) => PROPRIETARY_TRUTH_LEVELS.has(e.truth_level) && !!e.source_id,
  ).length;
}

/** Répartition par truth_level. PURE. */
export function sourceMix(
  elements: SubstanceElement[],
): Record<BlockTruthLevel, number> {
  const mix: Record<BlockTruthLevel, number> = {
    db_owned: 0,
    sourced: 0,
    inferred: 0,
    editorial: 0,
  };
  for (const e of elements) mix[e.truth_level] += 1;
  return mix;
}

/**
 * Gate de substance déterministe (PURE). FLOOR + EVIDENCE_BOUND + SOURCE_MIX.
 * Aucune décision LLM. Renvoie des raisons observables (jamais de pass/fail silencieux).
 */
export function evaluateSubstanceGate(
  elements: SubstanceElement[],
  role: BriefRole,
): SubstanceGateResult {
  const floor = SUBSTANCE_FLOOR_BY_ROLE[role];
  const count = countProprietary(elements);
  const mix = sourceMix(elements);
  const reasons: string[] = [];

  if (mix.db_owned + mix.sourced === 0) {
    reasons.push(
      'SOURCE_MIX: 100% éditorial/inféré — aucune preuve propriétaire (db_owned|sourced)',
    );
  }
  const orphan = elements.filter(
    (e) => PROPRIETARY_TRUTH_LEVELS.has(e.truth_level) && !e.source_id,
  ).length;
  if (orphan > 0) {
    reasons.push(
      `EVIDENCE_BOUND: ${orphan} élément(s) propriétaire(s) sans source_id (non comptés)`,
    );
  }
  if (count < floor) {
    reasons.push(
      `SUBSTANCE_FLOOR: ${count}/${floor} éléments propriétaires (contenu trop générique)`,
    );
  }
  return { pass: reasons.length === 0, count, floor, reasons };
}

@Injectable()
export class SeoBriefService extends SupabaseBaseService {
  protected override readonly logger = new Logger(SeoBriefService.name);

  constructor(
    configService: ConfigService,
    @Optional() rpcGate?: RpcGateService,
    @Optional() private readonly featureFlags?: FeatureFlagsService,
  ) {
    super(configService);
    if (rpcGate) this.rpcGate = rpcGate;
  }

  /**
   * Compose un brief evidence-driven depuis la projection WIKI. Dégrade **observable** (wiki_available=false)
   * si flag OFF / projection absente / RPC en erreur → l'appelant retombe sur keyword-first. Ne fabrique jamais.
   */
  async composeBrief(params: {
    pgId?: number;
    pgAlias?: string;
    vehicleSlug?: string;
    pageRole: BriefRole;
  }): Promise<BriefEvidenceBundle> {
    const { pgAlias, vehicleSlug, pageRole } = params;
    const entityId = vehicleSlug
      ? `vehicle:${vehicleSlug}`
      : `gamme:${pgAlias}`;
    const projRole = this.projectionRole(pageRole);

    if (this.featureFlags && !this.featureFlags.seoBriefWikiEnabled) {
      return this.degraded(entityId, pageRole, 'SEO_BRIEF_WIKI_ENABLED=false');
    }

    let env: ProjectionEnvelope | null = null;
    try {
      const { data, error } = await this.callRpc<ProjectionEnvelope | null>(
        'get_active_seo_projection',
        { p_entity_id: entityId, p_role: projRole },
        { source: 'api' },
      );
      if (error) {
        this.logger.warn(
          `projection RPC error ${entityId}: ${error.message} → keyword-first (observable)`,
        );
        return this.degraded(entityId, pageRole, `RPC error: ${error.message}`);
      }
      env = (data as ProjectionEnvelope | null) ?? null;
    } catch (e) {
      this.logger.warn(
        `projection RPC exception ${entityId}: ${String(e)} → keyword-first (observable)`,
      );
      return this.degraded(entityId, pageRole, 'RPC exception');
    }

    if (!env) {
      this.logger.log(
        `projection vide ${entityId} (non projetée) → keyword-first (observable)`,
      );
      return this.degraded(entityId, pageRole, 'projection absente');
    }

    const elements = extractSubstanceElements(env.blocks ?? [], projRole);
    const gate = evaluateSubstanceGate(elements, pageRole);

    return {
      entity_id: entityId,
      page_role: pageRole,
      wiki_available: true,
      proprietary_count: gate.count,
      substance_gate: gate,
      brief_source: 'wiki_evidence',
      brief_fields: {
        angles_obligatoires: [
          ...new Set(elements.map((e) => e.field).filter(Boolean)),
        ],
        preuves: elements
          .map((e) => e.source_id)
          .filter((s): s is string => !!s),
        termes_techniques: [
          ...new Set(
            elements
              .filter((e) => e.truth_level === 'db_owned')
              .map((e) => e.field),
          ),
        ],
      },
      substance_elements: elements,
      evidence_source_mix: sourceMix(elements),
      demand_signal: {},
    };
  }

  /** Rôle de bloc projeté correspondant (R3_CONSEILS/R3_GUIDE partagent les blocs R3_CONSEILS). */
  private projectionRole(role: BriefRole): string {
    return role === 'R8_VEHICLE' ? 'R8_VEHICLE' : 'R3_CONSEILS';
  }

  /** Bundle dégradé observable (wiki indisponible) → l'appelant garde le chemin keyword-first. */
  private degraded(
    entityId: string,
    pageRole: BriefRole,
    reason: string,
  ): BriefEvidenceBundle {
    return {
      entity_id: entityId,
      page_role: pageRole,
      wiki_available: false,
      proprietary_count: 0,
      substance_gate: {
        pass: false,
        count: 0,
        floor: SUBSTANCE_FLOOR_BY_ROLE[pageRole],
        reasons: [reason],
      },
      brief_source: 'keyword',
      brief_fields: {
        angles_obligatoires: [],
        preuves: [],
        termes_techniques: [],
      },
      substance_elements: [],
      evidence_source_mix: {
        db_owned: 0,
        sourced: 0,
        inferred: 0,
        editorial: 0,
      },
      demand_signal: {},
    };
  }
}
