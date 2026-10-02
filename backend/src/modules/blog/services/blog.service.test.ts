/**
 * BlogService.getArticleBySlug — liens vers les guides d'achat (ADR-103 D5).
 *
 * L'article servi par `GET /api/blog/article/:slug` passe par la règle unique
 * (contenu puis sections, dans l'ordre de rendu) ; un guide est servi tel quel.
 * Pas d'I/O : les services délégués sont des mocks.
 */

import { BlogService } from './blog.service';
import type { BlogCacheService } from './blog-cache.service';
import type { BlogArticleTransformService } from './blog-article-transform.service';
import type { BlogArticleDataService } from './blog-article-data.service';
import type { BlogStatisticsService } from './blog-statistics.service';
import type { BlogSeoService } from './blog-seo.service';
import type { BlogArticleRelationService } from './blog-article-relation.service';
import type {
  R6GuideLinkPolicyService,
  R6GuideLinkSnapshot,
} from '../../seo/services/r6-guide-link-policy.service';
import type { BlogArticle } from '../interfaces/blog.interfaces';

const SLUG = 'bien-choisir-ses-pieces';
const guide = (alias: string) => `/blog-pieces-auto/guide-achat/${alias}`;
const conseils = (alias: string) => `/blog-pieces-auto/conseils/${alias}`;

function snapshot(
  consolidationEnabled: boolean,
  published: string[] = ['disque-de-frein'],
  conseilsAliases: string[] = ['disque-de-frein', 'plaquette-de-frein'],
): R6GuideLinkSnapshot {
  return {
    consolidationEnabled,
    publishedGuideAliases: new Set(published),
    conseilsAliases: new Set(conseilsAliases),
  };
}

function article(overrides: Partial<BlogArticle> = {}): BlogArticle {
  return {
    id: 'advice_1',
    type: 'advice',
    title: 'Bien choisir ses pièces',
    slug: SLUG,
    excerpt: '',
    content: `<p>Voir <a href="${guide('disque-de-frein')}">le guide disque</a> et <a href="${guide('plaquette-de-frein')}">le guide plaquette</a>.</p>`,
    keywords: [],
    tags: [],
    publishedAt: '2025-01-01T00:00:00.000Z',
    viewsCount: 0,
    sections: [
      {
        level: 2,
        title: 'Freinage',
        anchor: 'freinage',
        content: `<p>Rappel : <a href="${guide('disque-de-frein')}">guide disque</a>.</p>`,
      },
      {
        level: 2,
        title: 'Sans lien',
        anchor: 'sans-lien',
        content: '<p>Texte.</p>',
      },
    ],
    legacy_id: 1,
    legacy_table: '__blog_advice',
    ...overrides,
  };
}

function buildService(found: BlogArticle | null, snap: R6GuideLinkSnapshot) {
  const dataService = {
    getArticleBySlug: jest.fn().mockResolvedValue(found),
  };
  const guideLinkPolicy = {
    getSnapshot: jest.fn().mockResolvedValue(snap),
  };
  const service = new BlogService(
    {} as BlogCacheService,
    {} as BlogArticleTransformService,
    dataService as unknown as BlogArticleDataService,
    {} as BlogStatisticsService,
    {} as BlogSeoService,
    {} as BlogArticleRelationService,
    guideLinkPolicy as unknown as R6GuideLinkPolicyService,
  );
  return { service, guideLinkPolicy };
}

describe('BlogService.getArticleBySlug — liens vers les guides (ADR-103 D5)', () => {
  it('drapeau éteint : garde le lien vers un guide publié, déplie le lien vers un guide non publié', async () => {
    const { service } = buildService(article(), snapshot(false));

    const served = await service.getArticleBySlug(SLUG);

    expect(served?.content).toBe(
      `<p>Voir <a href="${guide('disque-de-frein')}">le guide disque</a> et le guide plaquette.</p>`,
    );
    // Drapeau éteint : pas de retrait de doublon, la section garde son lien.
    expect(served?.sections[0].content).toBe(article().sections[0].content);
  });

  it('drapeau allumé : redirige vers les conseils, un doublon entre contenu et section disparaît', async () => {
    const found = article();
    const { service } = buildService(found, snapshot(true));

    const served = await service.getArticleBySlug(SLUG);

    expect(served?.content).toBe(
      `<p>Voir <a href="${conseils('disque-de-frein')}">le guide disque</a> et <a href="${conseils('plaquette-de-frein')}">le guide plaquette</a>.</p>`,
    );
    expect(served?.sections[0].content).toBe('<p>Rappel : guide disque.</p>');
    expect(served?.sections[1]).toBe(found.sections[1]);
  });

  it("ne modifie pas l'article reçu du service de données", async () => {
    const found = article();
    const before = JSON.stringify(found);
    const { service } = buildService(found, snapshot(true));

    const served = await service.getArticleBySlug(SLUG);

    expect(JSON.stringify(found)).toBe(before);
    expect(served).not.toBe(found);
  });

  it('sans lien modifié : renvoie le même article', async () => {
    const found = article({
      content: '<p>Aucun lien guide.</p>',
      sections: [],
    });
    const { service } = buildService(found, snapshot(true));

    await expect(service.getArticleBySlug(SLUG)).resolves.toBe(found);
  });

  it('un guide est servi tel quel, sans charger la règle', async () => {
    const found = article({ type: 'guide', legacy_table: '__blog_guide' });
    const { service, guideLinkPolicy } = buildService(found, snapshot(true));

    await expect(service.getArticleBySlug(SLUG)).resolves.toBe(found);
    expect(guideLinkPolicy.getSnapshot).not.toHaveBeenCalled();
  });

  it('article absent : null, sans charger la règle', async () => {
    const { service, guideLinkPolicy } = buildService(null, snapshot(true));

    await expect(service.getArticleBySlug(SLUG)).resolves.toBeNull();
    expect(guideLinkPolicy.getSnapshot).not.toHaveBeenCalled();
  });

  it('un échec de chargement de la règle remonte (pas de repli silencieux)', async () => {
    const { service, guideLinkPolicy } = buildService(
      article(),
      snapshot(true),
    );
    guideLinkPolicy.getSnapshot.mockRejectedValue(
      new Error('R6_GUIDE_LINK_SNAPSHOT_FAILED: test'),
    );

    await expect(service.getArticleBySlug(SLUG)).rejects.toThrow(
      'R6_GUIDE_LINK_SNAPSHOT_FAILED',
    );
  });
});
