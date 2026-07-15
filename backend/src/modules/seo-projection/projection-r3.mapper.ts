/**
 * ProjectionR3Mapper (P2-R3-C) — mappe une `ProjectionEnvelope` (sortie du reader C0,
 * RPC `get_active_seo_projection`) vers un **DTO R3 final**. ADR-059 forward-writer, tronc commun.
 *
 * **PUR & DÉTERMINISTE** : fonction sans I/O, sans RPC, sans Supabase, sans feature flag, sans cache,
 * sans dépendance au writer, sans import de route publique, sans fallback legacy. Même entrée (à
 * l'ordre des blocs près) ⇒ même sortie.
 *
 * **Ne fabrique aucun contenu** : sélectionne les blocs `R3_CONSEILS`, mappe UNIQUEMENT les sections
 * du vocabulaire CANONIQUE existant (`PLANNABLE_SECTIONS` = enum `page-contract-r3.json` section_terms
 * — 0 vocabulaire inventé) vers leur slot, et préserve `content_md` / `source_ids` (provenance
 * préfixée db:|web:|oem:…) / `truth_level` / `usefulness_target` **verbatim**. Rien n'est généré,
 * complété ni reformulé.
 *
 * **Classification observable** : `mapped` (slot rempli) · `unmapped` (bloc R3 dont la section est
 * absente ou hors-canon — exclu, jamais interprété) · `invalid` (collision de slot OU slot requis
 * absent). `ready` = aucun `invalid` ET au moins un slot mappé — une projection vide/incomplète
 * n'est JAMAIS présentée comme prête.
 *
 * **Politique de complétude déléguée** : `requiredSections` est **injecté par l'appelant** (des
 * section_id canoniques ; défaut vide). Le mapper n'affirme aucun contrat de rendu non ratifié
 * (D1-contracts `ProjectionRenderContract` = décision vault) ; la source canonique éventuelle des
 * requis est le pack conseil (`requiredSections` par niveau de pack).
 *
 * **DARK** : aucun consumer public ne l'appelle (le branchement runtime R3 = PR P2-R3-D, séparée).
 */
import { PLANNABLE_SECTIONS } from '@config/keyword-plan.constants';
import type {
  ProjectionBlock,
  ProjectionEnvelope,
} from './seo-projection-reader.service';

/** Rôle exact traité par ce mapper (page conseils). */
export const R3_MAPPER_ROLE = 'R3_CONSEILS' as const;

/** Vocabulaire canonique des sections R3 (SoT existant — aucune invention locale). */
const CANONICAL_R3_SECTIONS: readonly string[] = PLANNABLE_SECTIONS;

/** Rang canonique d'une section (ordre déterministe des sorties). -1 si hors-canon. */
function canonicalRank(section: string): number {
  return CANONICAL_R3_SECTIONS.indexOf(section);
}

/** Comparaison de chaînes par code-point — déterministe, indépendante de la locale ICU. */
function strcmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Slot R3 mappé — contenu de bloc préservé verbatim (aucune transformation). */
export interface R3Slot {
  section: string;
  content_md: string;
  source_ids: string[];
  truth_level: string;
  usefulness_target: string | null;
}

/** Bloc R3 non mappé (section absente ou hors-canon) — signalé, jamais interprété. */
export interface R3UnmappedBlock {
  section: string | null;
  reason: 'missing_section' | 'unknown_section';
  truth_level: string | null;
}

/** Entrée invalide : collision de slot ou slot requis manquant. */
export interface R3InvalidEntry {
  kind: 'slot_collision' | 'required_slot_missing';
  section: string;
  detail: string;
}

/** DTO R3 final produit par le mapper. */
export interface R3MapperResult {
  entityId: string;
  role: typeof R3_MAPPER_ROLE;
  /** true ⟺ 0 `invalid` ET ≥1 slot mappé. Une projection vide/incomplète n'est jamais « prête ». */
  ready: boolean;
  /** Slots mappés, clés = section_id canonique (ordre d'insertion = ordre canonique). */
  slots: Record<string, R3Slot>;
  mapped: string[];
  unmapped: R3UnmappedBlock[];
  invalid: R3InvalidEntry[];
  /** Nombre de blocs non-R3 ignorés (observabilité). */
  ignoredNonR3: number;
}

export interface R3MapperOptions {
  /** Sections canoniques requises (injectées par l'appelant ; défaut : aucune). */
  requiredSections?: readonly string[];
}

/** Copie verbatim du contenu d'un bloc dans un slot (aucune reformulation). */
function toSlot(
  section: string,
  content: NonNullable<ProjectionBlock['content']>,
): R3Slot {
  return {
    section,
    content_md: content.content_md ?? '',
    source_ids: Array.isArray(content.source_ids)
      ? [...content.source_ids]
      : [],
    truth_level: content.truth_level ?? '',
    usefulness_target: content.usefulness_target ?? null,
  };
}

/**
 * Mappe la projection vers le DTO R3. Pur/déterministe. Ne lève jamais sur enveloppe vide/sans R3 :
 * renvoie un résultat explicite non-prêt.
 */
export function mapR3Projection(
  envelope: ProjectionEnvelope,
  options: R3MapperOptions = {},
): R3MapperResult {
  const entityId = envelope?.entity_id ?? '';
  const requiredSections = options.requiredSections ?? [];
  const blocks: ProjectionBlock[] = Array.isArray(envelope?.blocks)
    ? envelope.blocks
    : [];

  const slots: Record<string, R3Slot> = {};
  const mapped: string[] = [];
  const unmapped: R3UnmappedBlock[] = [];
  const invalid: R3InvalidEntry[] = [];
  let ignoredNonR3 = 0;

  // Regroupe les blocs R3 par section canonique (order-independent : seul le comptage compte).
  const bySection = new Map<
    string,
    NonNullable<ProjectionBlock['content']>[]
  >();

  for (const block of blocks) {
    if (block?.role !== R3_MAPPER_ROLE) {
      ignoredNonR3 += 1;
      continue;
    }
    const content = block.content ?? {};
    const section = content.section;
    const truthLevel = content.truth_level ?? null;

    if (typeof section !== 'string' || section.length === 0) {
      unmapped.push({
        section: typeof section === 'string' ? section : null,
        reason: 'missing_section',
        truth_level: truthLevel,
      });
      continue;
    }
    if (canonicalRank(section) < 0) {
      unmapped.push({
        section,
        reason: 'unknown_section',
        truth_level: truthLevel,
      });
      continue;
    }
    const group = bySection.get(section) ?? [];
    group.push(content);
    bySection.set(section, group);
  }

  // Émission des slots / collisions en ordre canonique (déterministe).
  for (const section of CANONICAL_R3_SECTIONS) {
    const group = bySection.get(section);
    if (!group || group.length === 0) continue;
    if (group.length === 1) {
      slots[section] = toSlot(section, group[0]);
      mapped.push(section);
    } else {
      // Collision : aucun slot émis (jamais de last-write-wins).
      invalid.push({
        kind: 'slot_collision',
        section,
        detail: `${group.length} blocs R3 revendiquent le slot ${section}`,
      });
    }
  }

  // Slots requis absents (politique injectée par l'appelant).
  for (const section of requiredSections) {
    if (!(section in slots)) {
      invalid.push({
        kind: 'required_slot_missing',
        section,
        detail: `slot requis ${section} absent de la projection`,
      });
    }
  }

  // Tris déterministes (indépendants de l'ordre d'entrée ET de la locale).
  unmapped.sort(
    (a, b) =>
      strcmp(a.section ?? '', b.section ?? '') ||
      strcmp(a.reason, b.reason) ||
      strcmp(a.truth_level ?? '', b.truth_level ?? ''),
  );
  invalid.sort(
    (a, b) =>
      canonicalRank(a.section) - canonicalRank(b.section) ||
      strcmp(a.kind, b.kind),
  );

  return {
    entityId,
    role: R3_MAPPER_ROLE,
    ready: invalid.length === 0 && mapped.length > 0,
    slots,
    mapped,
    unmapped,
    invalid,
    ignoredNonR3,
  };
}
