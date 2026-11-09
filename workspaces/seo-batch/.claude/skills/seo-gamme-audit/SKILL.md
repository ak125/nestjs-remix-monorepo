---
name: seo-gamme-audit
description: "Audit SEO gamme ou véhicule en lecture seule : admission WIKI → export → projection → rendu, catalogue et relations par identifiants réels, liens et blocs réellement servis, anti-duplicate existant. Mesure et recommande, n'écrit rien. Use when user wants gamme audit, vehicle SEO audit. CLI: /seo-gamme-audit <pg_alias|pg_id|type:type_id>"
argument-hint: "<pg_alias | pg_id | type:<type_id>> [--batch gaps|qps-low] [--history]"
---

# SEO Audit — Skill v5.0 (gamme + véhicule, lecture seule)

## Usage
- `/seo-gamme-audit filtre-a-huile` — audit d'une gamme (R1/R2/R3/R4/R5/R6 + R8 liées)
- `/seo-gamme-audit 7` — même audit par `pg_id`
- `/seo-gamme-audit type:19052` — audit d'une motorisation (R8 + gammes liées)
- `/seo-gamme-audit filtre-a-huile --history` — lecture de l'historique legacy (aucune écriture)
- `/seo-gamme-audit --batch gaps` — 20 gammes éligibles aux chaînes les plus incomplètes
- `/seo-gamme-audit --batch qps-low` — 20 gammes aux plus faibles scores QPS existants

## Invariants de la méthode

1. **Lecture seule.** Aucun `INSERT`/`UPDATE`/`DELETE`/DDL, aucun appel API qui écrit, aucun
   flag basculé, aucun trigger sitemap. Le rapport recommande ; la production passe par la
   boucle `seo-content-loop` et ses validations.
2. **RAG n'est pas une autorité éditoriale** (ADR-031/046/119). Il ne détecte pas le mode, ne
   source aucun rôle, n'entre dans aucun score ni statut. La chaîne évaluée est
   **admission WIKI → export → projection → rendu**.
3. **Identifiants réels, jamais `page_key`/ILIKE.** Gamme = `__pg_gammes.id` (= `pg_id`) ;
   véhicule = `auto_type.type_id_i` ; liens gamme↔véhicule = `__cross_gamme_car_new`.
4. **Servi > stocké.** Les liens, blocs, robots, canonical et JSON-LD se lisent dans le HTML
   rendu ; un champ DB (ex. `sg_content`) ne prouve pas ce qui est servi.
5. **Mots, caractères, liens = mesures descriptives.** Ils ne déclenchent aucun statut
   READY et ne justifient pas de retirer une borne de contrat nécessaire au rendu.
6. **Absent ≠ zéro ≠ indisponible.** Une mesure impossible s'écrit `non mesuré` avec la
   raison ; un 5xx/timeout est `INDISPONIBLE`, pas « vide ».
7. **Champs protégés.** URL, canonical, robots, title, meta description, H1 optimisés : le
   rapport les décrit, ne propose jamais de les réécrire (STOP SEO indexé, owner-gated).

## Exécution DB

- Chemin de lecture existant : MCP `execute_sql` (`project_id: cxpojprgwgubzjyqzmoq`), chaque
  appel préfixé par `set transaction read only;` puis **un seul SELECT borné** (agrégat ou
  `LIMIT`). Un refus « read-only transaction » arrête l'audit : la requête écrivait.
- MCP indisponible (401…) : les étapes DB passent en `non mesuré (accès DB)`. Ne pas
  improviser d'accès avec les identifiants de `backend/.env`.
- `statement_timeout` : une requête qui dépasse 20 s est abandonnée et notée `non mesuré
  (timeout)`, jamais remplacée par une valeur par défaut.
- Pas de jointure qui multiplie les lignes : une sous-requête scalaire ou un `EXISTS` par
  table enfant, jamais un `LEFT JOIN` de deux tables 1-n dans le même SELECT.

### Validation de l'entrée (avant tout SQL)

| Entrée | Motif accepté | Résolution |
|---|---|---|
| alias gamme | `^[a-z0-9-]{2,80}$` | `select id from __pg_gammes where pg_alias = '<alias>'` |
| pg_id | `^[0-9]{1,6}$` | `select id, pg_alias from __pg_gammes where id = <n>` |
| véhicule | `^type:[0-9]{1,6}$` | `select ... from auto_type where type_id_i = <n>` |

Toute autre forme (slug modèle, URL, texte libre) est refusée avec ce tableau. Après
résolution, **seul l'entier** (`pg_id` ou `type_id`) est réutilisé dans le SQL, comme
littéral entier ; une valeur lue en base ou dans un fichier (nom, mot-clé, alias) n'est
jamais réinjectée dans une requête : utiliser une jointure ou une sous-requête.
`__pg_gammes` (232 gammes G1/G2) a 100 % d'alias conformes au motif ; `pieces_gamme`
en a 3 451 hors motif, d'où la résolution par la vue.

### Types de clés (cast explicite obligatoire)

| Colonne | Type | Comparaison |
|---|---|---|
| `__seo_gamme.sg_pg_id`, `__seo_gamme_conseil.sgc_pg_id`, `__blog_advice.ba_pg_id` | text | `= <pg_id>::text` |
| `__seo_gamme_purchase_guide.sgpg_pg_id` | varchar | `= <pg_id>::text` |
| `pieces_gamme.pg_id`, `__seo_reference.pg_id`, `__quality_page_scores.pg_id`, `gamme_aggregates.ga_pg_id`, `__seo_r2_pages.pg_id` | int | `= <pg_id>` |
| `__cross_gamme_car_new.cgc_pg_id` / `cgc_type_id` | text | `= <pg_id>::text` / `= <type_id>::text` |
| `__seo_observable.related_gammes` | int4[] | `@> array[<pg_id>]` |
| `__seo_r8_pages.type_id`, `auto_type.type_id` | text | `= <type_id>::text` |
| `auto_type.type_id_i` | int (index unique) | `= <type_id>` |
| `__seo_r2_pages.type_id` | bigint | `= <type_id>` |

## Rendu servi

- Base = instance DEV locale par défaut (lit la même base que PROD, en lecture). Le rapport
  note la base interrogée et le SHA servi ; PREPROD/PROD seulement sur demande, en GET.
- URL R1 = `/pieces/{pg_alias}-{pg_id}.html`, **confirmée** par le `<link rel="canonical">`
  rendu. Les autres URL (R2, R3, R4, R5, R6, R8) se **lisent** dans les `href` rendus ou dans
  les colonnes `canonical_url` ; aucune n'est construite à la main.
- Pour chaque page lue : statut HTTP, `meta robots`, canonical, nombre de `<h1>`, types
  JSON-LD, et décompte des `<a href>` par préfixe de rôle (`/pieces/{gamme}/…` = R2,
  `/blog-pieces-auto/conseils/` = R3, `/reference-auto/` = R4, `/diagnostic-auto/` = R5,
  `/blog-pieces-auto/guide-achat/` = R6, `/constructeurs/` = R7/R8).
- Classement d'une réponse : `200` = servi ; `200` + `noindex` sur R2 = **VIDE** (la route
  sert la page d'alternatives quand 0 produit) ; `404`/`410` = **ABSENT** ; `5xx` ou timeout
  = **INDISPONIBLE** ; un lien rendu qui répond 404 = **lien invalide**.
- Échantillon borné : la page R1, puis au plus 3 liens par rôle trouvés sur R1.
- JSON-LD : vérifier que chaque `FAQPage`/`ItemList` correspond à un bloc visible (même
  nombre de questions, même nombre d'items listés) ; un écart est un défaut technique.

## Mode gamme

### G0 — Résolution et contexte catalogue
```sql
set transaction read only;
select g.id as pg_id, g.pg_alias, g.label,
  pg.pg_level, pg.pg_display, pg.pg_name
from __pg_gammes g join pieces_gamme pg on pg.pg_id = g.id
where g.id = <pg_id>;
```
```sql
set transaction read only;
select products_total, vehicles_total, catalog_status, vehicle_coverage, index_policy,
  computed_at
from gamme_aggregates where ga_pg_id = <pg_id>;
```
`gamme_aggregates` est le contexte catalogue (pas un compte de produits vendables) ; toujours
citer `computed_at`. Les prix et stocks ne se lisent pas ici : leur autorité est
`PiecePriceDataService` (ne jamais re-requêter `pieces_price`), visible dans le rendu R2.

### G1 — Chaîne WIKI → export → projection → rendu
1. **Admission WIKI** : `wiki/gamme/{pg_alias}.md` sur `main` du dépôt wiki (le checkout
   local peut être en retard : noter le commit lu). Relever `review_status`, `reviewed_by`,
   `reviewed_at`, `truth_level`, `exportable.seo`. Admis = `review_status: approved` ET
   `exportable.seo: true` (ADR-119). Autre valeur = non admis ; fiche absente = ABSENT.
2. **Export** : `exports/seo/gamme/{pg_alias}.json` au même commit ; relever `content_hash`,
   `source_wiki_commit`, `roles_allowed`, `schema_version`.
3. **Projection** (ADR-059/090) :
```sql
set transaction read only;
select f.entity_id, f.active_version_id is not null as fact_active, f.updated_at,
  (select count(*) from __seo_content_blocks b
     where b.entity_id = f.entity_id and b.active_version_id is not null) as blocks_active,
  (select string_agg(distinct b.role, ',') from __seo_content_blocks b
     where b.entity_id = f.entity_id) as roles,
  (select count(*) from __seo_projection_conflicts c
     where c.entity_id = f.entity_id and c.resolved_at is null) as conflicts_open
from __seo_entity_facts f
where f.entity_type = 'gamme'
  and f.slug = (select pg_alias from __pg_gammes where id = <pg_id>);
```
```sql
set transaction read only;
select status, trigger_kind, wiki_commit_sha, entities_written, finished_at
from __seo_projection_runs order by started_at desc limit 3;
```
4. **Lecture de la projection par le site** : `SEO_PROJECTION_READ_V1` (défaut OFF) et
   l'allowlist `SEO_PROJECTION_READ_CANARY` (jetons `<ROLE>@gamme:<alias>`, défaut vide).
   Lire leur présence dans la configuration de l'instance auditée (nom de variable seul,
   jamais la valeur d'une autre variable). OFF ou jeton absent ⇒ le rendu sert le legacy :
   la projection est **présente, pas servie**. R1 n'a pas de projection autonome (il compose
   R3/R4/R6) ; `SEO_PROJECTION_GAMME_ROLES` borne les rôles écrits (défaut R3/R4/R6).
5. Le rapport place chaque rôle sur un des états : non admis / admis non exporté / exporté
   non projeté / projeté non servi / servi depuis la projection / servi legacy.

### G2 — R1 (page gamme routeur)
```sql
set transaction read only;
select length(sg_content) as content_chars, length(sg_title) as title_len,
  length(sg_descrip) as descrip_len, length(sg_h1) as h1_len, sg_updated_at
from __seo_gamme where sg_pg_id = <pg_id>::text;
```
Puis le rendu R1 (§Rendu servi) : statut, robots, canonical, `<h1>` unique, JSON-LD, liens
par rôle. Les liens de `sg_content` ne sont pas le maillage servi : signaler l'écart
contenu/rendu, sans conclure lequel corriger.

### G3 — R2 (pages gamme × véhicule)
R2 n'est pas « prêt » parce que la gamme a des produits. Mesurer séparément :
```sql
set transaction read only;
select count(*) as r2_pages,
  count(*) filter (where status = 'published') as published,
  count(distinct decision) as decisions,
  count(*) filter (where exists (select 1 from __seo_r2_signatures s where s.page_id = p.id)) as with_signature
from __seo_r2_pages p where p.pg_id = <pg_id>;
```
- `r2_pages = 0` ⇒ pas de composition R2 v2 ni de `catalog_signature` (ADR-066) : le noter,
  ce n'est pas un catalogue vide.
- Servi : au plus 3 liens R2 lus sur R1 ; pour chacun statut, robots, canonical et
  `ItemList.numberOfItems` (classement VIDE / ABSENT / INDISPONIBLE du §Rendu servi).
- Compatibilité : nombre de motorisations liées par niveau (contexte, pas un seuil) :
```sql
set transaction read only;
select cgc_level, count(*) from __cross_gamme_car_new
where cgc_pg_id = <pg_id>::text group by cgc_level order by cgc_level;
```
- Éligibilité R2 v2 : seuil gouverné `THRESHOLD_V1` de `R2EligibilityService`
  (`r2-eligibility.constants.ts`), non recopié ici.

### G4 — R3, R4, R5, R6
```sql
set transaction read only;
select count(*) as sections, count(distinct sgc_section_type) as section_types,
  avg(sgc_quality_score)::int as avg_quality, min(sgc_quality_score) as min_quality,
  max(sgc_enriched_at) as last_enriched
from __seo_gamme_conseil where sgc_pg_id = <pg_id>::text;
```
```sql
set transaction read only;
select id, is_published, length(definition) as def_chars,
  coalesce(array_length(confusions_courantes, 1), 0) as confusions, updated_at
from __seo_reference where pg_id = <pg_id>;
```
```sql
set transaction read only;
select count(*) as observables, count(*) filter (where is_published) as published
from __seo_observable where related_gammes @> array[<pg_id>];
```
```sql
set transaction read only;
select sgpg_is_draft, sgpg_gatekeeper_score, sgpg_source_verified,
  length(sgpg_how_to_choose) as choose_chars, sgpg_updated_at
from __seo_gamme_purchase_guide where sgpg_pg_id = <pg_id>::text;
```
Valider les noms de colonnes contre `information_schema.columns` avant le premier appel ;
une colonne absente = `non mesuré (schéma)`, jamais une colonne voisine supposée.
R5 est servi seulement si le rendu R1/R3 porte un lien `/diagnostic-auto/` qui répond 200.

**R6 et `SEO_R6_CONSOLIDATION_ENABLED`** (lu, jamais basculé ; défaut false,
`r6-guide-link-policy.service.ts`, ADR-103 D5) : flag OFF ⇒ lien
`/blog-pieces-auto/guide-achat/{alias}` rendu seulement si le guide est publié ; flag ON ⇒
aucun lien guide, l'intention est servie par l'article R3. Un lien guide absent sous flag ON
n'est pas un défaut ; un lien guide présent vers un guide brouillon en est un.

### G5 — R7 et R8
- R7 est un hub marque **transversal** : hors périmètre d'un audit gamme (aucun filtre
  gamme dans `__seo_r7_pages`). Ne pas reporter un total R7 global comme une mesure gamme.
- R8 liées à la gamme, par semi-jointure sur les identifiants :
```sql
set transaction read only;
select r.type_id, r.page_key, r.seo_decision, r.canonical_url, r.diversity_score
from __seo_r8_pages r
where exists (select 1 from __cross_gamme_car_new c
              where c.cgc_pg_id = <pg_id>::text and c.cgc_type_id = r.type_id)
order by r.type_id limit 50;
```
- Deux lignes pour un même `type_id` ou une même `canonical_url` = **incohérence à
  signaler**, jamais à trancher par déduction (choix owner).
- R8 reste une page véhicule : le rapport ne recommande jamais d'y ajouter un listing
  transactionnel.

### G6 — Anti-duplicate (réutiliser l'existant)
| Surface | Outil existant | Si indisponible |
|---|---|---|
| title / H1 / meta entre pages sœurs | `SeoBaliseCollisionGate` + `SeoFingerprintCore` (ADR-095 : HARD = collision exacte title/H1 sur pages indexables ; near-dup = `CALIBRATION_PENDING`) | `non mesuré` |
| R2 | `__seo_r2_signatures.catalog_signature`, `__seo_r2_metrics` | `non mesuré` si `r2_pages = 0` |
| R8 motorisations sœurs | skill `r8-diversity-check`, `__seo_r8_pages.diversity_score` | `non mesuré` |
| R3 vs R6 (consolidation) | `scripts/seo/seo-r3-consolidation-evidence.ts` (lecture, GSC ; Jaccard lexical = signal faible) | `OBSERVE` sans GSC |

Une comparaison « 100 premiers caractères » n'est pas une mesure de duplication.

### G7 — Qualité existante et fraîcheur
```sql
set transaction read only;
select page_type, quality_score, hard_gate_status, status, score_version, computed_at
from __quality_page_scores where pg_id = <pg_id> order by page_type;
```
Reporter les scores QPS **tels quels avec `computed_at`** ; aucun recalcul de repli, aucune
moyenne pondérée. Fraîcheur par rôle = date de mise à jour de la source servie (G2/G4).

## Mode véhicule (`type:<type_id>`)
```sql
set transaction read only;
select type_id_i, type_name, type_modele_id, type_marque_id, type_display
from auto_type where type_id_i = <type_id>;
```
- Plage `60000-83456` = types remappés noindex : le signaler, ne pas les mélanger aux legacy.
- Page R8 : `select page_key, seo_decision, canonical_url, robots_directive, diversity_score,
  sitemap_included from __seo_r8_pages where type_id = <type_id>::text limit 5;`
  (plusieurs lignes = incohérence à signaler).
- Gammes liées : `select cgc_level, count(*) from __cross_gamme_car_new where cgc_type_id =
  <type_id>::text group by cgc_level order by cgc_level;`
- Rendu : la `canonical_url` R8 en GET (§Rendu servi) ; diversité via `r8-diversity-check`.

## Statuts du rapport — quatre axes séparés

Chaque rôle reçoit un état par axe ; aucun axe ne compense un autre, aucun score composite.

| Axe | Source | États |
|---|---|---|
| Factuel | admission WIKI + export + projection (G1) | admis / non admis / absent |
| Éditorial | QPS existant, gatekeeper R6, `sgc_quality_score` (G4, G7) | conforme / à revoir / non mesuré |
| Technique | rendu servi : statut, robots, canonical, H1, JSON-LD, liens (§Rendu servi) | conforme / défaut / VIDE / ABSENT / INDISPONIBLE |
| Performance observée | GSC/GA4 via leurs outils isolés, période citée | mesuré / non mesuré |

Pas de donnée GSC inventée : sans accès, l'axe performance est `non mesuré`. Un classement
(« rank #1 ») n'est ni garanti ni un critère de statut.

## Output — Mode single

1. En-tête : entité, identifiant, date, base interrogée, SHA servi, commit wiki lu.
2. Tableau rôle × axes (Factuel / Éditorial / Technique / Performance).
3. Chaîne G1 rôle par rôle (état de la chaîne, flags de lecture lus).
4. Catalogue et compatibilité (G0, G3) avec `computed_at`.
5. Liens rendus par rôle (R1 → R3/R4/R5/R6/R2/R8) et liens invalides.
6. Anti-duplicate (G6) : verdict de l'outil existant ou `non mesuré`.
7. Incohérences à signaler (ex. doublons R8) — sans décision.
8. Recommandations : chacune nomme l'axe, la preuve et le circuit (boucle `seo-content-loop`
   pour le contenu ; owner pour URL/meta/H1/robots/canonical ou décision catalogue).
9. Couverture : étapes mesurées / `non mesuré` avec la raison.

## Mode batch

Population = `__pg_gammes` (232 gammes G1/G2). Une requête agrégée bornée, sans sous-requête
sur `pieces`/`pieces_price` :
```sql
set transaction read only;
select g.id as pg_id, g.pg_alias,
  exists (select 1 from __seo_entity_facts f where f.entity_type = 'gamme' and f.slug = g.pg_alias and f.active_version_id is not null) as projected,
  exists (select 1 from __seo_gamme sg where sg.sg_pg_id = g.id::text and sg.sg_content <> '') as has_r1,
  (select count(*) from __seo_gamme_conseil c where c.sgc_pg_id = g.id::text) as r3_sections,
  exists (select 1 from __seo_reference r where r.pg_id = g.id) as has_r4,
  exists (select 1 from __seo_gamme_purchase_guide p where p.sgpg_pg_id = g.id::text) as has_r6,
  (select ga.catalog_status from gamme_aggregates ga where ga.ga_pg_id = g.id) as catalog_status
from __pg_gammes g
order by projected, has_r1, r3_sections
limit 20;
```
`--batch qps-low` : même population, tri sur `min(quality_score)` de `__quality_page_scores`
avec `computed_at`, `limit 20`. Le batch liste des candidats ; il ne lit pas le rendu de
chaque gamme (lancer le mode single sur la gamme retenue).

## Mode --history

Lecture seule de `__seo_audit_history` (`where pg_id = <pg_id> order by audit_date desc
limit 10`). Ces lignes viennent de la méthode v3 (score composite avec RAG) : elles ne sont
pas comparables à un audit v5. Cette skill n'écrit pas d'historique ; un besoin de suivi
passe par un owner de données, pas par un `INSERT` depuis l'audit.

## Preuve pilote — filtre à huile (`pg_id 7`), 2026-10-31

Mesures en lecture seule, base partagée, rendu DEV sur `main` `2a49166e2`.

| Constat | Mesure | Ce que la méthode v4 disait |
|---|---|---|
| Résolution | `__pg_gammes.id = 7`, `filtre-a-huile` | idem |
| WIKI | fiche approuvée (`skill:promoter`, 2026-09-30), `exportable.seo: true`, lue sur wiki `main` `6c82c5c4d` ; checkout local en retard | RAG = source |
| Projection | 1 fait actif depuis 2026-10-05, 12 blocs actifs R3/R4/R6, 0 conflit ouvert ; dernier run cron `succeeded` le 2026-10-31 sur `a4783348`, 0 entité écrite | non évaluée |
| Lecture projection | `SEO_PROJECTION_READ_V1` absent en DEV ⇒ OFF, canary vide ⇒ rendu legacy | non évaluée |
| R1 rendu | 200, `index, follow`, canonical `/pieces/filtre-a-huile-7.html`, 1 `<h1>`, JSON-LD CollectionPage/ItemList/FAQPage/Organization ; liens R3 3, R6 3, R4 1, R5 0, R2 12 | ILIKE sur `sg_content` : R5 présent |
| R2 | 0 ligne `__seo_r2_pages` (pas de `catalog_signature`) ; échantillon `…/1-5-dci-19052.html` : 200, `index, follow`, `ItemList` 24 ; contexte `gamme_aggregates` 22 171 produits, 5 379 véhicules, `OK`, calculé 2026-10-31 | « READY » via jointure `pieces_price` > 10 |
| R8 | 3 lignes liées par `cgc_type_id`, pour les types 11056 et 19053 (1 INDEX, 2 REVIEW_REQUIRED) ; `type_id 19053` a 2 lignes pour la même canonical → incohérence signalée, non tranchée | 0 page (ILIKE `page_key`) |
| R3 / R4 / R5 / R6 | 12 sections, qualité moyenne 86 ; R4 publiée, définition 1 550 car., 3 confusions ; 5 observables dont 1 publié, 0 lien R5 servi ; R6 non brouillon, gatekeeper 92 | R5 « table inexistante » |
| QPS | R1 75,0 ; R3 conseils 90,8 ; R3 guide 93,4 ; R4 75,9 — calculés 2026-06-11 | moyenne pondérée avec RAG 20 % |
| R6 flag | `SEO_R6_CONSOLIDATION_ENABLED` absent ⇒ false ; liens guide rendus, guide publié : cohérent | non évalué |

Défauts de la v4 corrigés ici : SQL interpolé depuis l'entrée et depuis un fichier RAG ;
colonnes inexistantes (`sgc_section_key`, `sgc_heading`, `sgc_created_at`) ; table
`__seo_observable` déclarée absente ; R7 compté sans filtre gamme ; R8 par `page_key` ;
maillage lu dans `sg_content` ; duplication sur 100 caractères ; seuils de mots comme
critère READY ; `INSERT`/`CREATE TABLE` dans un audit « report-only » ; mode véhicule
référencé mais absent.
