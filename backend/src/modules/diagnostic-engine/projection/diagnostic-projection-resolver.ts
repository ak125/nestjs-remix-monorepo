/**
 * Résolution relation WIKI → lien `__diag_symptom_cause_link` (spec §4.5, étape 3).
 *
 * Fonction pure : aucune lecture, aucune écriture. Chaque relation exportée
 * aboutit à EXACTEMENT une ligne — une projection ou un conflit — et le premier
 * contrôle en échec (ordre de `CONFLICT_REASONS`) en donne la raison. Aucune
 * relation n'est inventée ni devinée : zéro ou plusieurs candidats = conflit.
 */
import {
  CAUSE_GAMME_MAP,
  type GammeMapping,
} from '../constants/gamme-map.constants';
import type {
  DiagCause,
  DiagnosticProjectionReference,
} from '../diagnostic-engine.data-service';
import {
  ExportRelationSchema,
  type ConflictReason,
  type ConflictRow,
  type DiagnosticProjectionResolution,
  type ExportRelation,
  type LoadedGammeExport,
  type ProjectionRow,
} from './diagnostic-projection.types';

export function resolveDiagnosticProjection(
  files: LoadedGammeExport[],
  reference: DiagnosticProjectionReference,
  gammeMap: Record<string, GammeMapping[]> = CAUSE_GAMME_MAP,
): DiagnosticProjectionResolution {
  const systemsById = new Map(reference.systems.map((row) => [row.id, row]));
  const symptomsBySlug = new Map(
    reference.symptoms.map((row) => [row.slug, row]),
  );
  const linksByPair = new Map(
    reference.links.map((row) => [`${row.symptom_id}:${row.cause_id}`, row]),
  );
  const causesBySystem = new Map<number, DiagCause[]>();
  for (const cause of [...reference.causes].sort((a, b) => a.id - b.id)) {
    const list = causesBySystem.get(cause.system_id) ?? [];
    list.push(cause);
    causesBySystem.set(cause.system_id, list);
  }

  const projections: ProjectionRow[] = [];
  const conflicts: ConflictRow[] = [];
  let exportedCount = 0;

  for (const file of files) {
    const { envelope } = file;
    // Un lien n'est documenté qu'une fois par fiche ; une autre fiche peut le
    // documenter aussi (clé de provenance = couple lien × fiche).
    const reserved = new Map<number, number>();

    envelope.relations.forEach((raw, relationIndex) => {
      exportedCount += 1;
      const conflict = (
        reason: ConflictReason,
        detail: Record<string, unknown>,
        relation?: ExportRelation,
      ) =>
        conflicts.push({
          wiki_path: envelope.wiki_path,
          gamme_slug: envelope.gamme_slug,
          relation_index: relationIndex,
          symptom_slug: relation?.symptom_slug ?? null,
          system_slug: relation?.system_slug ?? null,
          reason,
          detail,
        });

      const parsed = ExportRelationSchema.safeParse(raw);
      if (!parsed.success) {
        conflict('schema_invalid', {
          issues: parsed.error.issues
            .slice(0, 10)
            .map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
        });
        return;
      }
      const relation = parsed.data;

      if (relation.relation_to_part !== 'possible_cause') {
        conflict(
          'not_a_cause_relation',
          { relation_to_part: relation.relation_to_part },
          relation,
        );
        return;
      }

      const symptom = symptomsBySlug.get(relation.symptom_slug);
      if (!symptom) {
        conflict('unknown_symptom', {}, relation);
        return;
      }

      const system = systemsById.get(symptom.system_id);
      if (!system || system.slug !== relation.system_slug) {
        conflict(
          'system_mismatch',
          { symptom_system_slug: system?.slug ?? null },
          relation,
        );
        return;
      }

      const candidates = (causesBySystem.get(system.id) ?? []).flatMap(
        (cause) => {
          const mapsToGamme = (gammeMap[cause.slug] ?? []).some(
            (gamme) => gamme.slug === envelope.gamme_slug,
          );
          const link = linksByPair.get(`${symptom.id}:${cause.id}`);
          return mapsToGamme && link ? [{ cause, link }] : [];
        },
      );
      if (candidates.length === 0) {
        conflict('no_matching_link', {}, relation);
        return;
      }
      if (candidates.length > 1) {
        conflict(
          'ambiguous_cause',
          {
            cause_slugs: candidates.map((candidate) => candidate.cause.slug),
            link_ids: candidates.map((candidate) => candidate.link.id),
          },
          relation,
        );
        return;
      }
      const { link } = candidates[0];

      const firstRelationIndex = reserved.get(link.id);
      if (firstRelationIndex !== undefined) {
        conflict(
          'duplicate_relation',
          { link_id: link.id, first_relation_index: firstRelationIndex },
          relation,
        );
        return;
      }
      // Réservé AVANT le contrôle de preuve : un doublon reste un doublon même
      // quand la première relation n'est pas prouvée.
      reserved.set(link.id, relationIndex);

      const unproven = relation.sources
        .filter((source) => source.raw_proven !== true)
        .map((source) => source.slug);
      if (unproven.length > 0) {
        conflict(
          'source_not_raw_proven',
          { link_id: link.id, unproven_sources: unproven },
          relation,
        );
        return;
      }

      projections.push({
        link_id: link.id,
        wiki_path: envelope.wiki_path,
        gamme_slug: envelope.gamme_slug,
        wiki_commit: envelope.source_wiki_commit,
        content_hash: envelope.content_hash,
        relation_to_part: 'possible_cause',
        part_role: relation.part_role,
        confidence: relation.evidence.confidence,
        source_policy: relation.evidence.source_policy,
        confidence_score_computed: relation.confidence_score_computed,
        reviewed: relation.evidence.reviewed,
        diagnostic_safe: relation.evidence.diagnostic_safe,
        sources: relation.sources,
      });
    });
  }

  const keys = new Set(
    projections.map((row) => `${row.link_id}\u0000${row.wiki_path}`),
  );
  if (keys.size !== projections.length) {
    throw new Error('diagnostic projection: (link_id, wiki_path) non unique');
  }
  if (projections.length + conflicts.length !== exportedCount) {
    throw new Error(
      `diagnostic projection: ${projections.length} projection(s) + ${conflicts.length} conflit(s) ≠ ${exportedCount} relation(s) exportée(s)`,
    );
  }
  return { exportedCount, projections, conflicts };
}
