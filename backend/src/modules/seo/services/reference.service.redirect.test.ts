/**
 * ReferenceService.getRedirectTarget — consolidation R4→R3 (flag-gated).
 *
 * Invariants couverts :
 *   - flag OFF (défaut) ⇒ null, AUCUNE requête DB (chemin inerte)
 *   - référence sans pg_id ⇒ null
 *   - gamme liée sans article R3 ⇒ null (self-gate — jamais de redirect-vers-404)
 *   - chaîne complète ⇒ cible /blog-pieces-auto/conseils/{pg_alias}
 *
 * Pas d'I/O réseau ; instanciation directe + mock du client supabase hérité
 * (pattern rm-soft404-tracker / r6-guide.service.redirect).
 */

import { ReferenceService } from './reference.service';

type Row = Record<string, unknown> | null;

function makeService(
  flagOn: boolean,
  rows: { ref: Row; advice: Row; gamme: Row },
): { service: ReferenceService; tablesQueried: string[] } {
  const tablesQueried: string[] = [];
  const client = {
    from(table: string) {
      tablesQueried.push(table);
      const data =
        table === '__seo_reference'
          ? rows.ref
          : table === '__blog_advice'
            ? rows.advice
            : rows.gamme;
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
  const service = new ReferenceService(
    { evaluate: () => ({ allowed: true }) } as never,
    undefined,
    { seoR4ConsolidationEnabled: flagOn } as never,
  );
  Object.defineProperty(service, 'supabase', { value: client });
  return { service, tablesQueried };
}

describe('ReferenceService.getRedirectTarget — consolidation R4→R3', () => {
  it('flag OFF (défaut) → null sans aucune requête DB', async () => {
    const { service, tablesQueried } = makeService(false, {
      ref: { pg_id: 8 },
      advice: { ba_pg_id: '8' },
      gamme: { pg_alias: 'filtre-a-air' },
    });
    await expect(service.getRedirectTarget('filtre-a-air')).resolves.toBeNull();
    expect(tablesQueried).toHaveLength(0);
  });

  it('référence sans pg_id → null', async () => {
    const { service } = makeService(true, {
      ref: { pg_id: null },
      advice: null,
      gamme: null,
    });
    await expect(service.getRedirectTarget('notion-isolee')).resolves.toBeNull();
  });

  it('gamme sans article R3 → null (self-gate, pas de redirect-vers-404)', async () => {
    const { service, tablesQueried } = makeService(true, {
      ref: { pg_id: 8 },
      advice: null,
      gamme: { pg_alias: 'filtre-a-air' },
    });
    await expect(service.getRedirectTarget('filtre-a-air')).resolves.toBeNull();
    expect(tablesQueried).toEqual(['__seo_reference', '__blog_advice']);
  });

  it('chaîne complète → cible /blog-pieces-auto/conseils/{alias}', async () => {
    const { service } = makeService(true, {
      ref: { pg_id: 8 },
      advice: { ba_pg_id: '8' },
      gamme: { pg_alias: 'filtre-a-air' },
    });
    await expect(service.getRedirectTarget('filtre-a-air')).resolves.toEqual({
      redirect_to: '/blog-pieces-auto/conseils/filtre-a-air',
      pg_alias: 'filtre-a-air',
    });
  });
});
