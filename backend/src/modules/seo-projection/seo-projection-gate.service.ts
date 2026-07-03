/**
 * SeoProjectionGateService — les 2 portes du forward-writer (ADR-090 §C4).
 *
 * Le scoring de substance 6-dim (ADR-088) + coverage-map (ADR-089) sont DÉJÀ appliqués côté wiki
 * AVANT la promotion → l'export/seo n'existe que pour des fiches TIER A vérifiées. Ici, les portes
 * NE re-scorent PAS : elles valident l'INTÉGRITÉ DU CONTRAT d'export avant projection DB (zéro
 * couplage cross-repo au scorer wiki).
 *
 *   - CanonGate   : pureté des rôles (roles_allowed/consumers_allowed non vides, blocks ⊆ roles_allowed),
 *                   entity_type canon, identité présente.
 *   - QualityGate : champs requis du contrat exports-seo présents + content_hash (no-op detection aval).
 *
 * Fail-closed : la moindre violation → verdict ok=false → l'entité N'EST PAS projetée, un conflit
 * observable est tracé (jamais de fallback silencieux, ADR-059 §Interdictions).
 */
import { Injectable } from '@nestjs/common';
import {
  type GateVerdict,
  type ProjectionEntityType,
  type SeoProjectionExport,
} from './seo-projection.types';

const CANON_ENTITY_TYPES: ReadonlySet<ProjectionEntityType> = new Set([
  'gamme',
  'vehicle',
  'constructeur',
  'diagnostic',
]);

const REQUIRED_EXPORT_FIELDS: ReadonlyArray<keyof SeoProjectionExport> = [
  'entity_id',
  'entity_type',
  'schema_version',
  'projection_contract_version',
  'source_wiki_commit',
  'wiki_path',
  'content_hash',
  'generated_at',
  'facts',
  'sources',
  'blocks',
  'roles_allowed',
  'consumers_allowed',
];

@Injectable()
export class SeoProjectionGateService {
  /** CanonGate — pureté des rôles + identité canon. */
  canonGate(exp: SeoProjectionExport): GateVerdict {
    const reasons: string[] = [];

    if (!exp.entity_id || typeof exp.entity_id !== 'string') {
      reasons.push('entity_id manquant/invalide');
    }
    if (!CANON_ENTITY_TYPES.has(exp.entity_type)) {
      reasons.push(`entity_type hors canon: ${String(exp.entity_type)}`);
    }
    if (!Array.isArray(exp.roles_allowed) || exp.roles_allowed.length === 0) {
      reasons.push('roles_allowed vide (aucun rôle autorisé)');
    }
    if (
      !Array.isArray(exp.consumers_allowed) ||
      exp.consumers_allowed.length === 0
    ) {
      reasons.push('consumers_allowed vide');
    }
    // Pureté : tout rôle d'un block doit être déclaré dans roles_allowed.
    const allowed = new Set(exp.roles_allowed ?? []);
    for (const b of exp.blocks ?? []) {
      if (b?.role && !allowed.has(b.role)) {
        reasons.push(
          `block role '${b.role}' absent de roles_allowed (impureté de rôle)`,
        );
      }
    }
    return { gate: 'canon', ok: reasons.length === 0, reasons };
  }

  /** QualityGate — intégrité du contrat exports-seo (champs requis + content_hash). */
  qualityGate(exp: SeoProjectionExport): GateVerdict {
    const reasons: string[] = [];
    for (const f of REQUIRED_EXPORT_FIELDS) {
      const v = exp[f];
      if (
        v === undefined ||
        v === null ||
        (typeof v === 'string' && v.trim() === '')
      ) {
        reasons.push(`champ requis absent: ${String(f)}`);
      }
    }
    if (
      typeof exp.content_hash === 'string' &&
      exp.content_hash.trim() === ''
    ) {
      reasons.push('content_hash vide (no-op detection impossible)');
    }
    // Un export sans aucun bloc projetable n'est pas une régression mais n'apporte rien : noop aval, pas un fail.
    return { gate: 'quality', ok: reasons.length === 0, reasons };
  }

  /** Exécute les 2 portes ; ok ssi les deux passent (fail-closed). */
  evaluate(exp: SeoProjectionExport): { ok: boolean; verdicts: GateVerdict[] } {
    const verdicts = [this.canonGate(exp), this.qualityGate(exp)];
    return { ok: verdicts.every((v) => v.ok), verdicts };
  }
}
