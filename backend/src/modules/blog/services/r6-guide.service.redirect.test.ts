/**
 * R6GuideService.getRedirectTarget — consolidation R6→R3 (flag-gated).
 *
 * Invariants couverts :
 *   - flag OFF (défaut) ⇒ null, AUCUNE requête DB (chemin inerte)
 *   - flag ON + gamme inconnue ⇒ null
 *   - flag ON + gamme sans article R3 ⇒ null (self-gate — jamais de redirect-vers-404)
 *   - flag ON + article R3 vivant ⇒ cible /blog-pieces-auto/conseils/{alias}
 *
 * Pas d'I/O réseau ; mocks minimaux (mirror du style r3-guide.service.test.ts).
 */

import { R6GuideService } from './r6-guide.service';

type Row = Record<string, unknown> | null;

function makeService(
  flagOn: boolean,
  rows: { gamme: Row; advice: Row },
): { service: R6GuideService; tablesQueried: string[] } {
  const tablesQueried: string[] = [];
  const client = {
    from(table: string) {
      tablesQueried.push(table);
      const data = table === 'pieces_gamme' ? rows.gamme : rows.advice;
      const builder = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        single: async () => ({
          data,
          error: data ? null : { code: 'PGRST116' },
        }),
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
