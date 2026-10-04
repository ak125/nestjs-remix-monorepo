import { GammeResponseBuilderService } from '../gamme-response-builder.service';

/**
 * Bloc « guide d'achat » de la R1 (`guideAchat`, rendu par GuideSection).
 *
 * La route /blog-pieces-auto/conseils/:pg_alias est indexée sur le pg_alias de
 * la gamme ; le ba_alias du conseil est le slug de l'article. Un lien construit
 * sur le ba_alias (ex. /conseils/comment-changer-un-demarreur) répond 404.
 *
 * Helper privé testé par cast `as never` (modificateurs TS non runtime), comme
 * gamme-response-builder-seo-shadow.test.ts.
 */
describe('GammeResponseBuilderService — guideAchat', () => {
  type BuildGuideAchat = (
    blogData: { [k: string]: string | null | undefined } | undefined,
    pgAlias: string,
  ) => { link: string; alias: string | null | undefined } | null;

  function buildGuideAchat(): BuildGuideAchat {
    const transformer = { contentCleaner: (s: string) => s };
    const dummy = {} as never;
    const service = new GammeResponseBuilderService(
      transformer as never, // GammeDataTransformerService
      dummy, // GammeRpcService
      dummy, // BuyingGuideDataService
      dummy, // ReferenceService
      dummy, // SeoTitleEngineService
      dummy, // R1RelatedResourcesService
      dummy, // SeoChainOrchestratorService
      dummy, // SeoFeatureFlagRegistry
      dummy, // R6GuideLinkPolicyService
    );
    const helper = (service as never as { buildGuideAchat: BuildGuideAchat })
      .buildGuideAchat;
    return helper.bind(service);
  }

  it('lie la page conseils de la gamme (pg_alias), pas le slug du conseil', () => {
    const guide = buildGuideAchat()(
      {
        ba_id: '42',
        ba_alias: 'comment-changer-un-demarreur',
        ba_h1: 'Comment changer un démarreur',
        ba_preview: '',
        ba_wall: null,
        ba_update: '2026-01-01',
      },
      'demarreur',
    );

    expect(guide?.link).toBe('/blog-pieces-auto/conseils/demarreur');
    // Le ba_alias reste exposé tel quel (champ `alias`) : seul le lien change.
    expect(guide?.alias).toBe('comment-changer-un-demarreur');
  });

  it('aucun conseil pour la gamme → pas de bloc', () => {
    expect(buildGuideAchat()(undefined, 'demarreur')).toBeNull();
  });
});
