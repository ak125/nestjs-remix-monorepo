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

/**
 * Findings inscrits manuellement (post-audit volet 1, à enrichir au fur et à mesure
 * que l'audit fonctionnel approfondi confirme/infirme les hypothèses du plan stratégique).
 */
export const KEY_EMPIRICAL_FINDINGS: Array<{ headline: string; evidence: string; impact: string }> = [
  {
    headline: 'V4 est code mort de production',
    evidence:
      "`DynamicSeoV4UltimateService.generateCompleteSeo()` n'est appelé QUE par `dynamic-seo.controller.ts` (4 endpoints admin/debug `/api/seo-dynamic-v4/*`). 0 appel par `rm-builder`, `gamme-rest`, `brand-rpc`, `vehicle-rpc` — les services applicatifs réels.",
    impact:
      'La régression GSC 73% `/pieces/*` ne vient PAS du contrat strict V4 (jamais appelé en prod). Elle vient des 4 systèmes SEO parallèles qui produisent des sorties divergentes. Confirme empiriquement la motivation PR-2 (centraliser via chaîne unique). Scénario A (refactor majeur) confirmé : raccord léger impossible si V4 jamais branché.',
  },
  {
    headline: "Contrat V4 strict (14 variables Zod) n'aide pas à débuguer en prod",
    evidence:
      "`SeoVariablesSchema.parse()` au top de `generateCompleteSeo()` (line 78) throw avant le try/catch. Les 14 champs requis (gamme, gammeMeta, marque, marqueMeta, marqueMetaTitle, modele, modeleMeta, type, typeMeta, annee, nbCh, carosserie, fuel, codeMoteur) sont rarement tous fournis quand l'endpoint est testé manuellement. V4 throw 500 générique sans message Zod détaillé.",
    impact:
      "Pas un bug en prod (V4 jamais appelé en prod), mais bloque tout test manuel de V4. À PR-2 : soit défauts sensibles sur 8 champs metaXxx (typiquement = champ principal lowercased), soit error handler controller qui propage le détail Zod.",
  },
  {
    headline: 'Sortie V4 ≠ sortie actuelle (divergent verdict)',
    evidence:
      'Sample 2/2 URLs avec inputs complets : `diff_verdict = divergent` (≥2 hashes title/h1/content différents). `current_fingerprint.robots = ""` (endpoint actuel ne retourne pas de robots dans le payload SEO).',
    impact:
      "Confirme que les 4 systèmes SEO parallèles produisent des sorties différentes — pas juste \"V4 plus riche\". À PR-2 : décider si V4 devient SoT et les autres adoptent ses sorties, ou si V4 est dépréciée au profit d'une 5e chaîne.",
  },
];

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

## Findings clés (audit fonctionnel)

${KEY_EMPIRICAL_FINDINGS.map((kf) => `### ${kf.headline}

**Évidence** : ${kf.evidence}

**Impact** : ${kf.impact}
`).join('\n')}

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
  // Verdict empirique consolidé itération PR-1 : V4 = code mort (0 appel applicatif réel).
  // Donc même si la couverture filename suggère B/C, le scénario A s'impose car aucun
  // service applicatif n'est réellement branché à la chaîne SEO V4.
  // Le ratio reste informatif pour estimer le travail de refactor.
  if (coverageRatio < 40) {
    return {
      code: 'A',
      label: 'refactor majeur',
      rationale: `Couverture filename ${coverageRatio}% **+ V4 confirmé code mort de production** (0 appel par services applicatifs réels). Créer la chaîne SEO + brancher tous les controllers actuels (rm-builder, gamme-rest, brand-rpc, vehicle-rpc) sur la chaîne. Effort ~2 sprints minimum. Voir "Findings clés" ci-dessus.`,
    };
  }
  if (coverageRatio < 75) {
    return {
      code: 'A→B',
      label: 'refactor majeur (avec base existante à réutiliser)',
      rationale: `Couverture filename ${coverageRatio}% (services existants à réutiliser : SeoSwitchesService, GammeResponseBuilderService, etc.) **mais V4 = code mort de production confirmé**. Le refactor doit brancher la chaîne sur les services applicatifs réels, pas juste compléter V4. Effort ~1.5-2 sprints.`,
    };
  }
  return {
    code: 'A→C',
    label: 'raccord léger côté V4 + branchement applicatif majeur',
    rationale: `Couverture filename ${coverageRatio}% côté V4 — V4 quasi-complet techniquement. **Mais V4 code mort** (0 appel applicatif). PR-2 = brancher V4 (ou son successeur) sur les services applicatifs, pas juste finir V4. Effort ~1-1.5 sprint.`,
  };
}
