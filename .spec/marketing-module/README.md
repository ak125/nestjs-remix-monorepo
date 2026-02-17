# Module Marketing - Specification

> Mis a jour le 9 fevrier 2026 suite a l'audit Supabase MCP

## Vue d'ensemble

Module admin pour gerer les campagnes marketing, backlinks, outreach et planification de contenu SEO. Tourne en parallele avec le module SEO existant dans le dashboard admin.

## Audit backlinks (9 fevrier 2026)

### Profil actuel (source : GSC exports)

| Metrique | Valeur | Verdict |
|----------|--------|---------|
| Total backlinks | ~124 | Tres faible pour un e-commerce 4M+ produits |
| Domaines referents | ~40 | Insuffisant |
| Liens auto-references (.fr->.com) | 169 | A exclure du comptage reel |
| DA moyen | < 20 (estime) | Faible |
| Top source externe | sitelike.org (15 liens) | Annuaire automatique |

### Top domaines referents

| Domaine | Liens | Type |
|---------|-------|------|
| automecanik.fr | 169 | Self (.fr -> .com) |
| sitelike.org | 15 | Annuaire auto |
| nosfavoris.com | 12 | Annuaire |
| forum-auto.caradisiac.com | 4 | Forum auto |
| oscaro.com | 3 | Concurrent |
| impactpubs.com | 3 | Media |

### Top pages ciblees

| Page | Liens entrants |
|------|---------------|
| Homepage `/` | 64 |
| `/pieces/courroie-d-accessoire` | 7 |
| `/pieces/poulie-vilebrequin` | 6 |
| `/pieces/filtre-a-huile` | 5 |

### Diagnostic

- **Forces :** Quelques liens depuis forums auto (caradisiac) = pertinence thematique
- **Faiblesses :** Majorite de liens auto-references ou annuaires faible DA
- **Opportunites :** 145 gammes sans article blog = potentiel linkbait enorme
- **Menaces :** Profil trop faible pour competir sur mots-cles concurrentiels

## Index des specs

| Document | Contenu |
|----------|---------|
| [database-schema.md](database-schema.md) | Schema des 6 tables `__marketing_*` |
| [backend-architecture.md](backend-architecture.md) | Module NestJS, controllers, services, endpoints API |
| [frontend-routes.md](frontend-routes.md) | Routes admin MVP, sidebar, composants UI |
| [implementation-plan.md](implementation-plan.md) | Phases, agent teams, sequencing, verification |

## Scope MVP (P0b)

3 pages admin :
1. **Dashboard** (`/admin/marketing`) - KPIs, metriques, vue d'ensemble
2. **Backlinks** (`/admin/marketing/backlinks`) - Tracker + import CSV GSC
3. **Content Roadmap** (`/admin/marketing/content-roadmap`) - Couverture 230 gammes, planification

## Scope P1/P2 (plus tard)

- Campagnes (`/admin/marketing/campaigns`)
- Outreach (`/admin/marketing/outreach`)
- Guest Posts (`/admin/marketing/guest-posts`)
- Scoring pages (trafic x marge x stock)

## Liens avec l'existant

| Module existant | Table | Rows | Integration |
|----------------|-------|------|-------------|
| Blog | `__blog_advice` | 85 | `content_roadmap.blog_advice_id` FK |
| SEO Observable (R5) | `__seo_observable` | 65 | `content_roadmap.seo_observable_id` FK |
| SEO Reference (R4) | `__seo_reference` | 133 | `content_roadmap.seo_reference_id` FK |
| Gammes | `pieces_gamme` | 230 | `content_roadmap.pg_id` FK |
| Purchase Guides | `__seo_gamme_purchase_guide` | 221 | Cross-table coverage |
| Conseils | `__seo_gamme_conseil` | 772 | Cross-table coverage |
| Pages SEO | `__seo_page` | 321,838 | Validation URLs backlinks |

## Coverage contenu (etat fevrier 2026)

| Type contenu | Gammes couvertes | Total gammes | Couverture |
|-------------|------------------|-------------|-----------|
| Blog (advice) | 85 | 230 | 37% |
| Purchase Guide | 221 | 230 | 96% |
| Reference (R4) | ~133 | 230 | ~58% |
| Diagnostic (R5) | ~65 | 230 | ~28% |
| **Global** | | | **~37%** |

## Donnees sources

- GSC exports : `automecanik.com-Top linking sites-2026-02-08.csv` et 4 autres CSV
- RAG gammes : `/opt/automecanik/rag/knowledge/gammes/` (230+ fichiers)
- RAG diagnostic : `/opt/automecanik/rag/knowledge/diagnostic/`
