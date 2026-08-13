---
title: Repository Map
kind: registry-index
generated_at: "1970-01-01T00:00:00.000Z"
source: audit/registry/canonical.json
source_sha256: 4e60124336b239ae693c380add2c22c7af720a448c8688c6c39adb16eb4620dc
schema_version: "1.0.0"
do_not_edit: true   # généré par scripts/registry/build-llm-repo-map.js (ADR-058 PR-F)
---

# Repository Map

> **LLM entrypoint** (ADR-058) : pour répondre à toute question « qui possède X » / « quel domaine » / « où vit Y », **lire ce fichier d'abord** puis fall-back grep si non couvert.

> **Source de vérité** = couple Layer 1 auto + Layer 2 overlay manuel. Ce fichier est une **projection canonique générée** depuis `audit/registry/canonical.json` — JAMAIS l'éditer à la main.

## Statistiques globales

| Layer | Count |
|---|---|
| Files (Layer 1) | 2833 |
| DB tables (Layer 1) | 307 |
| DB RPC (Layer 1) | 258 |
| Dependencies (Layer 1) | 237 |
| Runtime entrypoints (Layer 1) | 515 |

Source sotFingerprint: `9e5044fa75b2`.

## Comment l'utiliser

1. Identifier le **domaine** D1..D15 (voir ci-dessous)
2. Lire `audit/registry/canonical.json` pour la query précise (programmatique)
3. Lire `.claude/knowledge/modules/<module>.md` pour la prose détaillée
4. Fall-back grep si question hors registry

## Domaines (D1..D15 + UNKNOWN)

### D1 — Catalog Core

- **Files**: 82 (service=51, controller=21, test=6, config=4)
- **Runtime entrypoints**: 24
- **Top owners**: @ak125/catalog-team (82)
- **Knowledge prose**: [`catalog`](modules/catalog.md), [`gamme-rest`](modules/gamme-rest.md), [`products`](modules/products.md)
- **Status**: LIVE=72, UNKNOWN=10

### D2 — Legacy / XTR Migration

- **Files**: 96 (test=82, service=10, config=3, controller=1)
- **Runtime entrypoints**: 1
- **Top owners**: @ak125 (84), __unassigned__ (12)
- **Knowledge prose**: [`rm`](modules/rm.md)
- **Status**: LEGACY=11, LIVE=1, UNKNOWN=84

### D3 — SEO & Sitemap

- **Files**: 409 (service=211, test=110, controller=34, config=28, script=26)
- **Runtime entrypoints**: 41
- **Top owners**: @ak125/seo-team (409)
- **Knowledge prose**: [`merchant-center`](modules/merchant-center.md), [`seo`](modules/seo.md), [`seo-control-plane`](modules/seo-control-plane.md), [`seo-logs`](modules/seo-logs.md), [`seo-monitoring`](modules/seo-monitoring.md), [`seo-shadow-observatory`](modules/seo-shadow-observatory.md)
- **Status**: LIVE=214, UNKNOWN=195

### D4 — Vehicle / Compatibility

- **Files**: 82 (service=60, test=9, config=8, controller=5)
- **Runtime entrypoints**: 8
- **Top owners**: @ak125/vehicle-team (43), @ak125 (39)
- **Knowledge prose**: [`diagnostic-engine`](modules/diagnostic-engine.md), [`vehicle-context`](modules/vehicle-context.md), [`vehicles`](modules/vehicles.md)
- **Status**: LIVE=59, UNKNOWN=23

### D5 — Blog / Content

- **Files**: 36 (service=26, controller=6, test=4)
- **Runtime entrypoints**: 7
- **Top owners**: @ak125/content-team (36)
- **Knowledge prose**: [`blog`](modules/blog.md)
- **Status**: LIVE=32, UNKNOWN=4

### D6 — RAG & AI Engine

- **Files**: 72 (service=56, config=11, controller=5)
- **Runtime entrypoints**: 8
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

- **Files**: 929 (config=467, route=246, service=169, controller=36, test=11)
- **Runtime entrypoints**: 282
- **Top owners**: @ak125/frontend-team (680), @ak125/admin-team (249)
- **Knowledge prose**: [`admin`](modules/admin.md)
- **Status**: LIVE=489, UNKNOWN=440

### D9 — Import / ETL / Normalisation

- **Files**: 14 (service=12, test=1, config=1)
- **Runtime entrypoints**: 2
- **Top owners**: @ak125 (14)
- **Status**: LIVE=9, UNKNOWN=5

### D10 — Quality, Monitoring & Observabilité

- **Files**: 23 (service=14, test=5, controller=4)
- **Runtime entrypoints**: 10
- **Top owners**: @ak125 (23)
- **Knowledge prose**: [`analytics`](modules/analytics.md), [`dashboard`](modules/dashboard.md), [`health`](modules/health.md), [`observability`](modules/observability.md)
- **Status**: LIVE=19, UNKNOWN=4

### D11 — Commerce & Users

- **Files**: 276 (service=184, test=51, controller=40, config=1)
- **Runtime entrypoints**: 51
- **Top owners**: @ak125 (115), @ak125/payments-team (77), @ak125/auth-team (72)
- **Knowledge prose**: [`cart`](modules/cart.md), [`invoices`](modules/invoices.md), [`messages`](modules/messages.md), [`orders`](modules/orders.md), [`payments`](modules/payments.md), [`support`](modules/support.md), [`users`](modules/users.md)
- **Status**: LIVE=175, UNKNOWN=101

### D12 — Marketing & Video

- **Files**: 75 (service=57, controller=12, config=5, test=1)
- **Runtime entrypoints**: 16
- **Top owners**: @ak125/marketing-team (75)
- **Knowledge prose**: [`commercial`](modules/commercial.md), [`marketing`](modules/marketing.md), [`promo`](modules/promo.md)
- **Status**: LIVE=53, UNKNOWN=22

### D13 — Config & System

- **Files**: 187 (service=70, config=52, script=48, test=17)
- **Runtime entrypoints**: 5
- **Top owners**: @ak125 (187)
- **Status**: LIVE=79, UNKNOWN=108

### D14 — Gamme Aggregates & V-Level

- **Files**: 24 (service=13, test=7, controller=3, config=1)
- **Runtime entrypoints**: 5
- **Top owners**: @ak125/seo-team (24)
- **Knowledge prose**: [`admin`](modules/admin.md)
- **Status**: LIVE=16, UNKNOWN=8

### D15 — Security & Governance

- **Files**: 243 (test=136, script=60, service=44, config=2, controller=1)
- **Runtime entrypoints**: 3
- **Top owners**: @ak125 (243)
- **Knowledge prose**: [`bot-guard`](modules/bot-guard.md)
- **Status**: LIVE=49, UNKNOWN=194

### UNKNOWN — Unknown (overlay non résolu)

- **Files**: 278 (service=169, config=60, controller=26, script=14, test=9)
- **DB tables**: 307
- **DB RPC**: 258
- **Runtime entrypoints**: 50
- **Top owners**: __unassigned__ (278)
- **Knowledge prose**: [`config`](modules/config.md), [`errors`](modules/errors.md), [`layout`](modules/layout.md), [`mcp-validation`](modules/mcp-validation.md), [`metadata`](modules/metadata.md), [`navigation`](modules/navigation.md), [`search`](modules/search.md), [`shipping`](modules/shipping.md), [`staff`](modules/staff.md), [`substitution`](modules/substitution.md), [`suppliers`](modules/suppliers.md), [`system`](modules/system.md)
- **Status**: LIVE=163, UNKNOWN=115

## Voir aussi

- [README.md](README.md) — index navigation knowledge
- [`audit/registry/canonical.json`](../../audit/registry/canonical.json) — SoT machine-readable
- [`.spec/00-canon/repository-registry/`](../../.spec/00-canon/repository-registry/) — Layer 2 overlay manuel
- ADR-058 (vault) — Repository Control Plane V1
