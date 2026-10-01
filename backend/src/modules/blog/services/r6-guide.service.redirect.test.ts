/**
 * R6GuideService.getRedirectTarget / getIndexingPosture — consolidation R6→R3 (flag-gated).
 *
 * Invariants couverts :
 *   - flag OFF (défaut) ⇒ null, AUCUNE requête DB (chemin inerte)
 *   - flag ON + gamme inconnue ⇒ null
 *   - flag ON + gamme sans article R3 ⇒ null (self-gate — jamais de redirect-vers-404)
 *   - flag ON + article R3 vivant ⇒ cible /blog-pieces-auto/conseils/{alias}
 *   - posture : OFF ⇒ rien ; ON ⇒ jamais indexable (301 R3 ou `noindex, follow`)
 *   - erreur DB autre que « aucune ligne » ⇒ journalisée (jamais silencieuse)
 *
 * Pas d'I/O réseau ; mocks minimaux (mirror du style r3-guide.service.test.ts).
 */

import { Logger } from '@nestjs/common';
import { R6GuideService, R6_RETIRED_ROBOTS } from './r6-guide.service';

type Row = Record<string, unknown> | null;
type DbError = { code: string; message: string };

function makeService(
  flagOn: boolean,
  rows: { gamme: Row; advice: Row; gammeError?: DbError },
): { service: R6GuideService; tablesQueried: string[] } {
  const tablesQueried: string[] = [];
  const client = {
    from(table: string) {
      tablesQueried.push(table);
      const data = table === 'pieces_gamme' ? rows.gamme : rows.advice;
      const error =
        table === 'pieces_gamme' && rows.gammeError
          ? rows.gammeError
          : data
            ? null
            : { code: 'PGRST116', message: 'no rows' };
      const builder = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        single: async () => ({ data, error }),
      };
      return builder;
    },
  };
  const service = new R6GuideService(
    { client } as never,
    {} as never,
    {} as never,
    { seoR6ConsolidationEnabled: flagOn } as never,
  );
  return { service, tablesQueried };
}

describe('R6GuideService.getRedirectTarget — consolidation R6→R3', () => {
  it('flag OFF (défaut) → null sans aucune requête DB', async () => {
    const { service, tablesQueried } = makeService(false, {
      gamme: { pg_id: 8 },
      advice: { ba_pg_id: 8 },
    });
    await expect(service.getRedirectTarget('filtre-a-air')).resolves.toBeNull();
    expect(tablesQueried).toHaveLength(0);
  });

  it('flag ON + gamme inconnue → null', async () => {
    const { service } = makeService(true, { gamme: null, advice: null });
    await expect(service.getRedirectTarget('inconnue')).resolves.toBeNull();
  });

  it('flag ON + gamme sans article R3 → null (self-gate, pas de redirect-vers-404)', async () => {
    const { service, tablesQueried } = makeService(true, {
      gamme: { pg_id: 8 },
      advice: null,
    });
    await expect(service.getRedirectTarget('filtre-a-air')).resolves.toBeNull();
    expect(tablesQueried).toEqual(['pieces_gamme', '__blog_advice']);
  });

  it('flag ON + article R3 vivant → cible /blog-pieces-auto/conseils/{alias}', async () => {
    const { service } = makeService(true, {
      gamme: { pg_id: 8 },
      advice: { ba_pg_id: 8 },
    });
    await expect(service.getRedirectTarget('filtre-a-air')).resolves.toEqual({
      redirect_to: '/blog-pieces-auto/conseils/filtre-a-air',
      pg_alias: 'filtre-a-air',
    });
  });
});

describe('R6GuideService.getIndexingPosture — surface R6 hors index sous flag', () => {
  it('flag OFF (défaut) → aucune directive, aucune requête DB', async () => {
    const { service, tablesQueried } = makeService(false, {
      gamme: { pg_id: 8 },
      advice: { ba_pg_id: 8 },
    });
    await expect(service.getIndexingPosture('filtre-a-air')).resolves.toEqual({
      redirect_to: null,
      robots: null,
    });
    expect(tablesQueried).toHaveLength(0);
  });

  it('flag ON + article R3 vivant → 301 vers R3, pas de directive robots', async () => {
    const { service } = makeService(true, {
      gamme: { pg_id: 8 },
      advice: { ba_pg_id: 8 },
    });
    await expect(service.getIndexingPosture('filtre-a-air')).resolves.toEqual({
      redirect_to: '/blog-pieces-auto/conseils/filtre-a-air',
      robots: null,
    });
  });

  it('flag ON + gamme sans R3 → page servie mais noindex, follow', async () => {
    const { service } = makeService(true, {
      gamme: { pg_id: 8 },
      advice: null,
    });
    await expect(service.getIndexingPosture('filtre-a-air')).resolves.toEqual({
      redirect_to: null,
      robots: R6_RETIRED_ROBOTS,
    });
  });

  it('flag ON + guide legacy sans gamme → noindex, follow', async () => {
    const { service } = makeService(true, { gamme: null, advice: null });
    await expect(
      service.getIndexingPosture('pieces-auto-comment-s-y-retrouver'),
    ).resolves.toEqual({ redirect_to: null, robots: R6_RETIRED_ROBOTS });
  });

  it('flag ON + erreur DB → noindex (jamais index) ET erreur journalisée', async () => {
    const { service } = makeService(true, {
      gamme: null,
      advice: null,
      gammeError: { code: '57014', message: 'statement timeout' },
    });
    const warn = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'warn')
      .mockImplementation(() => undefined);
    await expect(service.getIndexingPosture('filtre-a-air')).resolves.toEqual({
      redirect_to: null,
      robots: R6_RETIRED_ROBOTS,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('R6_CONSOLIDATION_LOOKUP_FAILED'),
    );
  });

  it('« aucune ligne » (PGRST116) est une réponse normale → aucun avertissement', async () => {
    const { service } = makeService(true, { gamme: null, advice: null });
    const warn = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'warn')
      .mockImplementation(() => undefined);
    await service.getIndexingPosture('inconnue');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('R6GuideService.getHubIndexingPosture — hub guide-achat', () => {
  it('flag OFF → aucune directive', () => {
    const { service } = makeService(false, { gamme: null, advice: null });
    expect(service.getHubIndexingPosture()).toEqual({ robots: null });
  });

  it('flag ON → noindex, follow', () => {
    const { service } = makeService(true, { gamme: null, advice: null });
    expect(service.getHubIndexingPosture()).toEqual({
      robots: R6_RETIRED_ROBOTS,
    });
  });
});
