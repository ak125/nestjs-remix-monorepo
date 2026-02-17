---
title: "Audit SEO & Marketing - Fevrier 2026"
status: complete
version: 1.0.0
created: 2026-02-09
method: MCP Supabase (projet cxpojprgwgubzjyqzmoq)
tags: [audit, seo, marketing, supabase, database]
---

# Audit SEO & Marketing — 9 Fevrier 2026

> Audit complet realise via MCP Supabase sur le projet de production.

---

## 1. Inventaire tables SEO

### Tables avec donnees (56 tables)

| Table | Rows | Role |
|-------|------|------|
| `__seo_page` | **321,838** | Pages auto-generees (coeur du SEO) |
| `__seo_keywords` | **7,164** | Keywords par gamme |
| `__seo_gamme_conseil` | 772 | Conseils par gamme |
| `__seo_gamme_purchase_guide` | 221 | Guides d'achat |
| `__seo_sitemap_url` | 189 | URLs sitemap |
| `__seo_reference` | 133 | Definitions R4 |
| `__seo_confusion_pairs` | 124 | Paires de confusion (risques) |
| `__seo_observable` | 65 | Diagnostics R5 |
| `__blog_advice` | 85 | Articles blog |
| `__blog_guide` | 1 | Guides |

### Tables vides (30+ tables a 0 rows)

| Table | Role prevu | Probleme |
|-------|-----------|----------|
| `__seo_entity_health` | Sante SEO par entite | Aucun worker ne la peuple |
| `__seo_crawl_log` | Logs Googlebot/Bingbot | Middleware absent dans main.ts |
| `__seo_index_history` | Historique indexation | Pas de source de donnees |
| `__seo_interpolation_alerts` | Alertes interpolation | Service non connecte |
| `__seo_internal_link` | Graphe liens internes | Worker non implemente |
| `__seo_audit_log` | Historique audit | Aucun evenement emis |
| `__seo_entity_score_v10` | Scores SEO | Worker non implemente |
| ... et ~23 autres | Monitoring divers | Infrastructure sans donnees |

### Cause racine

**Le module SEO a ete construit "top-down" :** architecture complete (86 tables, 38 services, 16 controllers) mais les workers/middleware qui devaient peupler les tables de monitoring n'ont jamais ete implementes.

**Consequence :** Le SEO Hub dashboard affiche des zeros partout alors que `__seo_page` contient 321K pages.

---

## 2. Analyse SeoCockpitService

**Fichier :** `backend/src/modules/admin/services/seo-cockpit.service.ts` (590 lignes)

### Methodes et leurs sources

| Methode | Lit table | Rows | Retourne |
|---------|-----------|------|----------|
| `getRiskStats()` | `__seo_entity_health` | 0 | totalUrls=0, urlsAtRisk=0 |
| `getCrawlStats()` | `__seo_crawl_log` | 0 | last24h=0, googlebotAbsent=true |
| `getConsolidatedAlerts()` | `__seo_interpolation_alerts` + `__seo_entity_health` | 0+0 | [] |
| `getUrlsAtRisk()` | `__seo_entity_health` | 0 | [] |
| `getContentStats()` | `__seo_reference` + `__seo_observable` + `__blog_advice` | 133+65+85 | **FONCTIONNE** |
| `calculateHealthScore()` | Depend de getRiskStats | totalUrls=0 | 80% (100 - 20 pour googlebotAbsent) |

### Dependances injectees

- `SeoMonitorSchedulerService` — planificateur (jamais execute)
- `RiskFlagsEngineService` — moteur de risques (table source vide)
- `GooglebotDetectorService` — detecteur (logCrawl existe mais middleware absent)
- `GammeSeoAuditService` — audit gammes (fonctionnel)

---

## 3. Analyse V-Level

**Fichier :** `backend/src/modules/admin/services/gamme-vlevel.service.ts`

### Status : STUB

```typescript
// Ligne 50 — Le coeur du probleme
/**
 * Recalcule les V-Level pour une gamme
 * Pour l'instant: met a jour updated_at pour marquer comme recalcule
 * TODO: Integrer le vrai pipeline de calcul V-Level
 */
async recalculateVLevel(pgId: number) {
  // ONLY updates timestamp — NO ACTUAL CALCULATION
  const { data, error } = await this.supabase
    .from('gamme_seo_metrics')
    .update({ updated_at: new Date().toISOString() })
    .eq('gamme_id', pgId.toString())
    .select('id');
}
```

### Pipeline documente mais non implemente

- **Phase 1 (Collection)** : Google Trends + GSC — non implemente
- **Phase 2 (Calcul)** : Aggregate scores, classify V1-V4 — non implemente
- **Phase 3 (API)** : Endpoints — partiellement implemente (UI existe, backend = stub)

### Donnees disponibles pour V-Level sans API externe

- `__seo_keywords` : 7,164 rows avec keyword, gamme, search_volume
- `gammes_editable.csv` : Trends scores deja collectes (dans `/rag/knowledge/seo-data/`)
- `gamme_seo_metrics` : Table existante pour stocker resultats

---

## 4. Analyse R4 References / R5 Diagnostics

### R4 References (133 entries)

**Fichier :** `backend/src/modules/seo/services/reference.service.ts`

| Champ | Status | Probleme |
|-------|--------|----------|
| `title` | Rempli | "Qu'est-ce qu'un {gamme.label} ?" |
| `definition` | Placeholder | Utilise gamme.description sans enrichissement |
| `role_mecanique` | Placeholder | Texte generique |
| `composition[]` | VIDE | Generateur ignore ce champ |
| `confusions_courantes[]` | VIDE | Generateur ignore ce champ |
| `symptomes_associes[]` | VIDE | Pas de cross-link R5 |
| `related_references[]` | VIDE | Pas de liaison R4<->R4 |

**Pilote "filtre-a-huile"** (migration 20260201) montre le contenu riche attendu. Le generateur ne produit que du squelette.

### R5 Diagnostics (65 entries)

**Fichier :** `backend/src/modules/seo/services/diagnostic.service.ts`

| Champ | Status | Probleme |
|-------|--------|----------|
| `symptom_description` | Rempli | Template basique |
| `sign_description` | Rempli | Template basique |
| `dtc_codes[]` | NULL | Generateur hardcode null |
| `recommended_actions` | NULL | Generateur ignore ce champ |
| `estimated_repair_cost_min/max` | NULL | Pas de donnees couts |
| `related_references[]` | VIDE | Pas de cross-link R4 |

**Templates :** 5 types (bruit, vibration, voyant, odeur, fuite) x 10 gammes hardcodees.

**Corpus RAG inexploite :** `/rag/knowledge/gammes/` (230+ fichiers) et `/rag/knowledge/diagnostic/` contiennent toutes les donnees necessaires pour enrichir.

---

## 5. Analyse Backlinks

### Source : 5 CSV exports Google Search Console (8 fevrier 2026)

| Fichier | Contenu |
|---------|---------|
| `Top linking sites` | 40 domaines referents |
| `Top target pages` | Pages les plus liees |
| `Top linking text` | Textes d'ancrage |
| `More sample links` | ~124 liens individuels |

### Diagnostic

| Categorie | Nombre | % |
|-----------|--------|---|
| Auto-references (.fr -> .com) | ~169 | 58% |
| Annuaires automatiques | ~27 | 9% |
| Forums auto (caradisiac, etc.) | ~8 | 3% |
| Liens edito/media | ~6 | 2% |
| Autres (directories, blogs) | ~80 | 28% |

**Verdict :** Profil de backlinks tres faible. DA moyen < 20. La majorite des liens sont auto-references ou annuaires automatiques. Pour un e-commerce avec 4M+ produits, c'est le maillon le plus faible.

---

## 6. Analyse RAG

### Corpus gammes

- **Location :** `/opt/automecanik/rag/knowledge/gammes/`
- **Fichiers :** 230+ fichiers markdown
- **Contenu par fichier :** description, role mecanique, quand remplacer, symptomes, confusions
- **Status :** Bien structure, inexploite par les generateurs R4/R5

### Corpus diagnostic

- **Location :** `/opt/automecanik/rag/knowledge/diagnostic/`
- **Fichiers :** ~20 fichiers (alternateur, freinage, embrayage, etc.)
- **Contenu :** Arbres de diagnostic, symptomes, actions recommandees, confusion matrix
- **Status :** Riche mais non connecte aux services R5

### Corpus vehicules

- **Location :** `/opt/automecanik/rag/knowledge/vehicles/`
- **Fichiers :** 2 seulement (renault.md, renault-clio.md)
- **Status :** Insuffisant pour une matrice vehicule/symptome/panne

### Infrastructure RAG

- **Vector Store :** Weaviate (non inclus dans Docker principal)
- **Embeddings :** all-MiniLM-L6-v2 (384 dims, local)
- **LLM :** Claude 3.5 Sonnet
- **Retrieval :** Hybrid (70% vector + 30% BM25)
- **Status :** Fonctionnel mais independant du module SEO

---

## 7. Coverage contenu par gamme

### Croisement catalog_gamme x contenu

| Contenu | Gammes couvertes | Total | % |
|---------|------------------|-------|---|
| Blog advice | 85 | 230 | 37% |
| Purchase guide | 221 | 230 | 96% |
| Reference R4 | ~133 | 230 | ~58% |
| Diagnostic R5 | ~65 | 230 | ~28% |
| Conseil | ~131 | 230 | ~57% |

### Gap : 145 gammes sans article blog

Ces gammes representent un potentiel SEO enorme : chaque article blog = une page indexee supplementaire + potentiel linkbait.

---

## 8. Recommandations

### Priorite 1 (Immediat)

1. **Rewirer le SEO Hub** — Faire lire `__seo_page` (321K) au lieu de tables vides
2. **Creer module Marketing** — Tracker backlinks + roadmap contenu avec donnees GSC
3. **Implementer V-Level** — Calculer V1-V4 avec `__seo_keywords` existantes
4. **Enrichir R4/R5** — Utiliser corpus RAG pour remplir champs vides

### Priorite 2 (Court terme)

5. **Ajouter middleware Googlebot** — Remplir `__seo_crawl_log` progressivement
6. **Scoring pages** — Cross-table trafic x marge x stock
7. **Configurer GSC API** — Remplacer les TODO dans le code

### Priorite 3 (Moyen terme)

8. **RAG vehicules** — Collecter 50+ fiches vehicules
9. **SEO monitoring complet** — Peupler les 30+ tables vides
10. **Analytics GA4** — Connecter API pour KPIs

---

## Methodologie audit

- **Outil :** MCP Supabase (execute_sql + apply_migration)
- **Projet :** `cxpojprgwgubzjyqzmoq`
- **Region :** eu-west-3
- **Date :** 9 fevrier 2026
- **Scope :** Tables SEO (86), Blog (10+), Catalogue, RAG filesystem
- **Validation :** Cross-reference code source backend (services, controllers) avec donnees SQL
