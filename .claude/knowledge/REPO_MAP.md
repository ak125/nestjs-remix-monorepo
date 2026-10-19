---
title: Repository Map
kind: registry-index
generated_at: "1970-01-01T00:00:00.000Z"
source: audit/registry/canonical.json
source_sha256: 7857ade7b22eb26e962e9fa9571b291c72a524d5663cea43116fba82144e7a1e
schema_version: "1.0.0"
do_not_edit: true   # généré par scripts/registry/build-llm-repo-map.js (ADR-058 PR-F)
---

# Repository Map

> **LLM entrypoint** (ADR-058) : pour répondre à toute question « qui possède X » / « quel domaine » / « où vit Y », **lire ce fichier d'abord** puis fall-back grep si non couvert.

> **Source de vérité** = couple Layer 1 auto + Layer 2 overlay manuel. Ce fichier est une **projection canonique générée** depuis `audit/registry/canonical.json` — JAMAIS l'éditer à la main.

## Statistiques globales

| Layer | Count |
|---|---|
| Files (Layer 1) | 3068 |
| DB tables (Layer 1) | 316 |
| DB RPC (Layer 1) | 259 |
| Dependencies (Layer 1) | 237 |
| Runtime entrypoints (Layer 1) | 1016 |

Source sotFingerprint: `d620d0164be5`.

## Comment l'utiliser

1. Identifier le **domaine** D1..D16 (voir ci-dessous)
2. Lire `audit/registry/canonical.json` pour la query précise (programmatique)
3. Lire `.claude/knowledge/modules/<module>.md` pour la prose détaillée
4. Fall-back grep si question hors registry

## Domaines (D1..D16 + UNKNOWN)

### D1 — Catalog Core

- **Files**: 85 (service=51, controller=21, test=9, config=4)
- **Runtime entrypoints**: 58
- **Top owners**: @ak125/catalog-team (85)
- **Knowledge prose**: [`catalog`](modules/catalog.md), [`gamme-rest`](modules/gamme-rest.md), [`products`](modules/products.md)
- **Status**: LIVE=73, UNKNOWN=12

### D2 — Legacy/XTR Migration

- **Files**: 155 (test=141, service=10, config=3, controller=1)
- **Runtime entrypoints**: 5
- **Top owners**: @ak125 (140), __unassigned__ (15)
- **Knowledge prose**: [`rm`](modules/rm.md)
- **Status**: LEGACY=7, LIVE=8, UNKNOWN=140

### D3 — SEO & Sitemap

- **Files**: 427 (service=219, test=120, controller=34, config=28, script=26)
- **Runtime entrypoints**: 169
- **Top owners**: @ak125/seo-team (427)
- **Knowledge prose**: [`merchant-center`](modules/merchant-center.md), [`seo`](modules/seo.md), [`seo-control-plane`](modules/seo-control-plane.md), [`seo-logs`](modules/seo-logs.md), [`seo-monitoring`](modules/seo-monitoring.md), [`seo-shadow-observatory`](modules/seo-shadow-observatory.md)
- **Status**: LIVE=220, UNKNOWN=207

### D4 — Vehicle / Compatibility

- **Files**: 117 (service=67, test=32, config=12, controller=6)
- **Runtime entrypoints**: 47
- **Top owners**: @ak125/vehicle-team (78), @ak125 (39)
- **Knowledge prose**: [`diagnostic-engine`](modules/diagnostic-engine.md), [`mcp-validation`](modules/mcp-validation.md), [`vehicle-context`](modules/vehicle-context.md), [`vehicles`](modules/vehicles.md)
- **Status**: LIVE=71, UNKNOWN=46

### D5 — Blog / Content

- **Files**: 40 (service=27, test=7, controller=6)
- **Runtime entrypoints**: 26
- **Top owners**: @ak125/content-team (40)
- **Knowledge prose**: [`blog`](modules/blog.md)
- **Status**: LIVE=33, UNKNOWN=7

### D6 — RAG & AI Engine

- **Files**: 72 (service=56, config=11, controller=5)
- **Runtime entrypoints**: 39
- **Top owners**: @ak125/rag-team (72)
- **Knowledge prose**: [`agentic-engine`](modules/agentic-engine.md), [`ai-content`](modules/ai-content.md), [`rag-knowledge-bootstrap`](modules/rag-knowledge-bootstrap.md), [`rag-proxy`](modules/rag-proxy.md), [`upload`](modules/upload.md)
- **Status**: LIVE=71, UNKNOWN=1

### D7 — Knowledge Graph & Diagnostic

- **Files**: 6 (service=4, controller=1, config=1)
- **Runtime entrypoints**: 1
- **Top owners**: @ak125 (6)
- **Knowledge prose**: [`knowledge-graph`](modules/knowledge-graph.md)
- **Status**: LIVE=5, UNKNOWN=1

### D8 — Read Model / Serving (RM)

- **Files**: 941 (config=454, route=246, service=181, controller=39, test=21)
- **Runtime entrypoints**: 349
- **Top owners**: @ak125/frontend-team (674), @ak125/admin-team (267)
- **Knowledge prose**: [`admin`](modules/admin.md), [`staff`](modules/staff.md)
- **Status**: LIVE=514, UNKNOWN=427

### D9 — Import / ETL / Normalisation

- **Files**: 18 (service=13, test=4, config=1)
- **Runtime entrypoints**: 8
- **Top owners**: @ak125 (18)
- **Status**: LIVE=9, UNKNOWN=9

### D10 — Quality, Monitoring & Observabilité

- **Files**: 42 (service=24, test=10, controller=7, config=1)
- **Runtime entrypoints**: 24
- **Top owners**: @ak125 (42)
- **Knowledge prose**: [`analytics`](modules/analytics.md), [`dashboard`](modules/dashboard.md), [`errors`](modules/errors.md), [`health`](modules/health.md), [`observability`](modules/observability.md)
- **Status**: LIVE=32, UNKNOWN=10

### D11 — Commerce & Users

- **Files**: 296 (service=191, test=64, controller=40, config=1)
- **Runtime entrypoints**: 129
- **Top owners**: @ak125 (128), @ak125/payments-team (82), @ak125/auth-team (74)
- **Knowledge prose**: [`cart`](modules/cart.md), [`invoices`](modules/invoices.md), [`messages`](modules/messages.md), [`orders`](modules/orders.md), [`payments`](modules/payments.md), [`support`](modules/support.md), [`users`](modules/users.md)
- **Status**: LIVE=178, UNKNOWN=118

### D12 — Marketing & Video

- **Files**: 79 (service=61, controller=12, config=5, test=1)
- **Runtime entrypoints**: 39
- **Top owners**: @ak125/marketing-team (79)
- **Knowledge prose**: [`commercial`](modules/commercial.md), [`marketing`](modules/marketing.md), [`promo`](modules/promo.md)
- **Status**: LIVE=53, UNKNOWN=26

### D13 — Config & System

- **Files**: 230 (script=76, service=70, config=54, test=30)
- **Runtime entrypoints**: 16
- **Top owners**: @ak125 (230)
- **Status**: LIVE=91, UNKNOWN=139

### D14 — Gamme Aggregates & V-Level

- **Files**: 33 (service=18, test=9, controller=4, config=2)
- **Runtime entrypoints**: 19
- **Top owners**: @ak125/seo-team (33)
- **Knowledge prose**: [`admin`](modules/admin.md), [`substitution`](modules/substitution.md)
- **Status**: LIVE=22, UNKNOWN=11

### D15 — Security & Governance

- **Files**: 283 (test=172, script=62, service=46, config=2, controller=1)
- **Runtime entrypoints**: 3
- **Top owners**: @ak125 (283)
- **Knowledge prose**: [`bot-guard`](modules/bot-guard.md)
- **Status**: LIVE=57, UNKNOWN=226

### D16 — Maintenance

- **Files**: 1 (service=1)
- **Runtime entrypoints**: 1
- **Top owners**: @ak125 (1)
- **Knowledge prose**: [`maintenance`](modules/maintenance.md)
- **Status**: LIVE=1

### UNKNOWN — Unknown (overlay non résolu)

- **Files**: 243 (service=149, config=57, controller=20, script=14, test=3)
- **DB tables**: 316
- **DB RPC**: 259
- **Runtime entrypoints**: 83
- **Top owners**: __unassigned__ (243)
- **Knowledge prose**: [`config`](modules/config.md), [`layout`](modules/layout.md), [`mcp-validation`](modules/mcp-validation.md), [`metadata`](modules/metadata.md), [`navigation`](modules/navigation.md), [`search`](modules/search.md), [`shipping`](modules/shipping.md), [`suppliers`](modules/suppliers.md), [`system`](modules/system.md)
- **Status**: LIVE=140, UNKNOWN=103

## Voir aussi

- [README.md](README.md) — index navigation knowledge
- [`audit/registry/canonical.json`](../../audit/registry/canonical.json) — SoT machine-readable
- [`.spec/00-canon/repository-registry/`](../../.spec/00-canon/repository-registry/) — Layer 2 overlay manuel
- ADR-058 (vault) — Repository Control Plane V1
