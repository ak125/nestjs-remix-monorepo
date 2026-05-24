# Verdict empirique — Ahrefs internal-links automecanik.com — 2026-05-24

## Coverage manifest

- **Dataset analysé** : 497 destinations distinctes, 2 012 090 liens internes (export externe Ahrefs/crawler tiers, fourni par l'owner)
- **Sources internes croisées** : 5
  - Code Remix rendu : [Navbar.tsx](frontend/app/components/Navbar.tsx), [Footer.tsx](frontend/app/components/home/Footer.tsx), [BottomNav.tsx](frontend/app/components/layout/BottomNav.tsx)
  - Canon role-matrix v5 : [.spec/00-canon/role-matrix.md](.spec/00-canon/role-matrix.md)
  - URL contract D3 : [packages/seo-url-contract/src/url-rules.ts](packages/seo-url-contract/src/url-rules.ts)
  - Runtime DB : tables `__seo_internal_link`, `__seo_page`, vue `v_seo_internal_link_stats` (Supabase live)
  - Memory canon : `project_a_b_c_surfaces_distinction.md` (2026-05-23)
- **Invariants testés** : 6/6
- **URLs vérifiées canon URL-contract** : 100/497 (stratifié top 20 + sample tail 80)
- **URLs cross-checkées DB** : 25/497 (top 22 par link-count + 3 tail R4 reference)
- **Drifts détectés** : 3 (I4 partiel, I5 critique, anomalie /marques)
- **Hors scope** : commerce-loop conversion JOIN (gap data persistance documenté Phase C), parser Ahrefs CSV → DB (gated owner)

## Invariants

### I1 — Top destinations sitewide = bloc nav rendu Remix

**Status : SATISFIED** (avec nuance volumétrique)

Comptage instances DOM par URL (SSR Remix rend desktop + mobile dans le même HTML — crawler voit tout) :

| URL Ahrefs | links Ahrefs | Instances DOM/page | Source |
|------------|--------------|--------------------|--------|
| `/diagnostic-auto` | 40 000 | **4** | [Navbar.tsx:261](frontend/app/components/Navbar.tsx#L261) (desktop CTA) + [Navbar.tsx:405](frontend/app/components/Navbar.tsx#L405) (mobile drawer) + [Footer.tsx:15](frontend/app/components/home/Footer.tsx#L15) + [BottomNav.tsx:19](frontend/app/components/layout/BottomNav.tsx#L19) |
| `/plan-du-site` | 40 000 | 1 | [Footer.tsx:18](frontend/app/components/home/Footer.tsx#L18) |
| `/blog-pieces-auto` | 39 942 | 3 | [Navbar.tsx:253](frontend/app/components/Navbar.tsx#L253) + [Navbar.tsx:397](frontend/app/components/Navbar.tsx#L397) + [Footer.tsx:16](frontend/app/components/home/Footer.tsx#L16) |
| `/contact` | 39 917 | 1 | [Footer.tsx:17](frontend/app/components/home/Footer.tsx#L17) |
| `/` | 37 342 | 3 | [Navbar.tsx:160](frontend/app/components/Navbar.tsx#L160) (mobile logo) + [Navbar.tsx:215](frontend/app/components/Navbar.tsx#L215) (desktop logo) + [BottomNav.tsx:9](frontend/app/components/layout/BottomNav.tsx#L9) |
| `/account/dashboard` | absent du dataset | 1 (mobile only) | [BottomNav.tsx:25](frontend/app/components/layout/BottomNav.tsx#L25) — `rel="nofollow"` implicite + page logged-in |

**Evidence structurelle** : tous les top 17 destinations à 37K-40K ont une source dans le bloc nav sitewide. Le plafond ~40 000 = budget crawl du sample Ahrefs (corpus pages indexées). Pages tail (1-100 liens) = liens organiques contextuels (PopularSearches home + BrandsGrid home + maillage `internal-linking.service.ts`).

### I2 — Aucune URL surface-C dans le dataset

**Status : SATISFIED**

Patterns surface-C recherchés (selon memory `project_a_b_c_surfaces_distinction.md` 2026-05-23 — outil interactif hors-SEO, qui N'EXISTE PAS) : `/diagnostic/interactif`, `/diagnostic/outil`, `/diagnostic-interactif`, `/assistant`, `/outil`, `/wizard`, `/triage-interactif`, `/diagnostic-auto/{symptom}/wizard`. Comptage dans dataset : **0 occurrence**.

Toutes les occurrences de `/diagnostic-auto` dans le dataset sont l'URL exacte sans suffix (R5 éditorial pur). Le canon A/B/C est respecté.

### I3 — URL contract patterns D3

**Status : SATISFIED**

Échantillon stratifié testé contre `isMalformedSeoUrl()` / `detectMalformedSegment()` ([url-rules.ts:59-104](packages/seo-url-contract/src/url-rules.ts#L59-L104)) :

- Top 20 URLs (37K-40K liens) : 20/20 valid
- Sample tail 80 URLs (1-100 liens, incluant R8 motorisations + R2 produits avec query `?r=1` + R3/R6 blog) : 80/80 valid

Aucun pattern malformé détecté : pas d'`empty_segment`, `spaces_in_url`, `missing_alias`, `null_in_url`, `type_prefix_fallback`, `repeated_id`, `accented_chars`. Les query params (`?r=1`) sont ignorés par `isMalformedSeoUrl` (split sur `?` line 98) — comportement attendu.

### I4 — PageRole role-matrix v5 mapping

**Status : DRIFT partiel** (13/17 patterns top-niveau couverts ; 4 URLs utilitaires hors-canon)

| Pattern URL dataset | PageRole canon | Status |
|---------------------|----------------|--------|
| `/` | R0 (Home) | ✅ mappé canon (`.spec/00-canon/role-matrix.md:73-85`) |
| `/diagnostic-auto` | R5 (Diagnostic) | ✅ mappé canon (`role-matrix.md:144-156`) |
| `/blog-pieces-auto` | R3 (Conseils) | ✅ mappé canon |
| `/blog-pieces-auto/conseils[/:slug]` | R3 | ✅ |
| `/blog-pieces-auto/guide-achat[/:slug]` | R6 (Guide d'achat) | ✅ mappé canon (`role-matrix.md:158-170`) |
| `/blog-pieces-auto/auto/{marque}/{modele}` | R3 (vehicle-aware) | ✅ |
| `/pieces/{slug}-{id}.html` | R1 (Router gamme) | ✅ |
| `/pieces/{slug}-{id}/{marque}.../{type}.html` | R2 (Product) | ✅ |
| `/constructeurs/{marque}-{id}.html` | R7 (Brand) | ✅ |
| `/constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html` | R8 (Vehicle) | ✅ |
| `/reference-auto/{slug}` | R4 (Reference) | ✅ |
| **`/plan-du-site`** | ❌ aucun rôle | DRIFT — utilitaire, hors R0-R8 |
| **`/contact`** | ❌ aucun rôle | DRIFT — utilitaire support, hors R0-R8 |
| **`/marques`** | ❌ aucun rôle | DRIFT — navigation, hors R0-R8 |
| **`/catalogue`** | ❌ aucun rôle | DRIFT — navigation, hors R0-R8 |

**Lecture** : R0-R8 gouverne les pages SEO publiques à promesse centrale ; `/plan-du-site` / `/contact` / `/marques` / `/catalogue` sont des **utilitaires de navigation/support** que role-matrix v5 ne couvre pas explicitement. C'est un drift de **complétude de la taxonomie**, pas d'une mauvaise qualification. Décision à porter au vault si l'owner veut une couverture exhaustive (extension role-matrix vers R*-utility ou couche dédiée).

### I5 — Compteur interne inbound_links vs Ahrefs

**Status : DRIFT critique — gap d'instrumentation runtime**

Findings empiriques runtime (Supabase live `cxpojprgwgubzjyqzmoq`, 2026-05-24) :

| Source interne | Attendu | Mesuré | Verdict |
|----------------|---------|--------|---------|
| Table `__seo_internal_link` | peuplée (105K liens internes selon `internal-linking.service.ts`) | **0 rows** | ❌ table définie, jamais alimentée |
| Vue `v_seo_internal_link_stats` | top URLs par `inbound_count` | **0 rows** (vue vide cascade) | ❌ |
| Table `__seo_page` | ground truth toutes URLs SEO émises | **321 838 rows tous `page_type='product'` (R2 uniquement)** | ❌ couverture incomplète |
| URLs Ahrefs top 22 trouvées dans `__seo_page` | au moins R1/R7 hub pages | **0/22** | ❌ aucune URL hub R1/R7/R3/R4/R5/R8 dans la table |

**Conséquence** :
1. Le compteur interne d'inbound-links n'existe pas en pratique → **aucun moyen de croiser Ahrefs externe vs runtime interne** sans alimenter `__seo_internal_link`.
2. Le « ground truth officiel des URLs émises » (sitemap V10) n'est représenté dans `__seo_page` **que pour les R2 produits** (321 838 rows) ; les ~38K URLs R7 brand + ~13K R8 véhicule + R1/R3/R4/R5/R6 + utilitaires (`/`, `/diagnostic-auto`, `/contact`, `/plan-du-site`) sont **invisibles côté DB**.

Référence MEMORY : ce finding s'aligne avec `feedback_audit_needs_runtime_wiring_and_db_truth.md` (audit doit ajouter runtime-wiring + DB-live + truth-propagation) et le pattern `project_commerce_runtime_truth_audit_20260522.md` F1 (attribution `orl_website_url` orpheline — même genre de colonne/table définie mais jamais propagée).

### I6 — `/diagnostic-auto` rang #1 vs `/`

**Status : SATISFIED — structurellement attendu**

Évidence (cross-check I1) :
- `/diagnostic-auto` : **4 instances DOM/page** (Navbar desktop CTA + Navbar mobile drawer + Footer USEFUL_LINKS + BottomNav mobile Stethoscope)
- `/` (home) : **3 instances DOM/page** (Navbar mobile logo + Navbar desktop logo + BottomNav mobile Home icon)

Ratio théorique = 4/3 = +33%. Ratio Ahrefs observé = 40 000 / 37 342 = +7.1%. L'écart < ratio théorique s'explique par :
- Saturation du budget crawl Ahrefs à ~40 000 pages (le plafond du sample, vu sur 6 URLs top toutes ~à ce niveau)
- Distribution non-uniforme du corpus crawlé (toutes les pages n'ont pas les 4 instances visibles — pages auth-only n'affichent pas BottomNav par exemple)

**Pas d'anomalie comportementale.** Le rang #1 de `/diagnostic-auto` est une conséquence directe et **gouvernée** du choix produit canon (R5 = surface A SEO, CTA primaire dans la nav, confirmé par `project_a_b_c_surfaces_distinction.md`). Aucune action requise.

## Anomalies détectées (consolidées)

| # | Type | URL/cible | Source de divergence | Action recommandée (gouvernée) |
|---|------|-----------|---------------------|--------------------------------|
| A1 | DRIFT canon | `/plan-du-site`, `/contact`, `/marques`, `/catalogue` | role-matrix v5 ne couvre pas les utilitaires | Décision owner : extension role-matrix (vault PR ADR-XXX) ou acceptation comme hors-canon. Pas de fix mécanique. |
| A2 | Divergence code↔crawler | `/marques` (38 597 liens Ahrefs) vs `/#marques` (anchor dans Navbar:243+389+Footer:14) | Le crawler voit `/marques` mais la nav code pointe `/#marques`. Source probable : sitemap V10 ou un redirect. | Investigation owner (curl HEAD `/marques` + check sitemap V10 émission) avant toute action. Constraint canon : `feedback_no_url_changes_ever.md` STRICT. |
| A3 | DRIFT runtime instrumentation | `__seo_internal_link` = 0 rows ; `__seo_page` = R2-only (321 838 / probablement ~700K+ attendues toutes surfaces) | Table définie ([migration 20260122_sitemap_v10_enterprise.sql]) mais jamais alimentée par le pipeline runtime ; sitemap V10 n'écrit pas les surfaces non-R2 | Issue tracker — pas de fix immédiat, signal vers l'owner SEO-runtime. Pattern identique à `feedback_audit_needs_runtime_wiring_and_db_truth.md`. |

## Verdict global

Distribution des liens internes **structurellement cohérente** avec le canon role-matrix v5 et le bloc de navigation sitewide rendu par Remix ; **aucune URL surface-C ne fuit**, **aucun pattern URL malformé**. Trois drifts gouvernés à présenter à l'owner avant toute action mécanique : (1) 4 URLs utilitaires hors role-matrix, (2) divergence code `/#marques` vs canonical `/marques` côté crawler, (3) gap d'instrumentation runtime (`__seo_internal_link` jamais peuplé, `__seo_page` couvre R2 uniquement).

## Hors scope explicite (anti-overclaim)

- Pas de mesure de **conversion-rate par URL** — la table `__seo_internal_link` est vide et il n'existe pas de JOIN persistant URL→panier→commande (cart-analytics est Redis-only). Cible Phase C du plan si owner GO.
- Pas d'import du **dataset Ahrefs** en DB — réservé à Phase C, gated owner sign-off.
- Pas de **fix mécanique** sur Navbar/Footer/BottomNav/`__seo_internal_link`/`__seo_page` — verifier read-only par contrat.
- Pas de jugement **commerce-loop** sur la distribution des liens — `feedback_seo_is_not_the_product_acquisition_serves_conversion.md` rappelle que le KPI unique est commande organique attribuable, pas l'équité de liens internes.

## Annexe — Root-cause analysis A2 et A3 (auto-mode, read-only)

### A2 — Source des 38 597 liens vers `/marques`

Grep exhaustif `frontend/app/` + `backend/src/modules/seo/` : **aucune route Remix `/marques`** n'existe. Routes voisines présentes :

- [frontend/app/routes/brands._index.tsx](frontend/app/routes/brands._index.tsx) — sert `/brands` (slug différent), liste publique des marques
- [frontend/app/routes/products.brands.tsx](frontend/app/routes/products.brands.tsx) — admin
- [frontend/app/routes/constructeurs.$brand[.]html.tsx](frontend/app/routes/constructeurs.$brand%5B.%5Dhtml.tsx) — sert `/constructeurs/:brand.html` (R7 brand canonical)

Seule occurrence textuelle de `/marques` dans le code monorepo : [frontend/app/routes/plan-du-site.tsx](frontend/app/routes/plan-du-site.tsx) — utilise `/#marques` (anchor home, pas l'URL canonique).

**Conclusion** : `/marques` reçoit 38 597 liens internes Ahrefs mais **n'a aucune source identifiable dans le code Remix actuel**. Hypothèses (à investiguer par l'owner avec accès SSH PROD) :

1. **Legacy server-side** : pages héritées du PHP rendues par un sous-domaine ou un catch-all qui réécrit `/marques` côté serveur (le memory ne couvre pas cette migration)
2. **Sitemap statique XML** non géré par sitemap V10 V10 enterprise (qui ne contient que R2 product per I5)
3. **Caddy URL rewrite** : redirect 301 `/marques` → `/brands` ou `/#marques` (Ahrefs comptabiliserait la cible de référence avant redirect)

Action : `curl -I https://www.automecanik.com/marques` depuis un poste avec accès réseau valide, plus inspection [docker/Caddyfile](docker/) si présent. **Hors scope du verifier (mode read-only filesystem)**.

### A3 — Root-cause `__seo_internal_link` 0 rows en live

Cartographie complète du cycle de vie de la table :

| Étape | Localisation code | Statut |
|-------|-------------------|--------|
| **DDL** (définition schéma) | [backend/supabase/migrations/20260122_sitemap_v10_enterprise.sql:101-124](backend/supabase/migrations/20260122_sitemap_v10_enterprise.sql#L101-L124) | ✅ Table créée avec UNIQUE constraint + 3 indexes + 9 link_type CHECK |
| **READER #1** | [backend/src/modules/seo/services/sitemap-v10-scoring.service.ts:258-277](backend/src/modules/seo/services/sitemap-v10-scoring.service.ts#L258-L277) | ✅ Lit `to_url, link_type WHERE is_active=true` pour composer le score `GraphStrength` (hub/breadcrumb/total) injecté dans `__seo_entity_score_v10` |
| **WRITER** | grep `INSERT INTO __seo_internal_link` + `.from('__seo_internal_link').insert/upsert` dans tout `backend/src/` + `backend/supabase/` | ❌ **0 résultat — aucun code n'écrit jamais dans la table** |
| **Données live** (Supabase `cxpojprgwgubzjyqzmoq`) | `SELECT COUNT(*) FROM __seo_internal_link` | 0 rows |

**Conséquence en cascade** : `sitemap-v10-scoring.service.ts` produit un `inboundMap` vide → la composante `GraphStrength` du scoring est neutralisée → la `priority` et le `temperature` calculés dans `__seo_entity_score_v10` se basent sur un **signal manquant**. Les sitemaps émis par V10 sont donc **sub-optimaux par construction** : ils ignorent la topologie réelle du graphe interne.

Pattern identique aux cas documentés :
- `project_commerce_runtime_truth_audit_20260522.md` F1 — colonne `orl_website_url` orpheline (attribution column never written)
- `feedback_audit_needs_runtime_wiring_and_db_truth.md` — auditer la propagation runtime, pas juste file-vs-file
- Skill canon `runtime-truth-audit` — check #4 « attribution columns never written » s'applique directement ici

**Pas de fix proposé** (canon `feedback_no_autoescalation_after_single_go.md` + `feedback_no_url_changes_ever.md`). Décision owner :
- (a) Ajouter un producer write au service `internal-linking.service.ts` (qui injecte ~105K liens à la volée) ou un job batch nightly qui crawle le site rendu et upserte
- (b) Supprimer le reader scoring (et donc neutraliser explicitement la composante `GraphStrength`)
- (c) Le marquer comme « zombie code » dans le ratchet `runtime-truth-audit` jusqu'à arbitrage produit

---

## Annexe 2 — Vérification empirique HTTP PROD (read-only, 2026-05-24 21:55 UTC)

`curl -I https://www.automecanik.com/{url}` avec UA crawler-like. Toutes les URLs hors-canon de A1 sont **servies réellement par PROD** :

| URL | HTTP | Cache-Control | Verdict |
|-----|------|---------------|---------|
| `/` | 200 | `public, max-age=300, stale-while-revalidate=3600` | R0 home cacheable public |
| `/marques` | **200** | `private, max-age=60` | Route servie, **pas un fantôme** |
| `/contact` | **200** | `private, max-age=60` | Route servie |
| `/plan-du-site` | **200** | `private, max-age=60` | Route servie |
| `/catalogue` | **200** | `private, max-age=60` | Route servie |
| `/diagnostic-auto` | 200 | `private, max-age=60` | R5 |
| `/blog-pieces-auto` | 200 | `private, max-age=60` | R3 hub |
| `/brands` | 200 | `private, max-age=60` | Route alt parallèle à `/marques` |

**Correction du finding A2 initial** : la route `/marques` EXISTE — elle est servie par [frontend/app/routes/_public+/marques.tsx](frontend/app/routes/_public%2B/marques.tsx) (convention Remix flat-routes : le dossier `_public+` groupe sans préfixer l'URL). Mon premier grep a manqué cette route à cause du `+` dans le nom de dossier. **Le verifier auto-corrige son finding A2** (signe que le format coverage manifest fonctionne — l'inversion empirique est traçable).

**Nouveau finding (issue ouverte)** : la route `/marques` existe et reçoit 38 597 liens Ahrefs, mais **aucun émetteur textuel `/marques` (URL exacte, sans `#`) n'a été trouvé dans le monorepo** (grep complet `frontend/app/` + `backend/src/`, hors `marques.tsx` self-ref). Les seules occurrences sont :
- `frontend/app/routes/plan-du-site.tsx` : pointe vers `/#marques` (anchor, pas la route)
- `backend/src/modules/seo/services/sitemap-v10-hubs-vehicle.service.ts:572,637` : labels "Toutes marques" dans un HTML template (sans href vers `/marques`)
- `backend/src/config/r6-keyword-plan.constants.ts:319` + `backend/src/modules/search/services/pieces-analysis.service.ts:284` : keyword string "marques" (mention textuelle)

**Hypothèse résiduelle (à arbitrer par l'owner)** : les liens internes vers `/marques` proviennent vraisemblablement de l'index de **sitemap V10** émis publiquement (XML statique généré côté backend) — Ahrefs crawle le sitemap comme source de découverte d'URLs canoniques, et compte alors chaque hit comme un « lien interne » de l'index sitemap vers la cible. À confirmer en téléchargeant `/sitemap-index.xml` PROD et en grepant `<loc>https://www.automecanik.com/marques</loc>`. Investigation différée — Phase B owner.

**Doublon URL alarme** : `/marques` et `/brands` sont **tous deux servis 200 par PROD** avec contenu probablement équivalent (toutes les marques). Risque de **duplicate content SEO** si les deux ont des canonicals divergents. À vérifier dans la décision A1/A2 owner (étendre role-matrix v5 et trancher canonical).

---

## Annexe 3 — Sitemap V10 vs réalité Remix vs Ahrefs (closure A2 + nouveaux drifts critiques)

Probe HTTP PROD `/sitemap.xml` (sitemap index réel, **pas** `/sitemap-index.xml`) + sous-sitemaps + cross-check HTTP des URLs émises.

### Sitemap V10 index actuel (2026-05-24)

`/sitemap.xml` contient 10+ sous-sitemaps : `sitemap-racine.xml`, `sitemap-categories.xml`, `sitemap-vehicules.xml`, `sitemap-blog.xml`, `sitemap-pages.xml`, `sitemap-diagnostic.xml`, `sitemap-reference.xml`, `sitemap-brands.xml`, `sitemap-pieces-1.xml`, `sitemap-pieces-2.xml`, ...

### Drift 1 — Sitemap émet des URLs **404 et 301**

| URL émise dans `sitemap-pages.xml` | Priority | HTTP PROD réel | Verdict |
|--------------------------|----------|----------------|---------|
| `/` | 1.0 | 200 | ✅ |
| `/constructeurs` | **0.8** | **404** | ❌ **CRITIQUE** — page racine n'existe pas (routes Remix uniquement pour `/constructeurs/{brand}-{id}.html`). Google va indexer cette URL et trouver 404. |
| `/blog` | **0.7** | **301** | ❌ Redirect → gaspillage crawl budget (le sitemap NE DOIT JAMAIS émettre une URL qui redirect) |
| `/diagnostic-auto` | 0.8 | 200 | ✅ |
| `/reference-auto` | 0.8 | 200 | ✅ |
| `/contact` | 0.4 | 200 | ✅ |
| `/aide` | 0.4 | 200 | ✅ |
| `/faq` | 0.4 | non testé | présumé 200 |
| `/cgv`, `/mentions-legales`, `/politique-confidentialite` | 0.3 | non testé | présumé 200 |

### Drift 2 — Sitemap **ignore** 4 URLs qui reçoivent 38K-40K liens internes Ahrefs

| URL | Liens Ahrefs | Dans `sitemap-pages.xml` ? | HTTP PROD | Implication |
|-----|--------------|---------------------------|-----------|-------------|
| `/plan-du-site` | 40 000 | ❌ NON | 200 | 40K liens vers une URL canonical-invisible côté sitemap |
| `/blog-pieces-auto` | 39 942 | ❌ NON (mais `/blog` 301 émis) | 200 | Le sitemap pointe vers la mauvaise canonical R3 (alias 301 au lieu de la route canonique 200) |
| `/marques` | 38 597 | ❌ NON | 200, **AUCUN canonical**, **AUCUN robots tag** | 38K liens internes vers une page non émise + sans signal SEO → cannibalisation potentielle |
| `/catalogue` | 38 536 | ❌ NON | 200 | 38K liens vers URL canonical-invisible |

### Drift 3 — Doublon `/marques` vs `/brands` (canonical incohérent)

Probe HTML head des deux URLs (PROD, UA crawler-like) :

| URL | Title | `<link rel="canonical">` | `<meta robots>` | og:* | Verdict |
|-----|-------|--------------------------|-----------------|------|---------|
| `/marques` | `Marques - Automecanik` (minimaliste) | **ABSENT** | **ABSENT** | absent | Stub legacy non-SEO-optimisé, 38 597 liens internes pointent dessus |
| `/brands` | `Toutes les Marques Automobiles (0) \| Pièces Détachées Auto` | `https://www.automecanik.com/brands` | `index, follow` | complet | Page moderne SEO-tagguée MAIS **empiriquement cassée** : loader retourne `0 marques` (visible dans title + meta description) |

**Risque cannibalisation interne** : deux URLs publiques 200 sur la même intention (liste des marques), avec des signaux SEO divergents. Google peut indexer les deux et préférer `/marques` (qui reçoit plus de jus interne — 38 597 liens) malgré l'absence totale de signal canonical, au détriment de `/brands` (canonical correct mais zéro contenu). Net : ni l'une ni l'autre ne gagne, le ranking se dilue.

### Drift 4 — `__seo_page.priority` uniforme à 100%

Query DB live (2026-05-24) :

```sql
SELECT priority_bucket, COUNT(*), pct FROM ...
-- résultat unique : bucket "0.3-0.5" → 321 838 rows (100.00%)
```

**Verdict** : la composante `GraphStrength` du scoring V10 est neutralisée (cf. A3 — `__seo_internal_link` jamais peuplée), donc **toutes les pages produit R2 sortent au même bucket de priorité**. Google ne reçoit **aucun signal de priorisation différentielle** dans les sous-sitemaps — il décide seul de l'allocation crawl budget. Pour 700K+ URLs (probablement), c'est une perte d'opportunité majeure : impossible de signaler les pages haut-trafic vs pages cold/orphelines.

### Verdict ultime du verifier

Le bloc nav sitewide et la matrice canon role-matrix v5 sont **structurellement sains** (I1-I4 SATISFIED ou DRIFT mineur). En revanche, **le sitemap V10** — émetteur du « ground truth » des URLs publiables — présente **4 drifts critiques structuraux** (Drifts 1-4 ci-dessus) qui sabotent activement le crawl budget Google :

1. Émet une URL **404** (`/constructeurs`) avec haute priorité
2. Émet une URL **301** (`/blog`) au lieu de la canonical R3 réelle (`/blog-pieces-auto`)
3. **Ignore 4 URLs** (37K-40K liens internes chacune) que le maillage interne traite comme prioritaires
4. **Priorité uniforme** sur 321K pages produit (scoring V10 non-différenciant par absence de `__seo_internal_link`)

Ce sont des findings de **runtime-truth-audit canon** (skill listé en TOP priorities session) et qui s'alignent avec `feedback_seo_runtime_must_integrate_repo_control_plane.md` (pas de runtime parallèle non-gouverné) + `project_commerce_runtime_truth_audit_20260522.md` (perte de propagation des signaux).

**Aucune action mécanique déclenchée** par le verifier (constraint `feedback_no_url_changes_ever.md` STRICT + `feedback_sitemap_no_trigger.md` STRICT). Les fixes Phase B/C demeurent gated owner sign-off. Le verifier livre un evidence-pack prêt-à-arbitrer.

### Référence canon pour la décision owner

- Skill `runtime-truth-audit` (TOP priority session) : couvre exactement le pattern des Drifts 3+4 (attribution/scoring jamais écrit).
- ADR-058 Repository Control Plane : le sitemap V10 est runtime SEO et doit s'enregistrer `.spec/00-canon/seo-runtime/*.yaml` (per `feedback_seo_runtime_must_integrate_repo_control_plane.md`).
- ADR-064 partition rotation : `__seo_snapshot_*` rappel rotation cron — vérifier que les sitemap-snapshot ont aussi un cycle de rotation (hors scope verifier).

---

_Généré par Claude Code (Opus 4.7 1M) sur plan `utiliser-superpower-verifier-automecanik-lively-backus.md`. Aucune mutation code/DB. Pour traiter A1-A3 + Drifts 1-4 (sitemap V10), voir Phase B/C du plan, gated owner sign-off._
