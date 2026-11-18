import { InternalLinkingService } from '../../../seo';
import { GammeResponseBuilderService } from '../gamme-response-builder.service';

/**
 * Garde du rendu R1 : le texte `sg_content` ne sert aucun lien
 * `/pieces/{alias}` sans identifiant (ces adresses répondent 410).
 *
 * `resolveR1GammeLinks` est l'étape de `buildRpcV2Response` qui traite ces
 * liens, testée par cast `as never` comme les autres helpers privés, avec le
 * vrai InternalLinkingService et un client Supabase factice.
 */
const NO_ID_LINK_RE = /href="\/pieces\/(?![^"]*-\d+\.html")[^"/]*"/;

/** Extrait de sg_content de filtre-a-huile (pg 7), liens tels qu'en base. */
const SG_CONTENT_PG7 = [
  '<p>Pensez au <a href="/pieces/bouchon-de-vidange">bouchon de vidange</a>,',
  'au <a href="/pieces/filtre-a-air">filtre à air</a>,',
  'au <a href="/pieces/filtre-a-carburant">filtre à carburant</a>',
  'et au <a href="/pieces/filtre-de-boite-auto">filtre de boîte auto</a>.</p>',
  '<p>Voir aussi la <a href="/pieces/vidange">vidange</a>',
  'et le <a href="/pieces/filtre-a-air-8.html">filtre à air</a>.</p>',
].join('\n');

const ROWS = [
  [8, 'filtre-a-air', '1', '1', '1'],
  [9, 'filtre-a-carburant', '1', '1', '1'],
  [593, 'bouchon-de-vidange', '1', '1', '1'],
  [416, 'filtre-de-boite-auto', '1', '0', '1'],
].map(([pg_id, pg_alias, pg_display, pg_relfollow, pg_level]) => ({
  pg_id,
  pg_alias,
  pg_name: pg_alias,
  pg_display,
  pg_relfollow,
  pg_level,
}));

function fakeSupabase(fail: boolean) {
  return {
    from() {
      const filters: Array<[string, unknown[]]> = [];
      const builder = {
        select: () => builder,
        in: (c: string, vs: unknown[]) => (filters.push([c, vs]), builder),
        eq: (c: string, v: unknown) => (filters.push([c, [v]]), builder),
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve(
            fail
              ? { data: null, error: { message: 'timeout' } }
              : {
                  data: ROWS.filter((row) =>
                    filters.every(([c, vs]) =>
                      vs
                        .map(String)
                        .includes(String((row as Record<string, unknown>)[c])),
                    ),
                  ),
                  error: null,
                },
          ).then(resolve),
      };
      return builder;
    },
  };
}

type ResolveR1GammeLinks = (
  html: string,
  pgId: number,
) => Promise<{ html: string; degraded: boolean }>;

function resolveR1GammeLinks(fail = false): ResolveR1GammeLinks {
  const linking = new InternalLinkingService();
  (linking as unknown as { supabase: unknown }).supabase = fakeSupabase(fail);
  const dummy = {} as never;
  const service = new GammeResponseBuilderService(
    dummy, // GammeDataTransformerService
    dummy, // GammeRpcService
    dummy, // BuyingGuideDataService
    dummy, // ReferenceService
    dummy, // SeoTitleEngineService
    dummy, // R1RelatedResourcesService
    dummy, // SeoChainOrchestratorService
    dummy, // SeoFeatureFlagRegistry
    dummy, // R6GuideLinkPolicyService
    linking,
  );
  const helper = (
    service as never as { resolveR1GammeLinks: ResolveR1GammeLinks }
  ).resolveR1GammeLinks;
  return helper.bind(service);
}

describe('GammeResponseBuilderService — liens de gamme du texte R1', () => {
  it('aucun lien /pieces/{alias} sans identifiant ; cibles indexables réécrites', async () => {
    const out = await resolveR1GammeLinks()(SG_CONTENT_PG7, 7);
    expect(out.degraded).toBe(false);
    expect(out.html).not.toMatch(NO_ID_LINK_RE);
    expect(out.html.match(/href="\/pieces\/[^"]+"/g)).toEqual([
      'href="/pieces/bouchon-de-vidange-593.html"',
      'href="/pieces/filtre-a-air-8.html"',
      'href="/pieces/filtre-a-carburant-9.html"',
      'href="/pieces/filtre-a-air-8.html"',
    ]);
    // Libellés gardés pour la cible non indexable et la cible inconnue.
    expect(out.html).toContain('>filtre de boîte auto</span>');
    expect(out.html).toContain('>vidange</span>');
  });

  it('panne de la résolution : page servie, aucun lien sans identifiant, réponse dégradée', async () => {
    const out = await resolveR1GammeLinks(true)(SG_CONTENT_PG7, 7);
    expect(out.degraded).toBe(true);
    expect(out.html).not.toMatch(NO_ID_LINK_RE);
    // Le lien canonique, qui ne répond pas 410, est gardé tel qu'écrit.
    expect(out.html.match(/href="\/pieces\/[^"]+"/g)).toEqual([
      'href="/pieces/filtre-a-air-8.html"',
    ]);
    expect(out.html).toContain('>bouchon de vidange</span>');
  });
});
