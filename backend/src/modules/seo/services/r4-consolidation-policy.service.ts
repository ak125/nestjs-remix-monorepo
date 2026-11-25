/**
 * Consolidation R4 → R3 (mandat ER) derrière `SEO_R4_CONSOLIDATION_ENABLED`.
 *
 * Les pages de la liste close `R4_CONSOLIDATION_TARGETS` répondent 301 vers la
 * page conseils de leur gamme. Une seule garde, `computeR4Redirects`, décide
 * lesquelles ; elle sert la route de redirection, le sitemap et la règle des liens
 * (`referenceLinkPath`). Une page de la liste est redirigée seulement si :
 *   - le drapeau est allumé ;
 *   - elle est publiée (`get_all_seo_references` ne rend que les pages publiées) ;
 *   - sa gamme en base est celle de la liste (`pg_id`) ;
 *   - l'alias de sa gamme n'est pas vide ;
 *   - une page conseils est servie pour cet alias : ensemble `conseilsAliases` de
 *     `R6GuideLinkPolicyService`, même gate que la route R3 et la redirection R6
 *     (alias non vide et article `__blog_advice` de la gamme). La page conseils
 *     servie est toujours `index, follow` (route frontend conseils).
 * Sinon la page R4 est servie comme aujourd'hui.
 *
 * Drapeau éteint : aucune lecture, aucun changement.
 * Drapeau allumé et lecture en échec : erreur journalisée
 * (`R4_CONSOLIDATION_SNAPSHOT_FAILED`), jamais mise en cache, et aucune page
 * redirigée — la garde n'est pas vérifiable, la page R4 reste servie.
 *
 * Le contenu stocké n'est jamais réécrit : la règle des liens s'applique à la
 * lecture, comme la règle des guides (ADR-103 D5), par expressions régulières.
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
import {
  R4_CONSOLIDATION_TARGETS,
  type R4ConsolidationTarget,
} from './r4-consolidation.config';
import {
  ANCHOR_RE,
  HREF_ATTR_RE,
  R6GuideLinkPolicyService,
} from './r6-guide-link-policy.service';

export interface R4ConsolidationSnapshot {
  enabled: boolean;
  /** Slug R4 → chemin conseils servi à sa place (pages qui passent la garde). */
  redirects: ReadonlyMap<string, string>;
  /**
   * true : garde non vérifiable (lecture en échec), rien n'est redirigé. Une
   * réponse construite sur ce snapshot n'est ni mise en cache ni figée.
   */
  degraded: boolean;
}

/** Page R4 publiée telle que la garde la lit. */
export interface PublishedReferenceRow {
  slug: string;
  pgId: number | null;
  gammeSlug: string | null;
}

export interface ReferenceLinkHtmlResult {
  html: string;
  /** Nombre de liens modifiés (redirigés ou retirés). */
  changed: number;
}

/** Marqueur d'erreur cherchable dans les logs (garde non vérifiable). */
export const R4_CONSOLIDATION_SNAPSHOT_FAILED =
  'R4_CONSOLIDATION_SNAPSHOT_FAILED';

/**
 * Suffixes des segments de clé des caches de page dont le contenu dépend du
 * drapeau. Drapeau éteint : suffixe vide, les clés existantes sont inchangées.
 */
export const R4_CONSOLIDATION_CACHE_SUFFIXES = ['', '.r4c1'] as const;

/** Snapshot drapeau éteint : rien n'est redirigé, aucun lien ne change. */
export const R4_CONSOLIDATION_OFF: R4ConsolidationSnapshot = Object.freeze({
  enabled: false,
  redirects: new Map<string, string>(),
  degraded: false,
});

const REFERENCE_PREFIX = '/reference-auto/';
const CONSEILS_PREFIX = '/blog-pieces-auto/conseils/';
const REFERENCE_PATH_RE = /^\/reference-auto\/([^/?#\s"']+)\/?(?:[?#].*)?$/;

export const referencePath = (slug: string) => `${REFERENCE_PREFIX}${slug}`;

/** Slug d'un lien vers une page détail R4, sinon null (hub et URL absolues exclus). */
export function referenceSlugFromHref(href: string): string | null {
  const m = REFERENCE_PATH_RE.exec(href);
  return m ? m[1] : null;
}

/**
 * Garde unique : chemins conseils des pages de `targets` qui passent la garde.
 * `rows` : pages R4 publiées ; `conseilsAliases` : gammes servies par une page conseils.
 */
export function computeR4Redirects(
  targets: ReadonlyArray<R4ConsolidationTarget>,
  rows: ReadonlyArray<PublishedReferenceRow>,
  conseilsAliases: ReadonlySet<string>,
): Map<string, string> {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const redirects = new Map<string, string>();
  for (const target of targets) {
    const row = bySlug.get(target.slug);
    if (!row) continue; // non publiée
    if (row.pgId !== target.pgId) continue; // gamme différente de la liste
    const alias = row.gammeSlug ?? '';
    if (alias === '') continue; // gamme sans alias
    if (!conseilsAliases.has(alias)) continue; // page conseils non servie
    redirects.set(target.slug, `${CONSEILS_PREFIX}${alias}`);
  }
  return redirects;
}

/** Cible de la redirection 301 de la page R4 `slug`, ou null (page servie). */
export function r4RedirectTarget(
  slug: string,
  snapshot: R4ConsolidationSnapshot,
): string | null {
  if (!snapshot.enabled) return null;
  return snapshot.redirects.get(slug) ?? null;
}

/**
 * Règle unique de l'URL à lier pour la page R4 `slug`, servie sur `currentPath` :
 * la page R4 si elle n'est pas redirigée, sinon sa page conseils, sinon null quand
 * la page courante est cette page conseils (le lien disparaît, son contenu reste).
 */
export function referenceLinkPath(
  slug: string,
  snapshot: R4ConsolidationSnapshot,
  currentPath: string,
): string | null {
  const target = r4RedirectTarget(slug, snapshot);
  if (target === null) return referencePath(slug);
  return target === currentPath ? null : target;
}

/**
 * Applique la règle aux liens d'un fragment HTML : lien gardé, redirigé (seul
 * le `href` change) ou déplié (le texte reste, la balise `<a>` part).
 */
export function applyReferenceLinkRuleToHtml(
  html: string,
  snapshot: R4ConsolidationSnapshot,
  currentPath: string,
): ReferenceLinkHtmlResult {
  if (
    !snapshot.enabled ||
    snapshot.redirects.size === 0 ||
    !html.includes(REFERENCE_PREFIX)
  ) {
    return { html, changed: 0 };
  }
  let changed = 0;
  const out = html.replace(
    ANCHOR_RE,
    (anchor, attrs: string, inner: string) => {
      const hrefMatch = HREF_ATTR_RE.exec(attrs);
      if (!hrefMatch) return anchor;
      const slug = referenceSlugFromHref(hrefMatch[3]);
      if (slug === null) return anchor;
      const link = referenceLinkPath(slug, snapshot, currentPath);
      if (link === referencePath(slug)) return anchor;
      changed++;
      if (link === null) return inner;
      const [whole, lead, quote] = hrefMatch;
      const at = hrefMatch.index;
      const newAttrs =
        attrs.slice(0, at) +
        `${lead}${quote}${link}${quote}` +
        attrs.slice(at + whole.length);
      // `<a` (2 caractères) + attributs + reste de la balise
      return anchor.slice(0, 2) + newAttrs + anchor.slice(2 + attrs.length);
    },
  );
  return { html: changed === 0 ? html : out, changed };
}

/**
 * Lignes du sitemap des pages R4 sans les pages redirigées (même garde que la
 * route de redirection). Drapeau éteint : `rows` rendu tel quel.
 */
export function withoutR4Redirected<T extends { slug: string }>(
  rows: ReadonlyArray<T>,
  snapshot: R4ConsolidationSnapshot,
): { kept: T[]; excluded: number } {
  if (!snapshot.enabled) return { kept: [...rows], excluded: 0 };
  const kept = rows.filter((r) => r4RedirectTarget(r.slug, snapshot) === null);
  return { kept, excluded: rows.length - kept.length };
}

const PUBLISHED_RPC = 'get_all_seo_references';

/** Ligne de `get_all_seo_references` réduite aux champs de la garde, sinon null. */
function toPublishedRow(row: unknown): PublishedReferenceRow | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.slug !== 'string' || r.slug === '') return null;
  return {
    slug: r.slug,
    pgId: typeof r.pg_id === 'number' ? r.pg_id : null,
    gammeSlug: typeof r.gamme_slug === 'string' ? r.gamme_slug : null,
  };
}

@Injectable()
export class R4ConsolidationPolicyService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    R4ConsolidationPolicyService.name,
  );

  constructor(
    private readonly featureFlags: FeatureFlagsService,
    private readonly cacheService: CacheService,
    private readonly guideLinkPolicy: R6GuideLinkPolicyService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * Segment de clé d'un cache de page dont le contenu dépend du drapeau :
   * `base` inchangé drapeau éteint, suffixé drapeau allumé.
   */
  cacheKeySegment(base: string): string {
    return this.featureFlags.seoR4ConsolidationEnabled
      ? `${base}${R4_CONSOLIDATION_CACHE_SUFFIXES[1]}`
      : base;
  }

  /**
   * Snapshot de la garde. Ne lève jamais : un échec ne redirige rien et rend
   * un snapshot `degraded`.
   */
  async getSnapshot(): Promise<R4ConsolidationSnapshot> {
    if (!this.featureFlags.seoR4ConsolidationEnabled) {
      return R4_CONSOLIDATION_OFF;
    }
    try {
      const [rows, guideLinks] = await Promise.all([
        this.getPublishedTargets(),
        this.guideLinkPolicy.getSnapshot(),
      ]);
      return {
        enabled: true,
        redirects: computeR4Redirects(
          R4_CONSOLIDATION_TARGETS,
          rows,
          guideLinks.conseilsAliases,
        ),
        degraded: false,
      };
    } catch (e) {
      this.logger.error(
        `${R4_CONSOLIDATION_SNAPSHOT_FAILED} ${e instanceof Error ? e.message : String(e)} — aucune page R4 redirigée`,
      );
      return { enabled: true, redirects: new Map(), degraded: true };
    }
  }

  /** Pages publiées de la liste, en cache Redis court. */
  private async getPublishedTargets(): Promise<PublishedReferenceRow[]> {
    const strategy = CACHE_STRATEGIES.BLOG.R4_CONSOLIDATION;
    const key = getCacheKey(strategy, 'published-targets');
    const cached = await this.cacheService.get<PublishedReferenceRow[]>(key);
    if (cached) return cached;

    const { data, error } = await this.callRpc<unknown>(
      PUBLISHED_RPC,
      {},
      { source: 'api' },
    );
    if (error) throw new Error(`${PUBLISHED_RPC}: ${error.message}`);
    if (!Array.isArray(data)) {
      throw new Error(`${PUBLISHED_RPC}: réponse invalide (tableau attendu)`);
    }
    const listed = new Set(R4_CONSOLIDATION_TARGETS.map((t) => t.slug));
    const rows: PublishedReferenceRow[] = [];
    for (const raw of data) {
      const row = toPublishedRow(raw);
      if (row === null) {
        throw new Error(`${PUBLISHED_RPC}: ligne invalide (slug attendu)`);
      }
      if (listed.has(row.slug)) rows.push(row);
    }
    try {
      await this.cacheService.set(key, rows, strategy.ttl);
    } catch (e) {
      this.logger.error(
        `[r4-consolidation] cache SET échoué, pages servies non cachées: ${e instanceof Error ? e.message : e}`,
      );
    }
    return rows;
  }
}
