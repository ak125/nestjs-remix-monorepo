import type { GapMatrixRow } from './types';

/**
 * Baseline figée à PR-1 (10 mappings legacy PHP → monorepo issus de l'itération 8 du plan stratégique).
 *
 * **ANTI-COMMENT-ROT** : chaque champ `gap` reflète l'état du codebase au moment du baseline.
 * Quand une PR ferme un gap (ex: PR-2c branche `SeoSwitchSelector` sur `__seo_item_switch`),
 * **mettre à jour la ligne correspondante dans la même PR** — sinon le markdown généré ment.
 *
 * Format ligne : { php_file, monorepo_equivalent, status, gap, priority, proof_link }
 * - status : ✅ porté / ⚠️ partiel / ❌ absent
 * - priority : P0 (consolider) / P1 (compléter PR-2) / P2 (différé wiki/blog/R4)
 * - proof_link : chemin file:line ou rpc:name
 */
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
  findings?: AuditFindings;
}

export interface AuditFindings {
  source: 'DEV' | 'preprod' | 'unknown';
  services_total: number;
  services_mapped_to_targets: number;
  target_services_count: number;
  diff_samples_count: number;
  diff_verdicts: Record<string, number>;
  r2_routes_found: boolean;
  pieces_total: number;
  pieces_seo_safe: number;
  pieces_in_sitemap: number;
}

export function renderGapMatrixMarkdown(rows: GapMatrixRow[], opts: RenderOptions): string {
  const header = '| php_file | monorepo_equivalent | status | gap | priority | proof_link |';
  const separator = '|---|---|---|---|---|---|';
  const lines = rows.map(
    (r) => `| ${r.php_file} | ${r.monorepo_equivalent} | ${r.status} | ${r.gap} | ${r.priority} | ${r.proof_link} |`,
  );

  const findingsSection = opts.findings ? renderFindingsSection(opts.findings) : '';

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
${findingsSection}`;
}

function renderFindingsSection(f: AuditFindings): string {
  const coverageRatio = f.target_services_count > 0
    ? Math.round((f.services_mapped_to_targets / f.target_services_count) * 100)
    : 0;
  const scenario = decidePr2Scenario(coverageRatio);
  const sitemapRatio = f.pieces_seo_safe > 0
    ? ((f.pieces_in_sitemap / f.pieces_seo_safe) * 100).toFixed(2)
    : '0';
  const r2Multiplier = f.pieces_in_sitemap > 0
    ? Math.round(f.pieces_seo_safe / f.pieces_in_sitemap)
    : 0;

  const diffLines = Object.entries(f.diff_verdicts)
    .map(([verdict, count]) => `  - \`${verdict}\` : ${count}/${f.diff_samples_count}`)
    .join('\n');

  return `

## Findings empiriques (run ${f.source})

### Couverture services

- **Services SEO existants** : ${f.services_total}
- **Mappés à une cible v9 par filename** : ${f.services_mapped_to_targets}/${f.target_services_count} (${coverageRatio}% brut)
- Couverture fonctionnelle réelle probablement plus élevée (services existants couvrent partiellement plusieurs cibles — à inventorier précisément en PR-2a registry)

### Diff sortie SEO V4 vs actuel

- Sample : ${f.diff_samples_count} URLs
${diffLines}

### Audit R2 fiche produit

- **Route Remix R2 dédiée** : ${f.r2_routes_found ? 'TROUVÉE' : '**ABSENTE**'} (équivalent \`v7.products.fiche.php\` non porté)
- Conséquence : R2 traité comme R1 listing actuellement. Pas de fiche produit individuelle indexable. Cohérent avec l'option "R2 noindex par défaut" du legacy.

### Volume R2 (3 sources Supabase croisées)

| Source | Count | Ratio |
|---|---|---|
| \`pieces\` (raw)             | ${f.pieces_total.toLocaleString('fr-FR')} | 100% |
| \`v_pieces_seo_safe\` (vue)  | ${f.pieces_seo_safe.toLocaleString('fr-FR')} | ${((f.pieces_seo_safe / Math.max(f.pieces_total, 1)) * 100).toFixed(1)}% |
| \`__sitemap_p_xml\` (sitemap actuel) | ${f.pieces_in_sitemap.toLocaleString('fr-FR')} | ${sitemapRatio}% |

**Justification empirique \`R2IndexabilityGate\`** : sans gate strict, R2 pourrait passer de ${f.pieces_in_sitemap.toLocaleString('fr-FR')} URLs (sitemap actuel) à ${f.pieces_seo_safe.toLocaleString('fr-FR')} (×${r2Multiplier}) — risque de spam Google catastrophique. Gate non négociable avant tout branchement R2.

## Décision PR-2 (proposée à partir des findings)

**Scénario ${scenario.code} — ${scenario.label}**

${scenario.rationale}

**Manques prioritaires confirmés** :

1. \`R2IndexabilityGate\` — absent (volet 4 montre volume × ${r2Multiplier} potentiel sans gate)
2. \`SeoSurfaceRegistry\` + \`SeoVariantFamilyRegistry\` + \`SeoFeatureFlagRegistry\` — registries non identifiés dans l'inventaire
3. \`seo_render_fingerprint\` table — inexistante (pas de duplicate gate observable)
4. \`SeoUnavailablePolicy\` 410/412 contextualisé — à raccorder au système 3 couches erreurs existant (auditer en PR-2)
5. Variables marketing \`#PrixPasCher#\` / \`#VousPropose#\` / \`#MinPrice#\` — vérifier statut réel dans \`SeoSwitchesService\` (le doc switch les disait TODO)
6. R0 home hub SEO — actuellement non branché à \`___meta_tags_ariane\`
7. R3 contenu éditorial — doit venir du wiki canonique (ADR-031), pas clone PHP

**Hors-scope PR-2** (différés) :
- R2 fiche produit complète (PR-11 conditionnel post-stabilisation A-D)
- Blog (PR-12)
- R4 critères techniques + OEM cross-reference (≥ PR-13)
`;
}

function decidePr2Scenario(coverageRatio: number): { code: string; label: string; rationale: string } {
  if (coverageRatio < 40) {
    return {
      code: 'A',
      label: 'refactor majeur',
      rationale: `Couverture filename ${coverageRatio}% — créer la majorité des 14 services cibles. Effort ~2 sprints. **Confirmer en PR-2a** par audit fonctionnel approfondi (filename mapping ne reflète pas tout : certains services existants couvrent partiellement plusieurs cibles).`,
    };
  }
  if (coverageRatio < 75) {
    return {
      code: 'B',
      label: 'complétion ciblée',
      rationale: `Couverture filename ${coverageRatio}% — 5-7 services à créer + 2-3 à étendre + registries à introduire. Effort ~1.5 sprint. **Probablement plus de couverture fonctionnelle** que ce ratio brut ne suggère.`,
    };
  }
  return {
    code: 'C',
    label: 'raccord léger',
    rationale: `Couverture filename ${coverageRatio}% — juste compléter manques (variables marketing, R2IndexabilityGate, registries, fingerprint stub, robots policy centralisée). Effort ~1 sprint.`,
  };
}
