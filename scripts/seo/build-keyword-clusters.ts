/**
 * Build SEO keyword clusters from __seo_keywords data.
 *
 * For each gamme with keywords:
 *   1. Loads ALL keywords (no V-Level filter)
 *   2. Classifies search intent (regex-based)
 *   3. Segments keywords by page role (R1, R3/guide, R3/conseils, R4, R5)
 *   4. Generates forbidden_overlap per role (from page-roles.md vocabulary)
 *   5. Builds a SeoCluster object
 *   6. Optionally writes seo_cluster YAML into gamme .md files
 *   7. Optionally populates __seo_page_brief (never overwrites manual briefs)
 *
 * Usage:
 *   npx tsx scripts/seo/build-keyword-clusters.ts <pg_alias|--all> [options]
 *
 * Options:
 *   --dry-run          Print results without writing anything
 *   --write-md         Write seo_cluster block into gamme .md files
 *   --populate-briefs  UPSERT keywords into __seo_page_brief
 *   --output=json      Write report JSON to /tmp/
 *   --overwrite        Overwrite existing auto-cluster data (never manual)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as yaml from 'js-yaml';

// ── Load environment ─────────────────────────────────────────────────────────

dotenv.config({ path: path.join(__dirname, '../../backend/.env'), quiet: true } as dotenv.DotenvConfigOptions);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const RAG_KNOWLEDGE_PATH =
  process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';
let RAG_GAMMES_DIR = path.join(RAG_KNOWLEDGE_PATH, 'gammes');

// ── Logging (M10: diagnostic → stderr, JSON → stdout) ───────────────────────

/** Diagnostic/progress output → stderr (never pollutes JSON stdout) */
function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

/** Warning output → stderr */
function logWarn(msg: string): void {
  process.stderr.write('[WARN] ' + msg + '\n');
}

// ── Types ────────────────────────────────────────────────────────────────────

interface KeywordRow {
  keyword: string;
  keyword_normalized: string;
  v_level: string | null;
  volume: number;
  type: string | null; // 'vehicle' | 'brand' | 'generic'
  model: string | null;
  energy: string | null;
  pg_id: number;
}

export type SearchIntent =
  | 'transactionnelle'
  | 'informationnelle'
  | 'diagnostique'
  | 'navigationnelle';

export type PageRole = 'R1' | 'R3_guide' | 'R3_conseils' | 'R4' | 'R5';

interface ClassifiedKeyword extends KeywordRow {
  intent: SearchIntent;
}

interface RoleKeywords {
  primary: string | null;
  primary_volume: number;
  secondary: string[];
}

interface SeoCluster {
  pgId: number;
  pgAlias: string;
  primaryKeyword: { text: string; volume: number; intent: SearchIntent };
  keywordVariants: Array<{
    keyword: string;
    volume: number;
    v_level: string | null;
    intent: SearchIntent;
  }>;
  paaQuestions: string[];
  roleKeywords: Record<PageRole, RoleKeywords>;
  forbiddenOverlap: Record<PageRole, string[]>;
  source: 'keyword-dataset';
  schemaVersion: '1.0';
}

interface ClusterBuildResult {
  pgAlias: string;
  pgId: number;
  status: 'built' | 'skipped_no_keywords' | 'skipped_exists' | 'error';
  keywordsProcessed: number;
  rolesCovered: PageRole[];
  cluster?: SeoCluster;
  error?: string;
}

// ── Intent classification (deterministic regex) ──────────────────────────────

const INTENT_RULES: Array<{ pattern: RegExp; intent: SearchIntent }> = [
  // Diagnostique — symptomes, pannes, problemes
  {
    pattern:
      /(?:^|\s)(symptome|bruit|fuite|vibration|voyant|panne|probleme|claquement|sifflement|grince|tremble|casse|defaillance|usure|use)/i,
    intent: 'diagnostique',
  },
  // Navigationnelle — definitions, termes techniques
  {
    pattern:
      /(?:^|\s)(definition|c'est quoi|qu'est.ce qu|role |fonction |signification|glossaire|compose de)/i,
    intent: 'navigationnelle',
  },
  // Informationnelle — guides, conseils, how-to
  {
    pattern:
      /(?:^|\s)(comment |pourquoi |quand |quel |quelle |guide |conseil |choisir |meilleur |comparatif|entretien|remplacement|changer |remplacer |duree de vie|frequence)/i,
    intent: 'informationnelle',
  },
  // Transactionnelle — achat, prix
  {
    pattern:
      /(?:^|\s)(acheter|achat|prix|tarif|pas cher|commander|promo|promotion|solde|discount|livraison)/i,
    intent: 'transactionnelle',
  },
];

function inferIntent(keyword: string): SearchIntent {
  const normalized = keyword
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.intent;
    }
  }

  // Default: informationnelle (generic product keywords are informational searches)
  return 'informationnelle';
}

// ── Role ↔ Intent affinity matrix ────────────────────────────────────────────

const ROLE_INTENT_AFFINITY: Record<PageRole, SearchIntent[]> = {
  R1: ['transactionnelle', 'navigationnelle'],
  R3_guide: ['informationnelle'],
  R3_conseils: ['diagnostique', 'informationnelle'],
  R4: ['navigationnelle', 'informationnelle'],
  R5: ['diagnostique'],
};

// More specific patterns for role assignment (overrides general intent)
const ROLE_KEYWORD_PATTERNS: Record<PageRole, RegExp> = {
  R1: /(?:^|\s)(acheter|achat|prix|tarif|pas cher|commander|voiture|auto )/i,
  R3_guide:
    /(?:^|\s)(comment choisir|guide|meilleur|comparatif|quel |quelle |plein ou ventile|ventile ou plein|critere)/i,
  R3_conseils:
    /(?:^|\s)(quand changer|quand remplacer|entretien|remplacement|duree de vie|frequence|comment remplacer|comment changer|epaisseur mini|usure)/i,
  R4: /(?:^|\s)(definition|c'est quoi|qu'est|role |fonction |compose|glossaire)/i,
  R5: /(?:^|\s)(symptome|bruit|vibration|voyant|panne|probleme|claquement|sifflement|diagnostic)/i,
};

/**
 * Generate synthetic keywords for roles that have no natural keyword match.
 * Based on the "question core" of each role from page-roles.md:
 *   R1: "{gamme}" (navigation)
 *   R3/guide: "comment choisir {gamme}" (purchase guidance)
 *   R3/conseils: "quand changer {gamme}" (maintenance/replacement)
 *   R4: "{gamme} definition" (encyclopedic)
 *   R5: "symptome {gamme} use" (diagnostic)
 */
function generateSyntheticKeywords(
  gammeName: string,
): Record<PageRole, { primary: string; secondary: string[] }> {
  return {
    R1: {
      primary: gammeName,
      secondary: [
        `${gammeName} voiture`,
        `${gammeName} auto`,
      ],
    },
    R3_guide: {
      primary: `comment choisir ${gammeName}`,
      secondary: [
        `guide achat ${gammeName}`,
        `meilleur ${gammeName}`,
        `quel ${gammeName} choisir`,
        `comparatif ${gammeName}`,
      ],
    },
    R3_conseils: {
      primary: `quand changer ${gammeName}`,
      secondary: [
        `quand remplacer ${gammeName}`,
        `duree de vie ${gammeName}`,
        `comment remplacer ${gammeName}`,
        `entretien ${gammeName}`,
      ],
    },
    R4: {
      primary: `${gammeName} definition`,
      secondary: [
        `qu'est-ce qu'un ${gammeName}`,
        `role ${gammeName}`,
        `fonction ${gammeName}`,
        `a quoi sert ${gammeName}`,
      ],
    },
    R5: {
      primary: `symptome ${gammeName} use`,
      secondary: [
        `bruit ${gammeName}`,
        `probleme ${gammeName}`,
        `panne ${gammeName}`,
        `${gammeName} hs`,
      ],
    },
  };
}

function segmentByRole(
  keywords: ClassifiedKeyword[],
  gammeName: string,
): Record<PageRole, RoleKeywords> {
  const buckets: Record<PageRole, ClassifiedKeyword[]> = {
    R1: [],
    R3_guide: [],
    R3_conseils: [],
    R4: [],
    R5: [],
  };

  for (const kw of keywords) {
    const normalized = kw.keyword
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // First: try specific role pattern match
    let assigned = false;
    for (const [role, pattern] of Object.entries(ROLE_KEYWORD_PATTERNS)) {
      if (pattern.test(normalized)) {
        buckets[role as PageRole].push(kw);
        assigned = true;
        break;
      }
    }

    // Fallback: use intent affinity
    if (!assigned) {
      for (const [role, intents] of Object.entries(ROLE_INTENT_AFFINITY)) {
        if (intents.includes(kw.intent)) {
          buckets[role as PageRole].push(kw);
          break;
        }
      }
    }
  }

  // Build role keywords: primary = highest volume, secondary = top 5 remaining
  const result: Record<PageRole, RoleKeywords> = {} as any;
  const synthetics = generateSyntheticKeywords(gammeName);

  for (const [role, bucket] of Object.entries(buckets)) {
    const sorted = bucket.sort((a, b) => b.volume - a.volume);
    const deduplicated = deduplicateKeywords(sorted);

    if (deduplicated.length > 0) {
      // Natural keywords found
      result[role as PageRole] = {
        primary: deduplicated[0].keyword,
        primary_volume: deduplicated[0].volume,
        secondary: deduplicated.slice(1, 6).map((k) => k.keyword),
      };
    } else {
      // No natural keyword → use synthetic
      const synth = synthetics[role as PageRole];
      result[role as PageRole] = {
        primary: synth.primary,
        primary_volume: 0, // 0 = synthetic, no real volume data
        secondary: synth.secondary,
      };
    }
  }

  return result;
}

function deduplicateKeywords(
  keywords: ClassifiedKeyword[],
): ClassifiedKeyword[] {
  const seen = new Set<string>();
  return keywords.filter((kw) => {
    const norm = kw.keyword
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

// ── Forbidden overlap per role (from page-roles.md vocabulary) ───────────────

const FORBIDDEN_OVERLAP: Record<PageRole, string[]> = {
  R1: [
    // INTERDIT sur R1 (vient d'autres roles)
    'bruit',
    'usé',
    'cassé',
    'problème',
    'symptôme',
    'panne',
    'défaillance',
    'vibration',
    'claquement',
    'quand',
    'pourquoi',
    'comment diagnostiquer',
    'définition',
    "qu'est-ce que",
    'composé de',
    'glossaire',
    'démontage',
    'remontage',
    'étapes de remplacement',
    "guide d'achat",
    'prix',
    '€',
    'en stock',
    'livraison',
    'ajouter au panier',
  ],
  R3_guide: [
    // INTERDIT sur R3 general + guide-specific
    'sélectionnez votre véhicule',
    'filtrer par',
    'trier par',
    'tous les véhicules compatibles',
    'démontage',
    'remontage',
    'étapes de remplacement',
    'couple de serrage',
    'essai routier',
    'code DTC',
    'code OBD',
    'définition',
    "qu'est-ce que",
    'composé de',
    'glossaire',
    'prix',
    '€',
    'en stock',
    'ajouter au panier',
  ],
  R3_conseils: [
    // INTERDIT sur R3/conseils
    'sélectionnez votre véhicule',
    'filtrer par',
    'tous les véhicules compatibles',
    'définition',
    "qu'est-ce que",
    'composé de',
    'au sens strict',
    'glossaire',
    'diagnostiquer',
    'bruit anormal',
    'code DTC',
    'code OBD',
    "guide d'achat",
    'commander',
    'ajouter au panier',
    'prix',
    '€',
    'en stock',
    'livraison',
    'promotion',
  ],
  R4: [
    // INTERDIT sur R4
    'prix',
    '€',
    'euro',
    'acheter',
    'commander',
    'ajouter au panier',
    'livraison',
    'en stock',
    'promotion',
    'sélectionnez votre véhicule',
    'filtrer par',
    'tous les véhicules compatibles',
    'démontage',
    'remontage',
    'étapes de remplacement',
    'symptôme',
    'bruit anormal',
    'panne',
    'diagnostic',
  ],
  R5: [
    // INTERDIT sur R5
    'prix',
    '€',
    'euro',
    'acheter',
    'commander',
    'ajouter au panier',
    'livraison',
    'en stock',
    'promotion',
    "guide d'achat",
    'définition',
    'composé de',
    'glossaire',
    'sélectionnez votre véhicule',
  ],
};

// ── Cluster building ─────────────────────────────────────────────────────────

/**
 * Check if a keyword is loosely pertinent to the gamme.
 * At least one significant gamme term (>3 chars) must appear in the keyword.
 */
function isKeywordPertinent(keyword: string, gammeName: string): boolean {
  const kwNorm = keyword
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const gammeTerms = gammeName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 3);

  return gammeTerms.some((term) => kwNorm.includes(term));
}

/**
 * Strict pertinence: ALL significant gamme terms must appear in the keyword.
 * Used for primary keyword selection to avoid cross-gamme pollution.
 * e.g., "plaquette de frein" → "plaquette" AND "frein" must both be present.
 */
function isKeywordStrictlyPertinent(
  keyword: string,
  gammeName: string,
): boolean {
  const kwNorm = keyword
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const gammeTerms = gammeName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 3);

  return gammeTerms.every((term) => kwNorm.includes(term));
}

function buildCluster(
  pgAlias: string,
  pgId: number,
  keywords: KeywordRow[],
): SeoCluster {
  // Derive gamme display name
  const gammeName = pgAlias.replace(/-/g, ' ');

  // 0. Filter pertinence: prefer strict (ALL gamme terms present),
  //    fallback to loose (ANY gamme term) if strict yields < 5 results
  const strictPertinent = keywords.filter((kw) =>
    isKeywordStrictlyPertinent(kw.keyword, gammeName),
  );
  const loosePertinent = keywords.filter((kw) =>
    isKeywordPertinent(kw.keyword, gammeName),
  );

  const effective =
    strictPertinent.length >= 5
      ? strictPertinent
      : loosePertinent.length > 0
        ? loosePertinent
        : keywords;

  log(
    `  Pertinence: ${strictPertinent.length} strict / ${loosePertinent.length} loose / ${keywords.length} total → using ${effective.length}`,
  );

  // 1. Classify intent for each keyword
  const classified: ClassifiedKeyword[] = effective.map((kw) => ({
    ...kw,
    intent: inferIntent(kw.keyword),
  }));

  // 2. Select primary keyword (highest volume, strictly pertinent to THIS gamme)
  const sortedByVolume = [...classified].sort((a, b) => b.volume - a.volume);
  const strictlyPertinent = sortedByVolume.filter((kw) =>
    isKeywordStrictlyPertinent(kw.keyword, gammeName),
  );
  const primary =
    strictlyPertinent.length > 0 ? strictlyPertinent[0] : sortedByVolume[0];

  // 3. Build variants (top 20 unique keywords excluding primary, by volume)
  const variants = deduplicateKeywords(
    sortedByVolume.filter(
      (k) =>
        k.keyword.toLowerCase() !== primary.keyword.toLowerCase(),
    ),
  ).slice(0, 20);

  // 4. Segment by role (with synthetic fallback for roles without natural keywords)
  const roleKeywords = segmentByRole(classified, gammeName);

  // 5. Build forbidden overlap per role
  const forbiddenOverlap: Record<PageRole, string[]> = {} as any;
  for (const role of Object.keys(FORBIDDEN_OVERLAP) as PageRole[]) {
    forbiddenOverlap[role] = FORBIDDEN_OVERLAP[role];
  }

  return {
    pgId,
    pgAlias,
    primaryKeyword: {
      text: primary.keyword,
      volume: primary.volume,
      intent: primary.intent,
    },
    keywordVariants: variants.map((v) => ({
      keyword: v.keyword,
      volume: v.volume,
      v_level: v.v_level,
      intent: v.intent,
    })),
    paaQuestions: [],
    roleKeywords,
    forbiddenOverlap,
    source: 'keyword-dataset',
    schemaVersion: '1.0',
  };
}

// ── DB operations ────────────────────────────────────────────────────────────

async function loadGammesWithKeywords(): Promise<
  Array<{ pg_id: number; pg_alias: string }>
> {
  // Use a targeted query to get distinct pg_ids efficiently
  // Supabase default limit is 1000, so paginate to get all
  const allPgIds = new Set<number>();
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('__seo_keywords')
      .select('pg_id')
      .not('pg_id', 'is', null)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Failed to load keywords: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      allPgIds.add(row.pg_id);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const pgIds = [...allPgIds];
  if (pgIds.length === 0) return [];

  const { data: gammes, error: gErr } = await supabase
    .from('pieces_gamme')
    .select('pg_id, pg_alias')
    .in('pg_id', pgIds);

  if (gErr) throw new Error(`Failed to load gammes: ${gErr.message}`);
  return (gammes || []).map((g: any) => ({
    pg_id: g.pg_id,
    pg_alias: g.pg_alias,
  }));
}

async function loadKeywordsForGamme(pgId: number): Promise<KeywordRow[]> {
  // Paginate to get ALL keywords (some gammes have >1000)
  const allRows: KeywordRow[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('__seo_keywords')
      .select(
        'keyword, keyword_normalized, v_level, volume, type, model, energy, pg_id',
      )
      .eq('pg_id', pgId)
      .order('volume', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error)
      throw new Error(`Failed to load keywords for pg_id=${pgId}: ${error.message}`);
    if (!data || data.length === 0) break;

    allRows.push(...(data as KeywordRow[]));

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}

async function upsertCluster(
  cluster: SeoCluster,
  overwrite: boolean,
): Promise<boolean> {
  // Check if exists
  const { data: existing } = await supabase
    .from('__seo_keyword_cluster')
    .select('id, built_by')
    .eq('pg_id', cluster.pgId)
    .maybeSingle();

  if (existing && !overwrite) {
    return false; // Skip
  }

  // Note: overlap_flags is NOT included here — it's managed by audit-cross-gamme-overlap.ts
  // The DB default '[]' handles initial inserts; existing overlap_flags are preserved on upsert
  const row = {
    pg_id: cluster.pgId,
    pg_alias: cluster.pgAlias,
    primary_keyword: cluster.primaryKeyword.text,
    primary_volume: cluster.primaryKeyword.volume,
    primary_intent: cluster.primaryKeyword.intent,
    keyword_variants: cluster.keywordVariants,
    paa_questions: cluster.paaQuestions,
    role_keywords: cluster.roleKeywords,
    source: cluster.source,
    schema_version: cluster.schemaVersion,
    built_at: new Date().toISOString(),
    built_by: 'build-keyword-clusters',
  };

  const { error } = await supabase
    .from('__seo_keyword_cluster')
    .upsert(row, { onConflict: 'pg_id' });

  if (error)
    throw new Error(`Failed to upsert cluster for ${cluster.pgAlias}: ${error.message}`);
  return true;
}

async function populateBriefKeywords(
  cluster: SeoCluster,
  overwrite: boolean,
): Promise<{ created: number; updated: number; skipped: number }> {
  const stats = { created: 0, updated: 0, skipped: 0 };

  // Get cluster ID
  const { data: clusterRow } = await supabase
    .from('__seo_keyword_cluster')
    .select('id')
    .eq('pg_id', cluster.pgId)
    .single();

  const clusterId = clusterRow?.id || null;

  // Map PageRole to brief page_role values
  // R5 is excluded — __seo_page_brief check constraint only allows R1, R3_guide, R3_conseils, R4
  const BRIEF_ROLES: PageRole[] = ['R1', 'R3_guide', 'R3_conseils', 'R4'];

  const roleMapping: Record<string, string> = {
    R1: 'R1',
    R3_guide: 'R3_guide',
    R3_conseils: 'R3_conseils',
    R4: 'R4',
  };

  // Primary intent per role
  const roleIntentMap: Record<string, string> = {
    R1: 'acheter la bonne piece compatible',
    R3_guide: 'choisir la bonne piece',
    R3_conseils: 'savoir quand et comment remplacer',
    R4: 'comprendre le role et la definition',
  };

  for (const role of BRIEF_ROLES) {
    const rk = cluster.roleKeywords[role];
    if (!rk || !rk.primary) continue; // No keyword for this role

    const pageRole = roleMapping[role];
    const forbidden = cluster.forbiddenOverlap[role] || [];

    // Check if brief exists
    const { data: existing } = await supabase
      .from('__seo_page_brief')
      .select('id, keyword_source')
      .eq('pg_id', cluster.pgId)
      .eq('page_role', pageRole)
      .maybeSingle();

    if (existing) {
      // Never overwrite manual briefs
      if (existing.keyword_source === 'manual') {
        stats.skipped++;
        continue;
      }
      if (!overwrite && existing.keyword_source === 'auto-cluster') {
        stats.skipped++;
        continue;
      }

      // Update existing brief
      const { error } = await supabase
        .from('__seo_page_brief')
        .update({
          keywords_primary: rk.primary,
          keywords_secondary: rk.secondary,
          forbidden_overlap: forbidden,
          keyword_source: 'auto-cluster',
          keyword_cluster_id: clusterId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error)
        throw new Error(
          `Failed to update brief ${pageRole} for ${cluster.pgAlias}: ${error.message}`,
        );
      stats.updated++;
    } else {
      // Create new brief
      const { error } = await supabase.from('__seo_page_brief').insert({
        pg_id: cluster.pgId,
        pg_alias: cluster.pgAlias,
        page_role: pageRole,
        primary_intent:
          roleIntentMap[role] ||
          `${cluster.pgAlias} - ${pageRole}`,
        keywords_primary: rk.primary,
        keywords_secondary: rk.secondary,
        forbidden_overlap: forbidden,
        faq_paa: [],
        status: 'draft',
        version: 1,
        created_by: 'build-keyword-clusters',
        keyword_source: 'auto-cluster',
        keyword_cluster_id: clusterId,
      });

      if (error)
        throw new Error(
          `Failed to create brief ${pageRole} for ${cluster.pgAlias}: ${error.message}`,
        );
      stats.created++;
    }
  }

  return stats;
}

// ── Volume-to-v4 field mapping (derived, not stored in DB) ──────────────────

function volumeToTrafficRange(volume: number): string {
  if (volume === 0) return '0/mo';
  return `${Math.round(volume * 0.5)}-${Math.round(volume * 2.5)}/mo`;
}

function volumeToCompetition(volume: number): 'faible' | 'moyenne' | 'forte' {
  if (volume >= 5000) return 'forte';
  if (volume >= 500) return 'moyenne';
  return 'faible';
}

// ── .md file writing ─────────────────────────────────────────────────────────

function buildSeoClusterYaml(cluster: SeoCluster): string {
  const today = new Date().toISOString().split('T')[0];

  const seoCluster: any = {
    source: cluster.source,
    updated_at: today,
    schema_version: cluster.schemaVersion,
    primary_keyword: {
      text: cluster.primaryKeyword.text,
      volume: cluster.primaryKeyword.volume,
      traffic_range: volumeToTrafficRange(cluster.primaryKeyword.volume),
      intent: cluster.primaryKeyword.intent,
    },
    keyword_variants: cluster.keywordVariants.slice(0, 10).map((v) => ({
      keyword: v.keyword,
      volume: v.volume,
      traffic_range: volumeToTrafficRange(v.volume),
      intent: v.intent,
      competition: volumeToCompetition(v.volume),
    })),
    paa_questions: cluster.paaQuestions,
    role_mapping: {} as Record<string, string | null>,
  };

  // Add role mapping (primary keyword per role)
  for (const [role, rk] of Object.entries(cluster.roleKeywords)) {
    seoCluster.role_mapping[role] = rk.primary;
  }

  return yaml.dump({ seo_cluster: seoCluster }, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}

function writeSeoClusterToMd(
  pgAlias: string,
  cluster: SeoCluster,
): { written: boolean; error?: string } {
  const mdPath = path.join(RAG_GAMMES_DIR, `${pgAlias}.md`);

  if (!fs.existsSync(mdPath)) {
    return { written: false, error: `File not found: ${mdPath}` };
  }

  const content = fs.readFileSync(mdPath, 'utf-8');

  // Parse frontmatter boundaries
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return { written: false, error: `No YAML frontmatter found in ${mdPath}` };
  }

  const frontmatterStr = fmMatch[1];
  let frontmatter: any;
  try {
    frontmatter = yaml.load(frontmatterStr);
  } catch (e: any) {
    return {
      written: false,
      error: `Failed to parse frontmatter: ${e.message}`,
    };
  }

  // Guard: never overwrite manual seo_cluster
  if (
    frontmatter.seo_cluster &&
    frontmatter.seo_cluster.source === 'manual'
  ) {
    return { written: false, error: 'seo_cluster.source=manual — skipped' };
  }

  // Build seo_cluster object
  const today = new Date().toISOString().split('T')[0];
  frontmatter.seo_cluster = {
    source: cluster.source,
    updated_at: today,
    schema_version: cluster.schemaVersion,
    primary_keyword: {
      text: cluster.primaryKeyword.text,
      volume: cluster.primaryKeyword.volume,
      traffic_range: volumeToTrafficRange(cluster.primaryKeyword.volume),
      intent: cluster.primaryKeyword.intent,
    },
    keyword_variants: cluster.keywordVariants.slice(0, 10).map((v) => ({
      keyword: v.keyword,
      volume: v.volume,
      traffic_range: volumeToTrafficRange(v.volume),
      intent: v.intent,
      competition: volumeToCompetition(v.volume),
    })),
    paa_questions: cluster.paaQuestions,
    role_mapping: Object.fromEntries(
      Object.entries(cluster.roleKeywords).map(([role, rk]) => [
        role,
        rk.primary,
      ]),
    ),
  };

  // Serialize back
  const newFrontmatter = yaml.dump(frontmatter, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });

  // Validate the output parses correctly
  try {
    yaml.load(newFrontmatter);
  } catch (e: any) {
    return {
      written: false,
      error: `Generated YAML is invalid: ${e.message}`,
    };
  }

  // Body = everything after the closing ---
  const bodyStart = content.indexOf('---', content.indexOf('---') + 3) + 3;
  const body = content.slice(bodyStart);

  // Backup
  const backupPath = `${mdPath}.bak`;
  fs.writeFileSync(backupPath, content, 'utf-8');

  // Write
  const newContent = `---\n${newFrontmatter}---${body}`;
  fs.writeFileSync(mdPath, newContent, 'utf-8');

  // Validate written file
  try {
    const check = fs.readFileSync(mdPath, 'utf-8');
    const checkFm = check.match(/^---\n([\s\S]*?)\n---/);
    if (checkFm) yaml.load(checkFm[1]);
  } catch (e: any) {
    // Restore backup
    fs.writeFileSync(mdPath, content, 'utf-8');
    return {
      written: false,
      error: `Post-write validation failed, restored backup: ${e.message}`,
    };
  }

  // Remove backup on success
  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
  }

  return { written: true };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function processGamme(
  pgAlias: string,
  pgId: number,
  options: {
    dryRun: boolean;
    writeMd: boolean;
    populateBriefs: boolean;
    overwrite: boolean;
  },
): Promise<ClusterBuildResult> {
  try {
    // Load keywords
    const keywords = await loadKeywordsForGamme(pgId);
    if (keywords.length === 0) {
      return {
        pgAlias,
        pgId,
        status: 'skipped_no_keywords',
        keywordsProcessed: 0,
        rolesCovered: [],
      };
    }

    // Build cluster
    const cluster = buildCluster(pgAlias, pgId, keywords);

    // Identify covered roles
    const rolesCovered = (
      Object.entries(cluster.roleKeywords) as Array<[PageRole, RoleKeywords]>
    )
      .filter(([, rk]) => rk.primary !== null)
      .map(([role]) => role);

    if (options.dryRun) {
      return {
        pgAlias,
        pgId,
        status: 'built',
        keywordsProcessed: keywords.length,
        rolesCovered,
        cluster,
      };
    }

    // Write to DB
    const upserted = await upsertCluster(cluster, options.overwrite);
    if (!upserted) {
      return {
        pgAlias,
        pgId,
        status: 'skipped_exists',
        keywordsProcessed: keywords.length,
        rolesCovered,
      };
    }

    // Write to .md
    if (options.writeMd) {
      const mdResult = writeSeoClusterToMd(pgAlias, cluster);
      if (!mdResult.written) {
        logWarn(
          `  ⚠ .md write skipped for ${pgAlias}: ${mdResult.error}`,
        );
      } else {
        log(`  ✓ .md updated: ${pgAlias}.md`);
      }
    }

    // Populate briefs
    if (options.populateBriefs) {
      const briefStats = await populateBriefKeywords(
        cluster,
        options.overwrite,
      );
      log(
        `  ✓ Briefs: ${briefStats.created} created, ${briefStats.updated} updated, ${briefStats.skipped} skipped`,
      );
    }

    return {
      pgAlias,
      pgId,
      status: 'built',
      keywordsProcessed: keywords.length,
      rolesCovered,
      cluster,
    };
  } catch (err: any) {
    return {
      pgAlias,
      pgId,
      status: 'error',
      keywordsProcessed: 0,
      rolesCovered: [],
      error: err.message,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    log(`
Usage: npx tsx scripts/seo/build-keyword-clusters.ts <pg_alias|--all> [options]

Options:
  --execute            Write to DB/filesystem (default is dry-run)
  --dry-run            Explicit dry-run (default behavior, no writes)
  --write-md           Write seo_cluster block into gamme .md files
  --populate-briefs    UPSERT keywords into __seo_page_brief
  --output=json        Write report JSON to /tmp/
  --output=json:stdout Print report JSON to stdout
  --overwrite          Overwrite existing auto-cluster data (never manual)
  --rag-dir=<path>     Override gammes directory (default: ${RAG_GAMMES_DIR})

Examples:
  npx tsx scripts/seo/build-keyword-clusters.ts disque-de-frein
  npx tsx scripts/seo/build-keyword-clusters.ts disque-de-frein --execute --write-md
  npx tsx scripts/seo/build-keyword-clusters.ts --all --execute --populate-briefs
  npx tsx scripts/seo/build-keyword-clusters.ts --all --output=json:stdout
`);
    process.exit(0);
  }

  const explicitExecute = args.includes('--execute');
  const dryRun = !explicitExecute; // dry-run par defaut, --execute pour ecrire
  const writeMd = args.includes('--write-md');
  const populateBriefs = args.includes('--populate-briefs');
  const overwrite = args.includes('--overwrite');
  const outputJsonArg = args.find((a) => a.startsWith('--output='));
  const outputJson = !!outputJsonArg;
  const outputToStdout = outputJsonArg === '--output=json:stdout';
  const isAll = args.includes('--all');
  const ragDirArg = args.find((a) => a.startsWith('--rag-dir='));
  if (ragDirArg) {
    RAG_GAMMES_DIR = ragDirArg.split('=')[1];
  }

  const options = { dryRun, writeMd, populateBriefs, overwrite };

  log('╔══════════════════════════════════════════════╗');
  log('║   SEO Keyword Cluster Builder v1.0           ║');
  log('╚══════════════════════════════════════════════╝');
  log(
    `Mode: ${dryRun ? 'DRY-RUN' : 'EXECUTE'} | Write .md: ${writeMd} | Populate briefs: ${populateBriefs} | Overwrite: ${overwrite}`,
  );
  log('');

  // Resolve target gammes
  let targets: Array<{ pg_id: number; pg_alias: string }>;

  if (isAll) {
    targets = await loadGammesWithKeywords();
    log(`Found ${targets.length} gammes with keywords in __seo_keywords`);
  } else {
    const pgAlias = args.find((a) => !a.startsWith('--'));
    if (!pgAlias) {
      console.error('Error: provide a pg_alias or --all');
      process.exit(1);
    }

    const { data, error } = await supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias')
      .eq('pg_alias', pgAlias)
      .single();

    if (error || !data) {
      console.error(`Error: gamme "${pgAlias}" not found in pieces_gamme`);
      process.exit(1);
    }

    targets = [{ pg_id: data.pg_id, pg_alias: data.pg_alias }];
  }

  // Process
  const results: ClusterBuildResult[] = [];

  for (const target of targets) {
    log(`\n─── ${target.pg_alias} (pg_id=${target.pg_id}) ───`);
    const result = await processGamme(
      target.pg_alias,
      target.pg_id,
      options,
    );
    results.push(result);

    // Print summary
    if (result.status === 'built' && result.cluster) {
      const c = result.cluster;
      log(`  Status: BUILT (${result.keywordsProcessed} keywords)`);
      log(
        `  Primary: "${c.primaryKeyword.text}" (vol=${c.primaryKeyword.volume}, intent=${c.primaryKeyword.intent})`,
      );
      log(`  Variants: ${c.keywordVariants.length}`);
      log(`  Roles covered: ${result.rolesCovered.join(', ')}`);
      for (const [role, rk] of Object.entries(c.roleKeywords)) {
        if (rk.primary) {
          log(
            `    ${role}: "${rk.primary}" (vol=${rk.primary_volume}) + ${rk.secondary.length} secondary`,
          );
        }
      }
    } else {
      log(`  Status: ${result.status}${result.error ? ` — ${result.error}` : ''}`);
    }
  }

  // Summary
  log('\n══════════════════════════════════════════════');
  const built = results.filter((r) => r.status === 'built').length;
  const skippedNoKw = results.filter(
    (r) => r.status === 'skipped_no_keywords',
  ).length;
  const skippedExists = results.filter(
    (r) => r.status === 'skipped_exists',
  ).length;
  const errors = results.filter((r) => r.status === 'error').length;

  log(
    `Built: ${built} | Skipped (no keywords): ${skippedNoKw} | Skipped (exists): ${skippedExists} | Errors: ${errors}`,
  );

  // JSON output
  if (outputJson) {
    const report = results.map((r) => {
      const intentDist: Record<string, number> = {};
      if (r.cluster) {
        intentDist[r.cluster.primaryKeyword.intent] =
          (intentDist[r.cluster.primaryKeyword.intent] || 0) + 1;
        for (const v of r.cluster.keywordVariants) {
          intentDist[v.intent] = (intentDist[v.intent] || 0) + 1;
        }
      }
      return {
        pgAlias: r.pgAlias,
        pgId: r.pgId,
        status: r.status,
        keywordsProcessed: r.keywordsProcessed,
        rolesCovered: r.rolesCovered,
        primaryKeyword: r.cluster?.primaryKeyword || null,
        roleKeywords: r.cluster?.roleKeywords || null,
        intentDistribution: intentDist,
        error: r.error || null,
      };
    });

    if (outputToStdout) {
      // Flat array for piping (backward compat: golden set test, jq)
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      const reportWithMeta = {
        metadata: {
          keyword_rules_version: '1.0',
          intent_rules_version: '1.0',
          generated_at: new Date().toISOString(),
        },
        results: report,
      };
      const reportPath = `/tmp/keyword-cluster-report-${new Date().toISOString().split('T')[0]}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(reportWithMeta, null, 2), 'utf-8');
      log(`\nReport written to: ${reportPath}`);
    }
  }

  // Exit code
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
