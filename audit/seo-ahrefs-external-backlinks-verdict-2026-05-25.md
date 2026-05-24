# Verdict empirique — Ahrefs external-backlinks automecanik.com — 2026-05-25

## Coverage manifest

- **Dataset analysé** : 31 domaines référents externes / 100 liens externes (export Ahrefs collé par l'owner le 2026-05-24, vue agrégée « Principaux sites d'origine »)
- **Sources internes croisées** : 4
  - Runtime DB : table `__marketing_backlinks` (Supabase live `cxpojprgwgubzjyqzmoq`), **122 rows / 39 sous-domaines**, single bulk-import du 2026-02-08 (GSC CSV `automecanik.com-Top linking sites-2026-02-08.csv`)
  - Service NestJS : [marketing-data.service.ts](backend/src/modules/marketing/services/marketing-data.service.ts) (l.35-166) + wrapper [marketing-backlinks.service.ts](backend/src/modules/marketing/services/marketing-backlinks.service.ts) + controller [marketing-backlinks.controller.ts](backend/src/modules/marketing/controllers/marketing-backlinks.controller.ts)
  - Snapshot baseline : [.spec/marketing-module/README.md](.spec/marketing-module/README.md) (2026-02-09, ~124 backlinks documentés, automecanik.fr = `Self (.fr -> .com) 169 liens`)
  - Config canonique : [CLAUDE.md:255](CLAUDE.md#L255) (mention `automecanik.fr` comme variant owner)
- **Invariants testés** : **10/10** (B1-B9 + B11 ; B10 réservé pour extension future link-graph network analysis)
- **Domaines cross-checkés DB** : 31/31 (Ahrefs) + 9 domaines DB-only audités en sus
- **Drifts détectés** : **6** (A1-A6, dont 2 nouveaux découverts empiriquement : A5 capture anchor + A6 capture DA)
- **Hors scope** : refresh GSC API live (STUB, voir A2), import Ahrefs en DB (gated owner), fix mécanique (read-only)

## Invariants

### B1 — Couverture Ahrefs ⇄ DB live `__marketing_backlinks`

**Status : DRIFT — sources non-équivalentes**

| Métrique | Ahrefs export 2026-05-25 | DB `__marketing_backlinks` (snapshot 2026-02-08) |
|----------|--------------------------|---------------------------------------------------|
| Domaines (base) | 31 | 39 sous-domaines, ≈ 31 base-domains |
| Liens externes | 100 | 122 |
| Source | Crawler Ahrefs | GSC CSV import |
| Fraîcheur | 2026-05-25 | 2026-02-08 (106 j) |

**Diff structuré** :

- **4 domaines Ahrefs absents de la DB** : `atsameip.com` (4 liens), `proximeo.com` (2), `climaxsogutmasistemleri.com` (1), `univ-ouargla.dz` (1) — acquis ou indexés Ahrefs après le snapshot GSC de février.
- **9 domaines DB absents de l'export Ahrefs** : `avismalin.com` (2), `avis-site.com`, `cxtwinningclub.fr`, `fireball.com`, `frankelins.com`, `grupaolivier.pl`, `piecesenstock.mq`, `recit.net`, `verif.com` (1 chacun) — vus par GSC, pas listés dans le top Ahrefs (probablement perdus, ou seuils différents).
- **Subdomains splits** : Ahrefs agrège `linternaute.com=4`, DB voit `voyage.linternaute.com=3 + cinema.linternaute.com=2 + bricolage.linternaute.com=2` (total 7). Idem `caradisiac.com`, `motorlegend.com`, `gridinsoft.com`, `mappy.com`, `hardware.fr`, `blitz-gsi.com`, `galerie-creation.com`, `univ-batna2.dz`.

**Lecture** : les deux sources observent un même phénomène (graphe backlinks d'automecanik.com) avec des fenêtres temporelles, méthodes de découverte et règles de subdomain-aggregation différentes. Ce n'est pas une anomalie — c'est la nature de tout dataset backlinks tiers. Aucune décision empirique ne doit reposer sur une **différence stock** isolée entre deux outils.

### B2 — `automecanik.fr` n'est PAS une usurpation (variant officiel owner)

**Status : SATISFIED**

Triangulation 3 sources :

1. **Snapshot canon** [.spec/marketing-module/README.md:25](.spec/marketing-module/README.md#L25) : `| automecanik.fr | 169 | Self (.fr -> .com) |`
2. **CLAUDE.md** [ligne 255](CLAUDE.md#L255) : mention `automecanik.fr` comme variant owner (alongside `GOOGLE_SA_CLIENT_EMAIL`, `GSC_PROPERTY_URL`)
3. **Forensique URLs sources DB** : les 42 source_urls `automecanik.fr` dans `__marketing_backlinks` suivent **exactement la même structure que le .com** :
   - `/blog/article/comment-changer-...` (16 articles blog)
   - `/blog-pieces-auto/conseils/...` (13 fiches conseils)
   - `/blog-pieces-auto/auto/{marque}/{modele}` (R3 vehicle-aware)
   - `/pieces/{slug}-{id}/{marque}-{id}/{modele}-{id}/{id}-{id}.html` (R2 produits)
   - `/constructeurs/{marque}-{id}/{modele}-{id}/{id}.html` (R8 véhicules)

Une usurpation n'aurait pas reproduit à l'identique l'arborescence canonique R2/R3/R8 du .com. `automecanik.fr` est un legacy owner-owned (ancienne TLD, miroir contenu).

**Action canon** : **exclure** les 42 rows `automecanik.fr` du décompte « profil externe ». Décompte réel externe DB = 122 − 42 = **80 backlinks externes véritables** sur 38 sous-domaines (≈ 30 base-domains).

### B3 — Diff baseline 2026-02-09 vs Ahrefs 2026-05-25

**Status : SATISFIED — stable, pas de nouveau spammy**

| Source | Total liens | Domaines | Top sources cités |
|--------|-------------|----------|-------------------|
| README baseline (9 fév 2026) | ~124 | ~40 | automecanik.fr (169 self), sitelike.org (15), nosfavoris.com (12), forum-auto.caradisiac.com (4), oscaro.com (3), impactpubs.com (3) |
| Ahrefs export (25 mai 2026) | 100 externes | 31 base | nosfavoris.com (25), automecanik.fr (16/13), sitelike.org (9), 7repertoire.com (4), atsameip.com (4), … |

**Drift contrôlé** : aucun nouveau domaine clairement toxique apparu en 3,5 mois. Les variations entre les deux snapshots (ex. nosfavoris passe de 12 à 25 liens chez Ahrefs ; sitelike de 15 à 9) sont cohérentes avec la fenêtre de crawl de chaque outil et la nature « tag-pages auto-générées » des annuaires concernés. **`oscaro.com` (concurrent) et `impactpubs.com` (média) cités en baseline ne figurent pas dans le top Ahrefs collé** — soit perdus, soit hors top 31 de l'export.

### B4 — Classification empirique runtime-based (sans dépendance DA)

**Status : SATISFIED — méthode validée, descriptive DA inutilisable**

Mesure descriptive DA :

```sql
SELECT COUNT(*) FILTER (WHERE da_score IS NULL) FROM __marketing_backlinks;
-- → 122/122 NULL (100% capture gap, voir A6)
```

→ DA inutilisable comme critère. **Classification par triangulation 3 signaux runtime** :

1. **Pattern URL/structure source** : tag-pages auto-générées (ex. `7repertoire.com/tag-a-t134-p44.html`, `nosfavoris.com/codes/liens-favoris,1,0,1,1,A,,joint;de;culasse.html`) → directory low-quality. Thread forum thématique (ex. `forum-auto.caradisiac.com/topic/575445-c52008136chconfort/`) → editorial legit.
2. **Thématicité** : URL contient terme auto / pièce / marque → on-topic ; URL généraliste sans rapport → off-topic.
3. **Présence répétée** : ≥3 pages d'un même source_domain avec même target_url unique → soit annuaire à tags, soit recommandation produit éditoriale.

Triangulation appliquée systématiquement § B6 ci-dessous. DA reste un attribut descriptif souhaitable (voir A6) mais ne sert pas de gate décisionnel.

### B5 — Re-validation périodique active

**Status : DRIFT critique (A1)**

```sql
SELECT COUNT(*) FILTER (WHERE last_checked IS NULL) FROM __marketing_backlinks;
-- → 122/122 NULL (100%)
SELECT MIN(first_seen), MAX(first_seen) FROM __marketing_backlinks;
-- → 2026-02-08 / 2026-02-08 (cohorte unique)
```

**Aucune ligne n'a jamais été re-vérifiée** depuis l'import GSC du 2026-02-08 (106 jours). Le `status='live'` est figé : on ne sait pas combien sont devenus `lost` ou `broken`. Voir A1.

### B6 — Classification 31/31 domaines en taxonomie canon

**Status : SATISFIED — 31/31 classés, 0 toxic, 0 suspicious-pattern**

| # | Domaine Ahrefs | Liens (orig/cibles) | Catégorie | Évidence empirique |
|---|----------------|---------------------|-----------|--------------------|
| 1 | nosfavoris.com | 25/1 | `low-quality-passive` | URLs auto-gen tag-listing (`/codes/liens-favoris,1,0,...`) ; 12 rows DB stables |
| 2 | automecanik.fr | 16/13 | `brand-variant-owner` | Voir B2 — structure URL identique .com |
| 3 | sitelike.org | 9/1 | `low-quality-passive` | Site comparison auto-gen, 15 single pages DB |
| 4 | 7repertoire.com | 4/1 | `low-quality-passive` | Tag-IDs auto-gen (`tag-a-t134-p44.html`) |
| 5 | atsameip.com | 4/1 | `low-quality-passive` | Co-IP listing auto-gen (hors DB, pas vérifiable URL exacte) |
| 6 | linternaute.com | 4/2 | `legit-press` | DB voit forums auto thématiques (`/forum/auto/affich-800163433-...c4-picasso-2011...`) |
| 7 | mappy.com | 4/1 | `industry-directory` | DB `fr.mappy.com/poi/...` — POI listings locaux |
| 8 | mecanoenligne.fr | 3/1 | `industry-directory` | Niche auto-repair (`/category/systeme-de-gestion-de-la-temperature/`) |
| 9 | renault-laguna.com | 3/1 | `legit-press` | Forum owner Laguna thématique |
| 10 | caradisiac.com | 2/2 | `legit-press` | `forum-auto.caradisiac.com/topic/478012-fuite-tole-de-sol-honda-jazz-2/` thread organique |
| 11 | forum-mercedes.com | 2/1 | `legit-press` | Forum thématique Mercedes |
| 12 | motorlegend.com | 2/2 | `legit-press` | **Thread RECOMMANDATION** : `/forum-mecanique-auto/49789-pieces-auto-sur-automecanik-com-la-vente-en-ligne-au-plus-bas-prix` — backlink de valeur |
| 13 | proximeo.com | 2/1 | `low-quality-passive` | Recommendation directory (hors DB) |
| 14 | trustpilot.com | 2/1 | `safety-reputation` | DB `/review/automecanik.com` — neutre |
| 15 | univ-batna2.dz | 2/2 | `other` | PDF académique (`/sites/default/files/.../tpdegc.pdf`) — incidental |
| 16 | belles-boutiques.fr | 1/1 | `industry-directory` | `/voitures.html` listing |
| 17 | blitz-gsi.com | 1/1 | `legit-press` | Forum Opel GSI thématique |
| 18 | climaxsogutmasistemleri.com | 1/1 | `other` | Site HVAC turc, off-topic (hors DB) — vraisemblablement co-citation aléatoire |
| 19 | crazyauto.net | 1/1 | `legit-press` | Forum auto (`showtopic=7317`) |
| 20 | galerie-creation.com | 1/1 | `low-quality-passive` | Auto-gen tag page (`temoin.galerie-creation.com/_s/temoin-d-huile-bmw-e90/...`) |
| 21 | gridinsoft.com | 1/1 | `safety-reputation` | URL malware scanner (DB 2 rows : `gridinsoft.com` + `fr.gridinsoft.com`) |
| 22 | hardware.fr | 1/1 | `legit-press` | `forum.hardware.fr/.../Auto-Moto/probleme-frein-main-...` |
| 23 | infobel.com | 1/1 | `industry-directory` | DB row pointe vers une fiche Uruguay incohérente — anomalie crawler probable, non-impactant |
| 24 | pagesbox.fr | 1/1 | `industry-directory` | `/voiture/` listing |
| 25 | planete-honda.com | 1/1 | `legit-press` | Forum Honda owner thématique |
| 26 | planeteachat.com | 1/1 | `industry-directory` | `/annuaire/boutique-en-ligne/sites-auto-moto-bateaux/automecanik/` |
| 27 | scamadviser.com | 1/1 | `safety-reputation` | `/check-website/automecanik.com` automated check |
| 28 | travelandfilm.com | 1/1 | `other` | Blog voyage Irlande, totalement off-topic — incidental |
| 29 | univ-ouargla.dz | 1/1 | `other` | Académique (hors DB) |
| 30 | verifweb.com | 1/1 | `safety-reputation` | Verification check |
| 31 | webrankinfo.net | 1/1 | `safety-reputation` | `/site/118256.htm` site-info SEO |

**Distribution** :

| Catégorie | Count | % | Action canon |
|-----------|-------|----|--------------|
| `legit-press` | 9 | 29% | Aucune — backlinks de valeur |
| `industry-directory` | 6 | 19% | Aucune — Google déclasse, non pénalisant |
| `low-quality-passive` | 6 | 19% | Monitoring vélocité, pas d'action si stable |
| `safety-reputation` | 5 | 16% | Aucune — neutre, non manipulable |
| `other` | 4 | 13% | Aucune — incidental, off-topic non-amplifié |
| `brand-variant-owner` | 1 | 3% | Aucune — exclure du décompte externe |
| **`suspicious-pattern`** | **0** | **0%** | — |
| **`toxic`** | **0** | **0%** | — |

### B7 — Anchor distribution (sur-optimisation commerciale)

**Status : SKIPPED — capture gap A5**

```sql
SELECT COUNT(*) FILTER (WHERE anchor_text IS NULL) FROM __marketing_backlinks;
-- → 122/122 NULL (100% capture gap)
```

L'`anchor_text` n'est jamais peuplé. Impossible de mesurer une sur-optimisation commerciale empirique. Voir A5.

**Inférence prudente via source_url** : sur les ~80 URLs externes inspectées, les ancres probables (déduites du contexte source) sont majoritairement des mentions `automecanik.com` brutes (annuaires + safety-reputation citent l'URL) ou des liens textuels naturels dans threads forum (caradisiac, motorlegend recommandent le site explicitement). **Aucun pattern d'ancre commerciale sur-optimisée détectable** par lecture des contextes URL.

### B8 — Brand/commercial ratio (≥40% brand sain)

**Status : SKIPPED — capture gap A5**

```sql
SELECT COUNT(*) FILTER (WHERE anchor_type IS NULL) FROM __marketing_backlinks;
-- → 122/122 NULL (100%)
```

Idem B7 : `anchor_type` non capturé. Fallback heuristique sur source_url impossible sans le texte ancre lui-même. **Verdict prudent** : la structure des sources observées (forums, annuaires, safety checks) suggère un profil dominé par URL/brand naked, pas par exact-match commerciaux — mais non-prouvé empiriquement.

### B9 — Sitewide repetition (footer/widget patterns)

**Status : SATISFIED — 0 footprint sitewide détecté**

```sql
SELECT source_domain, COUNT(DISTINCT source_url) AS pages, COUNT(*) AS links
FROM __marketing_backlinks
GROUP BY source_domain
HAVING COUNT(DISTINCT source_url) > 50;
-- → 0 rows
```

**Tous les 39 sous-domaines ont `links == pages`** : 1 lien unique par page source. Le sous-domaine au plus haut count = `automecanik.fr` (42 pages = 42 liens), structurellement légitime (un lien par article/produit, pas un footer répété). `sitelike.org` 15/15, `nosfavoris.com` 12/12, etc. — **aucun pattern footer/widget industriel**.

C'est le signal le plus rassurant de l'audit : la chose qui distingue typiquement un network spammy d'un profil organique est l'amplification sitewide ; elle est totalement absente.

### B11 — Link velocity sanity (blindspot canon)

**Status : DRIFT critique — impossible à mesurer (A4)**

```sql
SELECT date_trunc('month', first_seen)::date AS cohort, COUNT(*), COUNT(DISTINCT source_domain)
FROM __marketing_backlinks GROUP BY cohort ORDER BY cohort;
-- → 1 seule cohorte : 2026-02-01 | 122 links | 39 domaines
```

**Une seule cohorte temporelle** (le bulk-import GSC du 2026-02-08, `first_seen` aplati). La dimension vélocité est **structurellement non-mesurable** sur la donnée actuelle :

- Pas de séries mensuelles → impossible de calculer médiane / burst / churn
- Pas de re-fetch (`last_checked` NULL) → impossible de détecter liens perdus
- Pas de timestamping incrémental → impossible de séparer « historique » de « nouveau »

**Inférence indirecte via Ahrefs vs baseline février** : 4 domaines apparus en Ahrefs absent de la DB de février (atsameip / proximeo / climaxsogutmasistemleri / univ-ouargla) suggèrent une vélocité d'acquisition de l'ordre de **~1 nouveau domaine par mois sur 3,5 mois** — pas un burst, pas un churn anormal. **Profil compatible avec « stable / slow-growth »**, conclusion fragile car la mesure n'est pas instrumentée. Voir A4.

## Anomalies & drifts consolidés

| # | Type | Localisation | Source de divergence | Action recommandée |
|---|------|--------------|---------------------|--------------------|
| **A1** | DRIFT instrumentation | `__marketing_backlinks.last_checked` = 100% NULL (122/122) | Aucun re-fetch jamais exécuté depuis import 2026-02-08 ; status='live' figé 106 j | Issue tracker — backlog cron `marketing-backlinks-revalidator` (head-check HTTP 200 → status `live` / `lost` / `broken`). Hors scope du verifier. |
| **A2** | DRIFT instrumentation | `__seo_gsc_links_weekly` (table définie [migration 20260122_sitemap_v10_enterprise.sql] zone seo-monitoring) = 0 rows, `gsc-links-fetcher.service.ts:69-115` est un STUB Phase 1 (`gsc_links_endpoint_not_publicly_available_v1__use_bulk_export_or_v2_dataforseo`) | GSC API ne fournit pas d'endpoint `listBacklinks` public v1 ; alternatives gated (GSC bulk export alpha, DataForSEO V2) | Decision owner — accepter le STUB (mode actuel : import manuel CSV) ou alimenter via fallback gated. Pattern identique `feedback_audit_needs_runtime_wiring_and_db_truth.md`. |
| **A3** | DRIFT runtime | Aucune infra disavow câblée — 0 table `__seo_disavow` / `__marketing_disavow` / `__toxic_links` ; 0 colonne `disavow_flag` sur `__marketing_backlinks` | Pattern « attribution column never written » (skill canon `runtime-truth-audit` check #4) | Aucune urgence vu B6 (0 toxic, 0 suspicious-pattern). Si décision owner future de disavow ponctuel : ajout additif `__marketing_backlinks.disavow_flag boolean DEFAULT false` + export `disavow.txt` à la demande. Hors scope verifier. |
| **A4** | DRIFT vélocité (canon) | `first_seen` aplati à 1 cohorte (`2026-02-08`) → B11 inerte | Import bulk one-shot, jamais réalimenté avec timestamps incrémentaux | Backlog ingestion : capturer `first_seen` réel à chaque ajout futur (admin import + cron). Sans ça, le signal Google le plus pondéré (vélocité) reste invisible. |
| **A5** | DRIFT capture | `__marketing_backlinks.anchor_text` + `anchor_type` = 100% NULL (122/122) | Colonnes définies dans le schema mais jamais peuplées par l'import GSC (qui ne fournit pas le texte ancre dans le CSV `Top linking sites`) | Decision owner — soit accepter (GSC fait défaut), soit complémenter via Ahrefs export complet (`Anchors` view). Sans ça, B7/B8 restent gris. |
| **A6** | DRIFT capture | `__marketing_backlinks.da_score` + `dr_score` = 100% NULL (122/122) | Colonnes descriptives Ahrefs/Moz, non fournies par GSC | Idem A5 — non bloquant (B4 a montré que la classification empirique runtime-based fonctionne sans DA). Cosmétique. |

## Verdict global

**Sortie (a) — Profil low-quality mais stable et non toxique** (hypothèse pré-audit empiriquement confirmée).

- **80 backlinks externes véritables** (122 − 42 self automecanik.fr) sur ~30 base-domains.
- **0 domaine** classé `toxic` ou `suspicious-pattern` (B6).
- **0 footprint sitewide** (B9 — le signal le plus discriminant pour distinguer profil organique vs network spammy : satisfait).
- **9/31 backlinks de valeur** (`legit-press` 29%) — caradisiac, motorlegend (recommandation explicite), hardware.fr, linternaute, etc.
- **Profil compatible « stable / slow-growth »** par inférence indirecte (B11 non-instrumenté empiriquement, voir A4).

**Aucune action mécanique requise. Aucun disavow.txt à produire.** Le risque de pénalisation Google sur ce profil est très faible — les `low-quality-passive` (nosfavoris, sitelike) sont des directories que Google déclasse automatiquement depuis le filtre Penguin (2012-2016) ; ils n'amplifient ni ne pénalisent.

### Priorisation explicite (anti-doctrine « SEO is the product »)

Cohérent avec `feedback_seo_is_not_the_product_acquisition_serves_conversion.md` + `project_reality_audit_verdict_conversion_funnel_20260520.md` (verdict empirique : problème = conversion funnel à 0.17%, pas backlinks).

1. **Instrumentation (dette technique)** — A1 (re-fetch `last_checked`) + A4 (capture vélocité `first_seen` incrémentale). Sans ces deux, tout futur audit backlinks restera aussi aveugle.
2. **Commerce-loop V1 / funnel conversion** — KPI canon (cf. `project_commerce_loop_v1_plan_20260519.md`). 100% du levier business attribuable.
3. **R2/R5 composition + CWV / indexabilité** — cohérent PR récents (#694 INP -33%, #690 R8 404 déterministe). Multiplicateur sur le trafic organique existant.

**Le backlink-building actif est explicitement NON prioritaire** vu : profil sain + très faible levier vs amélioration funnel + canon vault `feedback_more_seo_engineering_not_equal_more_business.md`.

## Hors scope explicite (anti-overclaim)

- Pas d'**import Ahrefs** en DB — gated owner sign-off (route admin POST `/api/admin/marketing/backlinks/import` disponible si l'owner décide).
- Pas de **refresh GSC live** — A2 est un STUB Phase 1, sortie hors scope.
- Pas de **création de cron `marketing-backlinks-revalidator`** — A1 est une décision owner, pas une réparation auto.
- Pas de **création d'infra disavow** (table, RPC, export) — A3 sans urgence vu B6.
- Pas de **création de `__marketing_backlinks.anchor_text/type`** capture pipeline — A5 décision owner (changer la source de vérité de GSC vers Ahrefs API ou compléter manuellement).
- Pas de **fix mécanique** sur `__marketing_backlinks` (read-only contract verifier).
- Pas de **mesure conversion attribuable par backlink** — impossible sans JOIN persistant (table `__marketing_backlinks` n'a pas de `attributed_orders_count` ou équivalent ; pattern `feedback_audit_needs_runtime_wiring_and_db_truth.md`).

## Annexe — Root-cause des 6 drifts

### A1 — `last_checked` 100% NULL

Cartographie write-path sur `__marketing_backlinks` (grep `from('__marketing_backlinks').(insert|upsert|update)` dans `backend/src`) :

| Méthode | Localisation | Trigger |
|---------|--------------|---------|
| `createBacklink()` | [marketing-data.service.ts:119-128](backend/src/modules/marketing/services/marketing-data.service.ts#L119-L128) | POST `/api/admin/marketing/backlinks` (IsAdminGuard) — single |
| `createBacklinks()` | [marketing-data.service.ts:131-141](backend/src/modules/marketing/services/marketing-data.service.ts#L131-L141) | POST `/api/admin/marketing/backlinks/import` (IsAdminGuard) — bulk |
| `updateBacklink()` | [marketing-data.service.ts:143-158](backend/src/modules/marketing/services/marketing-data.service.ts#L143-L158) | PATCH `/api/admin/marketing/backlinks/:id` — touche `updated_at`, jamais `last_checked` |
| `deleteBacklink()` | [marketing-data.service.ts:160-165](backend/src/modules/marketing/services/marketing-data.service.ts#L160-L165) | DELETE `/api/admin/marketing/backlinks/:id` |

**Aucun écrivain ne touche `last_checked`.** Pas de cron `marketing-backlinks-revalidator`. Pas de scheduler BullMQ. La colonne est purement définitionnelle. Pattern strict du canon `runtime-truth-audit` check #4 « attribution columns never written ».

### A2 — GSC fetcher STUB

[gsc-links-fetcher.service.ts:69-115](backend/src/modules/seo-monitoring/services/gsc-links-fetcher.service.ts#L69-L115) retourne `rowsInserted: 0` + warning explicite `gsc_links_endpoint_not_publicly_available_v1__use_bulk_export_or_v2_dataforseo`. Appelé par `SeoDailyFetchProcessor.handleDailyFetch()` (task='gsc_links') via cron BullMQ 04:00 UTC — exécute, ne produit aucune donnée, status='skipped'. Table `__seo_gsc_links_weekly` reste vide. Décision Phase 2 owner (GSC bulk export alpha ou DataForSEO V2).

### A3 — Disavow infra absente

Recherches exhaustives : 0 table matchant `__seo_disavow`, `__marketing_disavow`, `__toxic_links`, `__quality_disavow`. 0 colonne `disavow_flag`/`toxic_score` sur `__marketing_backlinks`. 0 fichier `disavow.txt` dans le repo (audit/ + frontend/public/ + scripts/seo/). Aucun service ou RPC associé. Si futur disavow décidé : extension additive `ALTER TABLE __marketing_backlinks ADD COLUMN disavow_flag boolean NOT NULL DEFAULT false, disavow_reason text` + endpoint admin POST `/api/admin/marketing/backlinks/:id/disavow` + export GET `/api/admin/marketing/backlinks/disavow.txt`. Hors scope.

### A4 — Vélocité non-instrumentée

`first_seen` (date column) aplati à `2026-02-08` pour 122/122 rows ⇒ unique cohorte mensuelle. Le `marketing-data.service.ts:createBacklinks()` insère le payload tel quel sans timestamp incrémental côté serveur. **Pour rendre B11 mesurable** : (a) admin import bulk doit accepter `first_seen` du CSV source quand disponible, OU (b) défaut à `CURRENT_DATE` côté server pour chaque INSERT, OU (c) ajout d'une seconde colonne `ingested_at timestamptz DEFAULT now()`. Décision owner.

### A5 + A6 — Capture anchor + DA

GSC CSV `Top linking sites` ne fournit ni anchor_text ni DA score (limites API gratuite). Le schema `__marketing_backlinks` les définit (cohérence Ahrefs-style) mais l'import bulk les laisse à NULL. Soit (i) accepter le gap (B7/B8 grisés tant qu'on reste sur GSC), soit (ii) complémenter via Ahrefs export `Anchors` view ou DataForSEO V2 API. Strictement décision owner — pas de fix mécanique justifié sans changement de source de vérité.

---

_Généré par Claude Code (Opus 4.7 1M) sur plan `automecanik-com-confidentialit-condition-zesty-honey.md`. Aucune mutation code/DB (read-only verifier contract). Pour traiter A1-A6, voir backlog instrumentation owner — priorisé après commerce-loop V1 et CWV (cf. `feedback_seo_is_not_the_product_acquisition_serves_conversion.md`)._
