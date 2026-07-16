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
 * **Fail-closed sur le contrat de bloc** : un bloc qui revendique un slot canonique DOIT satisfaire
 * le contrat (`content_md` non-vide · `source_ids` tableau de chaînes · `truth_level` ∈
 * `BlockTruthLevel` · `usefulness_target` string|null si présent). Sinon → `block_contract_invalid`,
 * **aucun slot émis** : jamais de valeur synthétique (`''` / `[]`) substituée à un champ requis —
 * ce serait un fail-open déguisé en « verbatim ». Un `content` absent/non-objet rend la section
 * illisible : le bloc ne revendique aucun slot → `unmapped`.
 *
 * **Classification observable** : `mapped` (slot rempli) · `unmapped` (bloc R3 dont la section est
 * absente ou hors-canon — exclu, jamais interprété) · `invalid` (collision de slot · bloc hors
 * contrat · slot requis absent · section requise hors canon). `ready` = aucun `invalid` ET au moins
 * un slot mappé — une projection vide/incomplète n'est JAMAIS présentée comme prête.
 *
 * **Politique de complétude déléguée** : `requiredSections` est **injecté par l'appelant** (des
 * section_id canoniques ; défaut vide). Le mapper n'affirme aucun contrat de rendu non ratifié
 * (D1-contracts `ProjectionRenderContract` = décision vault) ; la source canonique éventuelle des
 * requis est le pack conseil (`requiredSections` par niveau de pack).
 *
 * **DARK** : aucun consumer public ne l'appelle (le branchement runtime R3 = PR P2-R3-D, séparée).
 */
import {
  PLANNABLE_SECTIONS,
  type PlannableSection,
} from '@config/keyword-plan.constants';
import type { BlockTruthLevel } from './seo-projection.types';
import type {
  ProjectionBlock,
  ProjectionEnvelope,
} from './seo-projection-reader.service';

/** Rôle exact traité par ce mapper (page conseils). */
export const R3_MAPPER_ROLE = 'R3_CONSEILS' as const;

/** Vocabulaire canonique des sections R3 (SoT existant — aucune invention locale). */
const CANONICAL_R3_SECTIONS: readonly string[] = PLANNABLE_SECTIONS;

/**
 * Valeurs contractuelles de `truth_level` (SoT : `BlockTruthLevel`, miroir de
 * `exports-seo.schema.json`). Le `Record` force l'**exhaustivité** : ajouter/retirer une valeur au
 * type casse la compilation ici — aucune liste parallèle qui dériverait en silence.
 */
const CONTRACT_TRUTH_LEVELS: Record<BlockTruthLevel, true> = {
  db_owned: true,
  sourced: true,
  inferred: true,
  editorial: true,
};

function isContractTruthLevel(value: unknown): value is BlockTruthLevel {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(CONTRACT_TRUTH_LEVELS, value)
  );
}

/** Rang canonique d'une section (ordre déterministe des sorties). -1 si hors-canon. */
function canonicalRank(section: string): number {
  return CANONICAL_R3_SECTIONS.indexOf(section);
}

/** Comparaison de chaînes par code-point — déterministe, indépendante de la locale ICU. */
function strcmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Contenu de bloc VALIDÉ contre le contrat — aucun champ requis absent ni mal typé. */
interface ValidatedR3Content {
  content_md: string;
  source_ids: string[];
  truth_level: BlockTruthLevel;
  usefulness_target?: string | null;
}

/**
 * Champs du bloc hors contrat (`SeoProjectionBlock` / `exports-seo.schema.json` v1.1.0 :
 * `content_md`, `source_ids`, `truth_level` REQUIS ; `usefulness_target` optionnel `string|null`).
 * Renvoie la liste des champs fautifs, dans un ordre fixe (déterminisme du `detail`).
 */
function blockContractViolations(content: Record<string, unknown>): string[] {
  const bad: string[] = [];
  if (
    typeof content.content_md !== 'string' ||
    content.content_md.length === 0
  ) {
    bad.push('content_md');
  }
  if (
    !Array.isArray(content.source_ids) ||
    !content.source_ids.every((s) => typeof s === 'string')
  ) {
    bad.push('source_ids');
  }
  if (!isContractTruthLevel(content.truth_level)) {
    bad.push('truth_level');
  }
  const target = content.usefulness_target;
  if (target !== undefined && target !== null && typeof target !== 'string') {
    bad.push('usefulness_target');
  }
  return bad;
}

/** Slot R3 mappé — contenu de bloc préservé verbatim (aucune transformation). */
export interface R3Slot {
  section: string;
  content_md: string;
  source_ids: string[];
  truth_level: BlockTruthLevel;
  usefulness_target: string | null;
}

/** Bloc R3 non mappé (section absente ou hors-canon) — signalé, jamais interprété. */
export interface R3UnmappedBlock {
  section: string | null;
  reason: 'missing_section' | 'unknown_section';
  truth_level: string | null;
}

/**
 * Entrée invalide. `block_contract_invalid` = bloc revendiquant un slot canonique mais violant le
 * contrat (fail-closed : aucun slot, aucune valeur synthétique). `required_section_unknown` =
 * faute de configuration des requis (ex. `S2_DIAGNOSTIC` au lieu de `S2_DIAG`), jamais présentée
 * comme un simple contenu manquant.
 */
export interface R3InvalidEntry {
  kind:
    | 'slot_collision'
    | 'required_slot_missing'
    | 'block_contract_invalid'
    | 'required_section_unknown';
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
  /**
   * Sections canoniques requises (injectées par l'appelant ; défaut : aucune). Typées via le SoT
   * `PlannableSection`, MAIS revalidées au runtime : les requis pourront venir d'un pack JSON ou
   * de la DB, hors garantie du compilateur.
   */
  requiredSections?: readonly PlannableSection[];
}

/**
 * Copie verbatim du contenu VALIDÉ dans un slot. Aucune valeur synthétique : les champs requis ont
 * déjà été vérifiés par `blockContractViolations` (un bloc fautif n'arrive jamais ici).
 */
function toSlot(section: string, content: ValidatedR3Content): R3Slot {
  return {
    section,
    content_md: content.content_md,
    source_ids: [...content.source_ids],
    truth_level: content.truth_level,
    // Champ OPTIONNEL du contrat (`string | null`) : absent ⇒ null. Normalisation d'un optionnel,
    // jamais une valeur de remplacement pour un champ requis.
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

  // Regroupe les blocs R3 VALIDÉS par section canonique (order-independent : seul le comptage compte).
  const bySection = new Map<string, ValidatedR3Content[]>();

  for (const block of blocks) {
    if (block?.role !== R3_MAPPER_ROLE) {
      ignoredNonR3 += 1;
      continue;
    }
    const raw: unknown = block.content;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      // `content` absent / non-objet ⇒ section illisible ⇒ le bloc ne revendique aucun slot.
      unmapped.push({
        section: null,
        reason: 'missing_section',
        truth_level: null,
      });
      continue;
    }
    const content = raw as Record<string, unknown>;
    const rawTruth = content.truth_level;
    const truthLevel = typeof rawTruth === 'string' ? rawTruth : null;
    const section = content.section;

    if (typeof section !== 'string' || section.length === 0) {
      unmapped.push({
        section: null,
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

    // Le bloc revendique un slot canonique ⇒ le contrat de bloc devient OBLIGATOIRE (fail-closed).
    const violations = blockContractViolations(content);
    if (violations.length > 0) {
      invalid.push({
        kind: 'block_contract_invalid',
        section,
        detail: `champs hors contrat : ${violations.join(', ')}`,
      });
      continue; // aucun slot émis, aucune valeur synthétique ('' / [])
    }

    const group = bySection.get(section) ?? [];
    group.push(content as unknown as ValidatedR3Content);
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

  // Slots requis (politique injectée par l'appelant) — revalidés au runtime.
  for (const section of requiredSections) {
    if (canonicalRank(section) < 0) {
      // Faute de configuration (ex. S2_DIAGNOSTIC vs S2_DIAG) : ne JAMAIS la présenter comme un
      // simple contenu manquant, sinon un requis mal orthographié deviendrait indétectable.
      invalid.push({
        kind: 'required_section_unknown',
        section,
        detail: `section requise ${section} hors vocabulaire canonique R3 (faute de configuration)`,
      });
      continue;
    }
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
      strcmp(a.section, b.section) ||
      strcmp(a.kind, b.kind) ||
      strcmp(a.detail, b.detail),
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
