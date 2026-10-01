/**
 * Règle unique des liens vers une page détail guide d'achat (ADR-103 D5, vault).
 *
 * Hors des pages guide, un lien `/blog-pieces-auto/guide-achat/{alias}` est servi :
 *   - drapeau `SEO_R6_CONSOLIDATION_ENABLED` éteint : seulement si le guide est
 *     publié (guide d'achat non brouillon `__seo_gamme_purchase_guide`, ou guide
 *     historique non déprécié `__blog_guide`) ;
 *   - drapeau allumé : jamais. Le lien vise l'article conseils de la gamme
 *     (`/blog-pieces-auto/conseils/{alias}`) s'il existe et n'est pas la page
 *     courante et si la page ne le lie pas déjà, sinon il disparaît (doublon).
 *
 * Le backend décide, le frontend affiche. Le contenu stocké n'est jamais réécrit :
 * la règle s'applique à la lecture. HTML traité par expressions régulières, sans
 * parseur DOM (coût de rendu : le sanitizer jsdom a coûté l'INP en sept. 2026).
 *
 * Hors règle : le hub `/blog-pieces-auto/guide-achat`, la page autonome du
 * sélecteur (route statique frontend) et toute URL absolue.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import {
  CACHE_STRATEGIES,
  getCacheKey,
} from '../../../config/cache-ttl.config';
import { FeatureFlagsService } from '../../../config/feature-flags.service';

export interface R6GuideLinkSnapshot {
  consolidationEnabled: boolean;
  /** Alias des guides publiés (gamme ou guide historique). */
  publishedGuideAliases: Set<string>;
  /** Alias des gammes servies par une page conseils (même gate que `R6GuideService.getRedirectTarget`). */
  conseilsAliases: Set<string>;
}

export interface R6GuideLinkContext {
  /** Chemin de la page qui sert le lien (sans domaine). */
  currentPath: string;
  /**
   * Chemins déjà liés par la page. Partagé entre les sections dans l'ordre de
   * rendu : les liens servis y sont ajoutés au fil du traitement.
   */
  linkedPaths?: Set<string>;
}

export interface GuideLinkHtmlResult {
  html: string;
  /** Nombre de liens modifiés (retirés ou redirigés). */
  changed: number;
}

/**
 * Segments de clé des caches de page dont le contenu dépend du drapeau : une
 * bascule du drapeau change de clé, aucune page n'est servie avec l'ancienne règle.
 */
export const R6_GUIDE_LINK_CACHE_SEGMENTS = ['r6c0', 'r6c1'] as const;
export type R6GuideLinkCacheSegment =
  (typeof R6_GUIDE_LINK_CACHE_SEGMENTS)[number];

/** Marqueur d'erreur cherchable dans les logs (snapshot non chargé). */
export const R6_GUIDE_LINK_SNAPSHOT_FAILED = 'R6_GUIDE_LINK_SNAPSHOT_FAILED';

const GUIDE_PREFIX = '/blog-pieces-auto/guide-achat/';
const CONSEILS_PREFIX = '/blog-pieces-auto/conseils/';

/**
 * Pages guide-achat qui ne sont pas des guides de gamme : route statique
 * `frontend/app/routes/blog-pieces-auto.guide-achat.comment-utiliser-selecteur-vehicule-pieces-auto.tsx`.
 */
const STANDALONE_GUIDE_SLUGS: ReadonlySet<string> = new Set([
  'comment-utiliser-selecteur-vehicule-pieces-auto',
]);

const GUIDE_PATH_RE =
  /^\/blog-pieces-auto\/guide-achat\/([^/?#\s"']+)\/?(?:[?#].*)?$/;
const CONSEILS_PATH_RE =
  /^\/blog-pieces-auto\/conseils\/([^/?#\s"']+)\/?(?:[?#].*)?$/;
const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
const HREF_ATTR_RE = /(\bhref\s*=\s*)(["'])([^"']*)\2/i;
const HREF_VALUE_RE = /\bhref\s*=\s*(["'])([^"']*)\1/gi;

const guidePath = (alias: string) => `${GUIDE_PREFIX}${alias}`;
const conseilsPath = (alias: string) => `${CONSEILS_PREFIX}${alias}`;

/** Alias de gamme d'un lien vers une page détail guide d'achat, sinon null. */
export function guideAliasFromHref(href: string): string | null {
  const m = GUIDE_PATH_RE.exec(href);
  if (!m || STANDALONE_GUIDE_SLUGS.has(m[1])) return null;
  return m[1];
}

/** Chemin conseils normalisé (sans requête, ancre ni barre finale), sinon null. */
function conseilsPathFromHref(href: string): string | null {
  const m = CONSEILS_PATH_RE.exec(href);
  return m ? conseilsPath(m[1]) : null;
}

/**
 * Cible servie pour un lien vers le guide `alias`, ou null s'il ne doit pas être servi.
 * Drapeau éteint, le seul effet est le retrait des liens vers un guide non publié
 * (ADR-103 D5) : pas de retrait de doublon.
 */
export function resolveGuideLink(
  alias: string,
  snapshot: R6GuideLinkSnapshot,
  ctx: R6GuideLinkContext,
): string | null {
  if (!snapshot.consolidationEnabled) {
    return snapshot.publishedGuideAliases.has(alias) ? guidePath(alias) : null;
  }
  if (!snapshot.conseilsAliases.has(alias)) return null;
  const target = conseilsPath(alias);
  if (target === ctx.currentPath) return null;
  if (ctx.linkedPaths?.has(target)) return null;
  return target;
}

/**
 * Applique la règle aux liens d'un fragment HTML : lien gardé, redirigé
 * (seul le `href` change) ou déplié (le texte reste, la balise `<a>` part).
 * Les liens conseils déjà présents dans le fragment comptent comme liés.
 */
export function applyGuideLinkRuleToHtml(
  html: string,
  snapshot: R6GuideLinkSnapshot,
  ctx: R6GuideLinkContext,
): GuideLinkHtmlResult {
  const linkedPaths = ctx.linkedPaths ?? new Set<string>();
  const hasConseils = html.includes(CONSEILS_PREFIX);
  if (hasConseils) {
    for (const m of html.matchAll(HREF_VALUE_RE)) {
      const p = conseilsPathFromHref(m[2]);
      if (p) linkedPaths.add(p);
    }
  }
  if (!html.includes(GUIDE_PREFIX)) return { html, changed: 0 };

  const scoped: R6GuideLinkContext = {
    currentPath: ctx.currentPath,
    linkedPaths,
  };
  let changed = 0;
  const out = html.replace(
    ANCHOR_RE,
    (anchor, attrs: string, inner: string) => {
      const hrefMatch = HREF_ATTR_RE.exec(attrs);
      if (!hrefMatch) return anchor;
      const href = hrefMatch[3];
      const alias = guideAliasFromHref(href);
      if (alias === null) return anchor;

      const target = resolveGuideLink(alias, snapshot, scoped);
      if (target === null) {
        changed++;
        return inner;
      }
      linkedPaths.add(target);
      if (target === guidePath(alias)) return anchor;
      changed++;
      const [whole, lead, quote] = hrefMatch;
      const at = hrefMatch.index;
      const newAttrs =
        attrs.slice(0, at) +
        `${lead}${quote}${target}${quote}` +
        attrs.slice(at + whole.length);
      // `<a` (2 caractères) + attributs + reste de la balise
      return anchor.slice(0, 2) + newAttrs + anchor.slice(2 + attrs.length);
    },
  );
  return { html: changed === 0 ? html : out, changed };
}

/**
 * Applique la règle à des blocs de liens structurés (maillage R1) : item
 * gardé, href redirigé, ou item retiré ; un bloc vidé est retiré.
 * Ne modifie pas le payload reçu.
 */
export function applyGuideLinkRuleToBlocks<
  I extends { href: string },
  B extends { items: I[] },
  P extends { blocks: B[] },
>(payload: P, snapshot: R6GuideLinkSnapshot, ctx: R6GuideLinkContext): P {
  const linkedPaths = ctx.linkedPaths ?? new Set<string>();
  const scoped: R6GuideLinkContext = {
    currentPath: ctx.currentPath,
    linkedPaths,
  };
  const blocks: B[] = [];
  for (const block of payload.blocks) {
    const items: I[] = [];
    for (const item of block.items) {
      const alias = guideAliasFromHref(item.href);
      if (alias === null) {
        items.push(item);
        continue;
      }
      const target = resolveGuideLink(alias, snapshot, scoped);
      if (target === null) continue;
      linkedPaths.add(target);
      items.push(
        target === guidePath(alias) ? item : { ...item, href: target },
      );
    }
    if (items.length > 0) blocks.push({ ...block, items });
  }
  return { ...payload, blocks };
}

interface StoredSnapshot {
  publishedGuideAliases: string[];
  conseilsAliases: string[];
}

const SNAPSHOT_RPC = 'get_r6_guide_link_snapshot';

/** Tableau de chaînes non vides sous `key`, sinon null. */
function aliasesAt(data: unknown, key: string): string[] | null {
  if (typeof data !== 'object' || data === null) return null;
  const value = (data as Record<string, unknown>)[key];
  return Array.isArray(value) &&
    value.every((a) => typeof a === 'string' && a !== '')
    ? value
    : null;
}

/**
 * Charge les ensembles de la règle (guides publiés, gammes avec page conseils),
 * en cache Redis court. Un échec de chargement lève une erreur marquée
 * `R6_GUIDE_LINK_SNAPSHOT_FAILED` et n'est jamais mis en cache : la page qui
 * sert le lien échoue comme pour toute autre donnée qu'elle lit.
 */
@Injectable()
export class R6GuideLinkPolicyService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    R6GuideLinkPolicyService.name,
  );

  constructor(
    private readonly featureFlags: FeatureFlagsService,
    private readonly cacheService: CacheService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /** Segment de clé des caches de page dont le contenu dépend du drapeau. */
  cacheKeySegment(): R6GuideLinkCacheSegment {
    return this.featureFlags.seoR6ConsolidationEnabled ? 'r6c1' : 'r6c0';
  }

  async getSnapshot(): Promise<R6GuideLinkSnapshot> {
    const strategy = CACHE_STRATEGIES.BLOG.R6_GUIDE_LINKS;
    const key = getCacheKey(strategy, 'snapshot');
    let stored = await this.cacheService.get<StoredSnapshot>(key);
    if (!stored) {
      stored = await this.loadSnapshot();
      try {
        await this.cacheService.set(key, stored, strategy.ttl);
      } catch (e) {
        this.logger.error(
          `[r6-guide-links] cache SET échoué, snapshot servi non caché: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    return {
      consolidationEnabled: this.featureFlags.seoR6ConsolidationEnabled,
      publishedGuideAliases: new Set(stored.publishedGuideAliases),
      conseilsAliases: new Set(stored.conseilsAliases),
    };
  }

  /**
   * Une seule lecture : la fonction SECURITY DEFINER `get_r6_guide_link_snapshot()`
   * (migration 20261001), et non des `.from()` directs. Le container PREPROD tourne
   * en rôle `anon` (ADR-028 Option D) et la base a `row_security=off` : `anon` ne
   * peut pas lire en direct une table sous RLS, Postgres lève 42501 au lieu de
   * filtrer. La fonction renvoie les deux listes dans un seul scalaire jsonb, donc
   * sans plafond de lignes supabase-js : pas d'ensemble tronqué possible.
   */
  private async loadSnapshot(): Promise<StoredSnapshot> {
    const { data, error } = await this.callRpc<unknown>(
      SNAPSHOT_RPC,
      {},
      { source: 'api', role: 'service_role' },
    );
    if (error) this.fail(error.message);
    const publishedGuideAliases = aliasesAt(data, 'published_guide_aliases');
    const conseilsAliases = aliasesAt(data, 'conseils_aliases');
    if (!publishedGuideAliases || !conseilsAliases) {
      this.fail(
        'réponse invalide (published_guide_aliases et conseils_aliases : tableaux de chaînes attendus)',
      );
    }
    return { publishedGuideAliases, conseilsAliases };
  }

  private fail(reason: string): never {
    this.logger.error(
      `${R6_GUIDE_LINK_SNAPSHOT_FAILED} ${SNAPSHOT_RPC}: ${reason}`,
    );
    throw new Error(
      `${R6_GUIDE_LINK_SNAPSHOT_FAILED}: ${SNAPSHOT_RPC}: ${reason}`,
    );
  }
}
