/**
 * ProjectionR3Mapper (P2-R3-C, contrat de rendu ADR-106) — mappe une `ProjectionEnvelope` (sortie
 * du reader C0, RPC `get_active_seo_projection`) vers un **DTO R3 final**. ADR-059 forward-writer,
 * tronc commun.
 *
 * **PUR & DÉTERMINISTE** : fonction sans I/O, sans RPC, sans Supabase, sans feature flag, sans cache,
 * sans dépendance au writer, sans import de route publique, sans fallback legacy. Même entrée (à
 * l'ordre des blocs près) ⇒ même sortie.
 *
 * **Contrat de rendu ADR-106 — une seule table (`R3_RENDER_CONTRACT`)** : les blocs portent les
 * sections SÉMANTIQUES du WIKI (ADR-086 §2bis : `function`, `failure_symptoms`…) ; la table D2 les
 * traduit en sections SERVIES (`PLANNABLE_SECTIONS` = enum `page-contract-r3.json` section_terms).
 * Aucune correspondance hors table : ni similarité de nom, ni section servie acceptée telle quelle,
 * ni repli `sg_content` / `rag://`. `S2_DIAG`, `S3`, `S7` et `S_GARAGE` ne viennent jamais du WIKI
 * (D3) : aucune entrée de la table ne les alimente.
 *
 * **Ne fabrique aucun contenu** : chaque composant préserve `content_md` / `source_ids` (provenance
 * préfixée db:|web:|oem:…) / `truth_level` / `usefulness_target` **verbatim**. S2 reçoit deux
 * composants (intervalle, puis signes) juxtaposés dans l'ordre de la table — jamais fusionnés ni
 * reformulés. `safety_warnings` devient un encadré de la première procédure présente (D2/D4).
 *
 * **Fail-closed sur le contrat de bloc** : un bloc qui revendique une position de la table DOIT
 * satisfaire le contrat (`content_md` non-vide · `source_ids` tableau de chaînes · `truth_level` ∈
 * `BlockTruthLevel` · `usefulness_target` string|null si présent). Sinon → `block_contract_invalid`,
 * **aucun composant émis** : jamais de valeur synthétique (`''` / `[]`) substituée à un champ requis.
 * Un `content` absent/non-objet rend la section illisible : le bloc ne revendique rien → `unmapped`.
 *
 * **Classification observable** : `mapped` (slot servi émis) · `unmapped` (section absente, hors
 * table, non projetée en v1, ou encadré sans procédure hôte — exclu, jamais interprété) · `invalid`
 * (collision · bloc hors contrat · composant requis absent).
 *
 * **Complétude = tier M d'ADR-086, traduit par la table (D5)** : `ready` ⟺ aucun `invalid`, donc S1
 * (`function`) ET S2 (`maintenance_interval` + `failure_symptoms`). Les requis vivent DANS la table :
 * l'appelant n'en injecte aucun, et les packs conseil (chemin d'écriture historique) ne s'appliquent
 * pas ici. `safety_warnings` ne compte jamais (D4).
 *
 * **DARK** : seul consommateur = la chaîne de décision R3 (P2-R3-D), derrière
 * `SEO_PROJECTION_READ_V1` + canary, OFF par défaut.
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

/** Version du contrat de rendu R3 (ADR-106 D1) — journalisée avec chaque verdict. */
export const R3_RENDER_CONTRACT_VERSION = '1.0.0' as const;

/** Une entrée de la table D2. */
type R3ContractEntry =
  /** Composant d'un slot servi. `required` = section obligatoire (tier M) d'ADR-086 (D5). */
  | { kind: 'component'; slot: PlannableSection; required: boolean }
  /** Encadré rattaché au premier hôte présent, dans l'ordre donné — jamais de section propre (D4). */
  | { kind: 'callout'; hosts: readonly PlannableSection[] }
  /** Section ADR-086 sans section servie équivalente en v1 — comptée, jamais rendue. */
  | { kind: 'not_projected' };

/**
 * Table D2 d'ADR-106 — SEULE correspondance section WIKI (`R3_CONSEILS/…`) → section servie.
 * L'ordre des entrées fixe l'ordre des composants à l'intérieur d'un slot (S2 : intervalle, puis
 * signes) et l'ordre déterministe des diagnostics.
 */
export const R3_RENDER_CONTRACT = {
  function: { kind: 'component', slot: 'S1', required: true },
  maintenance_interval: { kind: 'component', slot: 'S2', required: true },
  failure_symptoms: { kind: 'component', slot: 'S2', required: true },
  removal_procedure: { kind: 'component', slot: 'S4_DEPOSE', required: false },
  installation_procedure: {
    kind: 'component',
    slot: 'S4_REPOSE',
    required: false,
  },
  post_install_checks: { kind: 'component', slot: 'S6', required: false },
  faq: { kind: 'component', slot: 'S8', required: false },
  safety_warnings: { kind: 'callout', hosts: ['S4_DEPOSE', 'S4_REPOSE'] },
  replacement_guidance: { kind: 'not_projected' },
} as const satisfies Record<string, R3ContractEntry>;

/** Section WIKI connue de la table D2. */
export type R3WikiSection = keyof typeof R3_RENDER_CONTRACT;

const WIKI_SECTION_ORDER = Object.keys(R3_RENDER_CONTRACT) as R3WikiSection[];

/** Vocabulaire canonique des sections servies R3 (SoT existant — aucune invention locale). */
const CANONICAL_R3_SECTIONS: readonly PlannableSection[] = PLANNABLE_SECTIONS;

/** Entrée de la table pour une section, ou `null` (propriété propre uniquement : pas de `constructor`). */
function contractEntry(section: string): R3ContractEntry | null {
  return Object.prototype.hasOwnProperty.call(R3_RENDER_CONTRACT, section)
    ? R3_RENDER_CONTRACT[section as R3WikiSection]
    : null;
}

/** Slot servi qu'occupe une section WIKI (`null` pour un encadré ou une section non projetée). */
function slotOf(entry: R3ContractEntry): PlannableSection | null {
  return entry.kind === 'component' ? entry.slot : null;
}

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

/** Rang d'une section WIKI dans la table (ordre déterministe des diagnostics). */
function wikiRank(section: string): number {
  return (WIKI_SECTION_ORDER as readonly string[]).indexOf(section);
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

/** Composant d'un slot — contenu d'un bloc WIKI préservé verbatim (aucune transformation). */
export interface R3SlotComponent {
  /** Section WIKI d'origine (ADR-086 §2bis). */
  wiki_section: R3WikiSection;
  content_md: string;
  source_ids: string[];
  truth_level: BlockTruthLevel;
  usefulness_target: string | null;
}

/** Slot servi R3 : composants dans l'ordre de la table + encadrés (`safety_warnings`, D4). */
export interface R3Slot {
  section: PlannableSection;
  components: R3SlotComponent[];
  /** Encadrés rattachés — jamais pris en compte dans la complétude. */
  callouts: R3SlotComponent[];
}

/** Bloc R3 non mappé — signalé, jamais interprété ni rendu. */
export interface R3UnmappedBlock {
  section: string | null;
  reason:
    | 'missing_section'
    | 'unknown_section'
    | 'not_projected'
    | 'callout_without_host';
  truth_level: string | null;
}

/**
 * Entrée invalide. `block_contract_invalid` = bloc revendiquant une position de la table mais
 * violant le contrat (fail-closed : aucun composant, aucune valeur synthétique).
 * `required_slot_missing` = composant obligatoire (tier M ADR-086) non livré.
 */
export interface R3InvalidEntry {
  kind: 'slot_collision' | 'required_slot_missing' | 'block_contract_invalid';
  /** Section WIKI à l'origine du défaut — ce qu'il faut corriger en amont. */
  section: string;
  /** Section servie touchée ; `null` pour un encadré, qui n'a pas de section propre. */
  slot: PlannableSection | null;
  detail: string;
}

/** DTO R3 final produit par le mapper. */
export interface R3MapperResult {
  entityId: string;
  role: typeof R3_MAPPER_ROLE;
  renderContractVersion: typeof R3_RENDER_CONTRACT_VERSION;
  /** true ⟺ 0 `invalid` ET ≥1 slot mappé. Une projection vide/incomplète n'est jamais « prête ». */
  ready: boolean;
  /** Slots mappés, clés = section servie canonique (ordre d'insertion = ordre canonique). */
  slots: Partial<Record<PlannableSection, R3Slot>>;
  mapped: PlannableSection[];
  unmapped: R3UnmappedBlock[];
  invalid: R3InvalidEntry[];
  /** Nombre de blocs non-R3 ignorés (observabilité). */
  ignoredNonR3: number;
}

/**
 * Copie verbatim du contenu VALIDÉ. Aucune valeur synthétique : les champs requis ont déjà été
 * vérifiés par `blockContractViolations` (un bloc fautif n'arrive jamais ici).
 */
function toComponent(
  wikiSection: R3WikiSection,
  content: ValidatedR3Content,
): R3SlotComponent {
  return {
    wiki_section: wikiSection,
    content_md: content.content_md,
    source_ids: [...content.source_ids],
    truth_level: content.truth_level,
    // Champ OPTIONNEL du contrat (`string | null`) : absent ⇒ null. Normalisation d'un optionnel,
    // jamais une valeur de remplacement pour un champ requis.
    usefulness_target: content.usefulness_target ?? null,
  };
}

/**
 * Mappe la projection vers le DTO R3 sous le contrat ADR-106. Pur/déterministe. Ne lève jamais sur
 * enveloppe vide/sans R3 : renvoie un résultat explicite non-prêt.
 */
export function mapR3Projection(envelope: ProjectionEnvelope): R3MapperResult {
  const entityId = envelope?.entity_id ?? '';
  const blocks: ProjectionBlock[] = Array.isArray(envelope?.blocks)
    ? envelope.blocks
    : [];

  const slots: Partial<Record<PlannableSection, R3Slot>> = {};
  const mapped: PlannableSection[] = [];
  const unmapped: R3UnmappedBlock[] = [];
  const invalid: R3InvalidEntry[] = [];
  let ignoredNonR3 = 0;

  // Regroupe les blocs R3 VALIDÉS par section WIKI (order-independent : seul le comptage compte).
  const byWikiSection = new Map<R3WikiSection, ValidatedR3Content[]>();

  for (const block of blocks) {
    if (block?.role !== R3_MAPPER_ROLE) {
      ignoredNonR3 += 1;
      continue;
    }
    const raw: unknown = block.content;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      // `content` absent / non-objet ⇒ section illisible ⇒ le bloc ne revendique rien.
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
    const entry = contractEntry(section);
    if (entry === null) {
      // Hors table (y compris une section servie `S*` ou une section WIKI hors enum §2bis) : D3.
      unmapped.push({
        section,
        reason: 'unknown_section',
        truth_level: truthLevel,
      });
      continue;
    }
    if (entry.kind === 'not_projected') {
      unmapped.push({
        section,
        reason: 'not_projected',
        truth_level: truthLevel,
      });
      continue;
    }

    // Le bloc revendique une position de la table ⇒ contrat de bloc OBLIGATOIRE (fail-closed).
    const violations = blockContractViolations(content);
    if (violations.length > 0) {
      invalid.push({
        kind: 'block_contract_invalid',
        section,
        slot: slotOf(entry),
        detail: `champs hors contrat : ${violations.join(', ')}`,
      });
      continue; // aucun composant émis, aucune valeur synthétique ('' / [])
    }

    const wikiSection = section as R3WikiSection;
    const group = byWikiSection.get(wikiSection) ?? [];
    group.push(content as unknown as ValidatedR3Content);
    byWikiSection.set(wikiSection, group);
  }

  // Une seule valeur par section WIKI : une collision disqualifie le slot entier (jamais de
  // last-write-wins, jamais un S2 amputé d'un composant en collision).
  const delivered = new Map<R3WikiSection, ValidatedR3Content>();
  const poisonedSlots = new Set<PlannableSection>();
  for (const wikiSection of WIKI_SECTION_ORDER) {
    const group = byWikiSection.get(wikiSection);
    if (!group || group.length === 0) continue;
    const entry: R3ContractEntry = R3_RENDER_CONTRACT[wikiSection];
    if (group.length === 1) {
      delivered.set(wikiSection, group[0]);
      continue;
    }
    const slot = slotOf(entry);
    if (slot !== null) poisonedSlots.add(slot);
    invalid.push({
      kind: 'slot_collision',
      section: wikiSection,
      slot,
      detail: `${group.length} blocs R3 revendiquent la section ${wikiSection}`,
    });
  }

  // Émission des slots en ordre canonique servi ; composants en ordre de table (déterministe).
  for (const slot of CANONICAL_R3_SECTIONS) {
    if (poisonedSlots.has(slot)) continue;
    const components: R3SlotComponent[] = [];
    for (const wikiSection of WIKI_SECTION_ORDER) {
      const entry: R3ContractEntry = R3_RENDER_CONTRACT[wikiSection];
      const content = delivered.get(wikiSection);
      if (entry.kind === 'component' && entry.slot === slot && content) {
        components.push(toComponent(wikiSection, content));
      }
    }
    if (components.length === 0) continue;
    slots[slot] = { section: slot, components, callouts: [] };
    mapped.push(slot);
  }

  // Encadrés : rattachés au premier hôte présent ; sans hôte, comptés et jamais rendus (D4).
  for (const wikiSection of WIKI_SECTION_ORDER) {
    const entry: R3ContractEntry = R3_RENDER_CONTRACT[wikiSection];
    const content = delivered.get(wikiSection);
    if (entry.kind !== 'callout' || !content) continue;
    const host = entry.hosts.find((h) => slots[h] !== undefined);
    if (host === undefined) {
      unmapped.push({
        section: wikiSection,
        reason: 'callout_without_host',
        truth_level: content.truth_level,
      });
      continue;
    }
    slots[host]?.callouts.push(toComponent(wikiSection, content));
  }

  // Complétude (D5) : chaque composant obligatoire doit avoir été livré (une collision est déjà
  // un `invalid` : le composant en collision n'est pas livré, son voisin de slot l'est).
  for (const wikiSection of WIKI_SECTION_ORDER) {
    const entry: R3ContractEntry = R3_RENDER_CONTRACT[wikiSection];
    if (entry.kind !== 'component' || !entry.required) continue;
    if (!delivered.has(wikiSection)) {
      invalid.push({
        kind: 'required_slot_missing',
        section: wikiSection,
        slot: entry.slot,
        detail: `composant obligatoire ${wikiSection} (tier M ADR-086) non livré : slot ${entry.slot} incomplet`,
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
      wikiRank(a.section) - wikiRank(b.section) ||
      strcmp(a.kind, b.kind) ||
      strcmp(a.detail, b.detail),
  );

  return {
    entityId,
    role: R3_MAPPER_ROLE,
    renderContractVersion: R3_RENDER_CONTRACT_VERSION,
    ready: invalid.length === 0 && mapped.length > 0,
    slots,
    mapped,
    unmapped,
    invalid,
    ignoredNonR3,
  };
}
