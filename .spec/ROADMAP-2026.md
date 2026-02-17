---
title: "Roadmap 2026 - SEO + Marketing + Content"
status: active
version: 1.0.0
created: 2026-02-09
updated: 2026-02-09
supersedes: PHASE-3-ROADMAP.md
tags: [roadmap, seo, marketing, v-level, r4, r5, rag, backlinks]
---

# Roadmap 2026 — AutoMecanik SEO & Marketing

> Basee sur l'audit Supabase du 9 fevrier 2026 (projet `cxpojprgwgubzjyqzmoq`)

---

## Etat des lieux (Fevrier 2026)

### Ce qui fonctionne

| Systeme | Status | Metriques |
|---------|--------|-----------|
| SEO Programmatique | Fonctionnel | 321,838 pages auto-generees |
| Sitemaps V2 | Fonctionnel | 3-level, 1M+ URLs supportes |
| DynamicSeoV4 | Fonctionnel | 180% variables, meta tags dynamiques |
| Schema.org | Fonctionnel | JSON-LD Product, FAQ, Breadcrumb |
| Checkout | Fonctionnel | Amazon-style 2-step, Paybox/SystemPay |
| Blog | Fonctionnel | 85 articles, 1 guide |
| RAG Gammes | Fonctionnel | 230+ fichiers markdown riches |
| G-Level Classification | Fonctionnel | G1/G2/G3 avec seuils |

### Ce qui ne fonctionne pas

| Systeme | Probleme | Impact |
|---------|----------|--------|
| SEO Hub Dashboard | Lit tables vides (0 rows) au lieu de `__seo_page` (321K) | Dashboard admin inutilisable |
| V-Level | `recalculateVLevel()` = stub (TODO ligne 50) | 7,164 keywords non classifies |
| R4 References | Generateur cree du contenu placeholder | 133 squelettes sans contenu riche |
| R5 Diagnostics | 5 templates x 10 gammes, champs NULL | 65 entries, dtc_codes/actions manquants |
| Backlinks | Aucun suivi | 124 liens GSC non exploites |
| Marketing | Module inexistant | Pas de visibilite acquisition |
| RAG Vehicules | 2 fichiers seulement | Pas de matrice vehicule/symptome |
| SEO Monitoring | 30+ tables a 0 rows | Pas de middleware Googlebot |

### Donnees disponibles (exploitables)

| Table | Rows | Exploitation |
|-------|------|-------------|
| `__seo_page` | 321,838 | Non exploitee par le dashboard |
| `__seo_keywords` | 7,164 | Non classifiee V-Level |
| `__seo_confusion_pairs` | 124 | Non affichee dans risques |
| `__seo_gamme_purchase_guide` | 221 | Fonctionnel |
| `__seo_gamme_conseil` | 772 | Fonctionnel |
| `__blog_advice` | 85 | Fonctionnel (37% couverture gammes) |
| `__seo_reference` | 133 | Contenu squelettique |
| `__seo_observable` | 65 | Contenu squelettique |
| RAG gammes (markdown) | 230+ | Mine d'or inexploitee |
| RAG diagnostic (markdown) | ~20 | Arbres de decision riches |

---

## Phase P0 — Immediat (Fevrier 2026)

> **Objectif :** Chaque fix produit des DONNEES REELLES visibles immediatement.

### P0a : Fix SEO Hub Dashboard

**Probleme :** Le `SeoCockpitService` lit des tables vides.

**Solution :** Recrire 5 methodes pour lire les tables avec donnees.

| Fichier | Methode | Source actuelle (0 rows) | Nouvelle source |
|---------|---------|--------------------------|-----------------|
| `seo-cockpit.service.ts` | `getRiskStats()` | `__seo_entity_health` | `__seo_page` (321K) + `__seo_confusion_pairs` (124) |
| | `getCrawlStats()` | `__seo_crawl_log` | `__seo_crawl_hub` + `__seo_page.updated_at` |
| | `getConsolidatedAlerts()` | `__seo_entity_health` | `__seo_confusion_pairs` + gammes sans contenu |
| | `getUrlsAtRisk()` | `__seo_entity_health` | `__seo_confusion_pairs` + orphan pages |
| | `calculateHealthScore()` | totalUrls=0 -> 80% | totalUrls=321K -> ~95% |

**+ Middleware Googlebot** dans `main.ts` pour remplir `__seo_crawl_log` progressivement.

**Resultat attendu :**
- Dashboard affiche 321K URLs, health ~95%
- Content stats : 133 R4, 65 R5, 85 blog (deja fonctionnel)
- Alertes basees sur `__seo_confusion_pairs` (124 risques)

---

### P0b : Module Marketing (nouveau)

**Probleme :** Aucun suivi backlinks, pas de roadmap contenu.

**Solution :** Creer module complet avec donnees GSC jour 1.

**Migration SQL :** 6 tables `__marketing_*`
- `__marketing_campaigns` — Container campagnes
- `__marketing_backlinks` — Suivi backlinks individuels
- `__marketing_outreach` — Tracking prospection
- `__marketing_guest_posts` — Articles invites
- `__marketing_content_roadmap` — Planification contenu
- `__marketing_kpi_snapshots` — KPIs historiques

**Backend :** `backend/src/modules/marketing/`
- 3 controllers (dashboard, backlinks, content-roadmap)
- 4 services (data, dashboard, backlinks, content-roadmap)
- Endpoints : `/api/admin/marketing/*`

**Frontend :** 4 routes Remix
- `admin.marketing.tsx` — Layout
- `admin.marketing._index.tsx` — Dashboard
- `admin.marketing.backlinks.tsx` — Tracker
- `admin.marketing.content-roadmap.tsx` — Roadmap

**Seed data :**
- Import 124 backlinks GSC (5 CSV existants)
- Generation 145 items content roadmap (gammes sans article)
- Snapshot KPI initial (40 domaines referents, 37% couverture)

**Resultat attendu :**
- `/admin/marketing` affiche dashboard avec vrais chiffres
- Couverture contenu : 85/230 gammes = 37%
- Sidebar : item "Marketing" visible

---

### P0c : Fix V-Level (calcul reel)

**Probleme :** `gamme-vlevel.service.ts` ligne 50 = stub.

**Solution :** Implementer le calcul V-Level avec les donnees existantes.

**Algorithme :**
```
Pour chaque gamme :
  1. Recuperer keywords depuis __seo_keywords (7,164 rows)
  2. Recuperer trends depuis gamme_seo_metrics
  3. Classer : V1 (champion global) > V2 (#1/gamme) > V3 (#2-4) > V4 (pas de volume)
  4. Ecrire v_level dans __seo_keywords
```

**Fichier :** `backend/src/modules/admin/services/gamme-vlevel.service.ts`
- `recalculateVLevel(pgId)` — calcul par gamme
- `recalculateAllVLevels()` — batch toutes gammes (nouvelle methode)

**Resultat attendu :**
- 7,164 keywords classifies V1/V2/V3/V4
- Dashboard V-Level (`admin.v-level-status.tsx`) affiche stats reelles

---

### P0d : Enrichir generateurs R4/R5

**Probleme :** Templates basiques, champs critiques NULL.

**Solution :** Exploiter le corpus RAG pour enrichir.

**R4 References :**
- Lire `/opt/automecanik/rag/knowledge/gammes/{pg_alias}.md`
- Extraire : definition, role_mecanique, composition, confusions
- Cross-link avec R5 via `symptomes_associes[]`

**R5 Diagnostics :**
- Lire `/opt/automecanik/rag/knowledge/diagnostic/{part}.md`
- Extraire : symptomes, actions recommandees, couts
- Ajouter `dtc_codes[]` (mapping statique top 50 codes OBD-2)
- Etendre a toutes les gammes (pas juste 10 hardcodees)

**Fichiers :**
- `backend/src/modules/seo/services/reference.service.ts`
- `backend/src/modules/seo/services/diagnostic.service.ts`

**Resultat attendu :**
- R4 : 133 -> ~200+ references enrichies
- R5 : 65 -> ~200+ diagnostics avec dtc_codes, actions, couts
- Cross-links R4<->R5 fonctionnels

---

## Phase P1 — Court terme (Mars-Avril 2026)

### P1a : Scoring pages SEO

**Objectif :** Prioriser les pages par valeur business.

**Formule :**
```
page_priority = (trafic_potentiel x marge_gamme x dispo_stock) - (risque_duplication + cout_contenu)
```

**Sources :** `__seo_keywords` x `catalog_gamme` x `pieces_gamme`

**Fichier a creer :** `marketing-scoring.service.ts`

### P1b : Reputation / Avis

**Objectif :** Preuve sociale pour conversion.

**Actions :**
- Importer avis existants
- Afficher sur pages produit
- Schema.org AggregateRating

### P1c : Rank tracking (via GSC)

**Objectif :** Pages gagnantes/perdantes.

**Prerequis :** Configurer API Google Search Console (actuellement TODO dans le code).

### P1d : Google Trends API pour V-Level

**Objectif :** Enrichir V-Level avec trends reels (pas juste CSV statique).

**Prerequis :** Config pytrends ou Google Trends API.

---

## Phase P2 — Moyen terme (Mai-Aout 2026)

### P2a : Analytics dashboards

**Objectif :** KPI par levier marketing.

**Prerequis :** GA4 API connectee.

### P2b : Catalog feeds

**Objectif :** Google Shopping / Merchant Center.

**Actions :**
- Export produits format Google
- Gestion prix et stock
- Rich snippets Shopping

### P2c : RAG matrice vehicules

**Objectif :** Pages SEO vehicule x symptome x panne.

**Probleme actuel :** Seulement 2 fichiers (Renault, Clio).

**Besoin :** Collecter 50+ fiches vehicules avec :
- Marque / modele / generation / motorisation
- Pannes courantes par piece
- Symptomes associes
- Codes defaut OBD-2

**Impact :** Nouvelles pages SEO type `/vehicules/renault-clio-3-dci`

### P2d : SEO Monitoring reel

**Objectif :** Remplir les 30+ tables vides du module SEO monitoring.

**Actions :**
- Activer middleware Googlebot (P0, deviendra efficace avec du temps)
- Configurer workers pour peupler `__seo_entity_health`, `__seo_index_history`
- Connecter GSC API pour donnees indexation

---

## Phase P3 — Long terme (S2 2026+)

### P3a : CRM (email/SMS)

**Prerequis :** Outil externe choisi (Brevo, Mailchimp, etc.)

### P3b : Experiments (A/B tests)

**Prerequis :** Volume trafic suffisant pour significativite statistique.

### P3c : Automation (workflows)

**Prerequis :** Use cases concrets identifies.

---

## Architecture fichiers

```
backend/src/modules/
  admin/services/
    seo-cockpit.service.ts          # [P0a] Fix 5 methodes
    gamme-vlevel.service.ts         # [P0c] Fix V-Level calcul
  seo/services/
    reference.service.ts            # [P0d] Enrichir R4
    diagnostic.service.ts           # [P0d] Enrichir R5
  marketing/                        # [P0b] NOUVEAU
    marketing.module.ts
    interfaces/marketing.interfaces.ts
    controllers/ (3)
    services/ (4)

frontend/app/routes/
  admin.marketing.tsx               # [P0b] Layout
  admin.marketing._index.tsx        # [P0b] Dashboard
  admin.marketing.backlinks.tsx     # [P0b] Tracker
  admin.marketing.content-roadmap.tsx # [P0b] Roadmap

frontend/app/components/
  AdminSidebar.tsx                  # [P0b] + item Marketing
```

---

## KPIs de succes

### P0 (a verifier apres implementation)

| Test | Commande | Attendu |
|------|----------|---------|
| SEO Hub dashboard | `curl /api/admin/seo-cockpit/dashboard` | `totalUrls: 321838, healthScore: ~95` |
| SEO Hub summary | `curl /api/admin/seo-cockpit/summary` | `status: "HEALTHY"` |
| V-Level stats | `curl /api/admin/gammes-seo/v-level/global-stats` | `{ v1: N, v2: N, v3: N, v4: N }` |
| R4 references | `curl /api/seo/reference` | 133+ entries avec contenu riche |
| R5 diagnostics | `curl /api/seo/diagnostic/featured?limit=5` | entries avec dtc_codes, actions |
| Marketing backlinks | `SELECT count(*) FROM __marketing_backlinks` | ~124 |
| Marketing dashboard | `curl /api/admin/marketing/dashboard` | `{ success: true }` |
| Content coverage | `curl /api/admin/marketing/content-roadmap/coverage` | `{ coverage_pct: 37 }` |
| Sidebar | Visuel | Item "Marketing" visible |
| Lint | `npm run lint` | 0 erreurs |
| TypeCheck | `npm run typecheck` | 0 erreurs |

---

## Hors scope (raisons)

| Item | Raison du report |
|------|-----------------|
| RAG matrice vehicules | Necessite collecte manuelle de 50+ fiches vehicules |
| Google Trends API | Config API externe non faite |
| GSC API connector | TODO dans le code, config non faite |
| AI enrichment (Claude/OpenAI) | Les donnees RAG suffisent pour P0 |
| Prisma | Le projet utilise Supabase SDK, pas Prisma |
| Architecture 9 domaines | Reproduirait l'erreur des 30+ tables vides |
| n8n/webhooks | Infra externe non deployee |
| CRM segments RFM | Necessite outil externe + donnees clients |

---

## Historique des phases precedentes

| Phase | Periode | Status | Bilan |
|-------|---------|--------|-------|
| Phase 1 | 2025 Q1-Q3 | Complete | SEO programmatique, 321K pages, sitemaps V2 |
| Phase 2 | 2025 Q4 | Complete | Documentation 37 modules, 187+ endpoints |
| Phase 3 | 2025 Q4-2026 Q1 | Partielle | Tests infra pose mais coverage reste ~40% |
| **Phase 4 (actuelle)** | 2026 Q1 | En cours | Fix SEO + Marketing + V-Level + R4/R5 |
