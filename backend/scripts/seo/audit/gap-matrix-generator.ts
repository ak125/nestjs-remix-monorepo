import type { GapMatrixRow } from './types';

export const BASELINE_MATRIX_ROWS: GapMatrixRow[] = [
  {
    php_file: 'index.php',
    monorepo_equivalent: 'CatalogModule.getHomeCatalog',
    status: '✅',
    gap: 'Vérifier rendu Remix final R0',
    priority: 'P1',
    proof_link: 'backend/src/modules/catalog/',
  },
  {
    php_file: 'products.gamme.php / v7.products.gamme.php',
    monorepo_equivalent: 'GammeResponseBuilderService + __seo_gamme + SeoTitleEngineService',
    status: '✅',
    gap: 'Robots simplifié pg_level=1=>index sinon noindex vs logique complète legacy',
    priority: 'P1',
    proof_link: 'backend/src/modules/gamme-rest/services/gamme-response-builder.service.ts',
  },
  {
    php_file: 'products.car.gamme.php',
    monorepo_equivalent: 'RPC get_pieces_for_type_gamme_v4 + raw SEO templates + NestJS processing',
    status: '✅',
    gap: 'Comparaison sortie PHP vs Remix non finalisée',
    priority: 'P1',
    proof_link: 'rpc:get_pieces_for_type_gamme_v4',
  },
  {
    php_file: '__SEO_ITEM_SWITCH + __SEO_GAMME_CAR_SWITCH + __SEO_FAMILY_GAMME_CAR_SWITCH',
    monorepo_equivalent: 'SeoSwitchesService (migration "TERMINÉE")',
    status: '✅',
    gap: '#PrixPasCher#, #VousPropose#, #MinPrice# encore TODO',
    priority: 'P1',
    proof_link: 'backend/src/modules/seo/services/seo-switches.service.ts',
  },
  {
    php_file: 'constructeurs.type.php',
    monorepo_equivalent: 'RPC build_vehicle_page_payload',
    status: '✅',
    gap: 'Vérifier rendu Remix + indexabilité réelle',
    priority: 'P1',
    proof_link: 'rpc:build_vehicle_page_payload',
  },
  {
    php_file: 'products.car.gamme.fiche.php / v7.products.fiche.php',
    monorepo_equivalent: 'Listing RPC get_listing_products_for_build (prix/stock/score/images)',
    status: '⚠️',
    gap: 'Fiche produit détaillée OEM/critères/composition pas prouvée',
    priority: 'P1',
    proof_link: 'rpc:get_listing_products_for_build',
  },
  {
    php_file: '410.page.php / 412.page.php',
    monorepo_equivalent: 'CatalogDataIntegrityService 200/404/410 + système 3 couches erreurs 4xx existant (à auditer)',
    status: '⚠️',
    gap: 'Page indisponible contextualisée 412/410 à formaliser ; SeoUnavailablePolicy doit RACCORDER, pas créer un middleware',
    priority: 'P1',
    proof_link: 'backend/src/modules/catalog/services/catalog-data-integrity.service.ts',
  },
  {
    php_file: 'blog.advice.gamme.php / v7.blog.advice.gamme.php',
    monorepo_equivalent: 'Tables SEO/blog connues, agents/plans',
    status: '⚠️',
    gap: 'R3 doit venir du wiki canonique (ADR-031), pas clone PHP direct',
    priority: 'P2',
    proof_link: 'automecanik-wiki/exports/',
  },
  {
    php_file: 'constructeurs.marque.php',
    monorepo_equivalent: 'Données marque DB + payload véhicule + domain map',
    status: '⚠️',
    gap: 'Hub marque R7 complet à vérifier côté Remix/API',
    priority: 'P1',
    proof_link: 'backend/src/modules/vehicles/services/brand-rpc.service.ts',
  },
  {
    php_file: 'meta.conf.php',
    monorepo_equivalent: 'SeoTitleEngineService + URL builders + canonical partiel',
    status: '⚠️',
    gap: 'Slug/canonical/robots à centraliser par rôle (SeoCanonicalService + SeoIndexabilityPolicyService)',
    priority: 'P1',
    proof_link: 'backend/src/modules/seo/services/seo-title-engine.service.ts',
  },
];

export interface RenderOptions {
  generated_at: string;
}

export function renderGapMatrixMarkdown(rows: GapMatrixRow[], opts: RenderOptions): string {
  const header = '| php_file | monorepo_equivalent | status | gap | priority | proof_link |';
  const separator = '|---|---|---|---|---|---|';
  const lines = rows.map(
    (r) => `| ${r.php_file} | ${r.monorepo_equivalent} | ${r.status} | ${r.gap} | ${r.priority} | ${r.proof_link} |`,
  );
  return `# Legacy PHP → Monorepo Gap Matrix (SEO seo-v9 PR-1)

> Generated: ${opts.generated_at}
> Plan référence : \`/home/deploy/.claude/plans/apres-investigation-seo-on-iterative-spark.md\`
> Statut : LIVRABLE CANON PR-1. Mis à jour à chaque PR de la cascade seo-v9.

## Matrice

${header}
${separator}
${lines.join('\n')}

## Légende

- ✅ Porté : équivalent monorepo identifié, gap = finition.
- ⚠️ Partiel : présence partielle, gap = compléter ou centraliser.
- ❌ Absent : équivalent monorepo manquant.
- **P0** : ne pas refaire (consolider l'existant).
- **P1** : compléter en PR-2 ou cascade.
- **P2** : différé (wiki éditorial, blog, R4).
`;
}
