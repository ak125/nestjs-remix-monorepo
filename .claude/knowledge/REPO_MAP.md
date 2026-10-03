---
title: Repository Map
kind: registry-index
generated_at: "1970-01-01T00:00:00.000Z"
source: audit/registry/canonical.json
source_sha256: d3306d7ea05ba1675491700057ad50831dfda904a8744fdf52a53a2f17e42de6
schema_version: "1.0.0"
do_not_edit: true   # généré par scripts/registry/build-llm-repo-map.js (ADR-058 PR-F)
---

# Repository Map

> **LLM entrypoint** (ADR-058) : pour répondre à toute question « qui possède X » / « quel domaine » / « où vit Y », **lire ce fichier d'abord** puis fall-back grep si non couvert.

> **Source de vérité** = couple Layer 1 auto + Layer 2 overlay manuel. Ce fichier est une **projection canonique générée** depuis `audit/registry/canonical.json` — JAMAIS l'éditer à la main.

## Statistiques globales

| Layer | Count |
|---|---|
| Files (Layer 1) | 2994 |
| DB tables (Layer 1) | 313 |
| DB RPC (Layer 1) | 255 |
| Dependencies (Layer 1) | 237 |
| Runtime entrypoints (Layer 1) | 1000 |

Source sotFingerprint: `372b9fce5e95`.

## Comment l'utiliser

1. Identifier le **domaine** D1..D15 (voir ci-dessous)
2. Lire `audit/registry/canonical.json` pour la query précise (programmatique)
3. Lire `.claude/knowledge/modules/<module>.md` pour la prose détaillée
4. Fall-back grep si question hors registry

## Domaines (D1..D15 + UNKNOWN)

### D1 — Catalog Core

- **Files**: 84 (service=51, controller=21, test=8, config=4)
- **Runtime entrypoints**: 58
- **Top owners**: @ak125/catalog-team (84)
- **Knowledge prose**: [`catalog`](modules/catalog.md), [`gamme-rest`](modules/gamme-rest.md), [`products`](modules/products.md)
- **Status**: LIVE=72, UNKNOWN=12

### D2 — Legacy / XTR Migration

- **Files**: 138 (test=124, service=10, config=3, controller=1)
- **Runtime entrypoints**: 1
- **Top owners**: @ak125 (123), __unassigned__ (15)
- **Knowledge prose**: [`rm`](modules/rm.md)
- **Status**: LEGACY=14, LIVE=1, UNKNOWN=123

### D3 — SEO & Sitemap

- **Files**: 427 (service=219, test=120, controller=34, config=28, script=26)
- **Runtime entrypoints**: 169
- **Top owners**: @ak125/seo-team (427)
- **Knowledge prose**: [`merchant-center`](modules/merchant-center.md), [`seo`](modules/seo.md), [`seo-control-plane`](modules/seo-control-plane.md), [`seo-logs`](modules/seo-logs.md), [`seo-monitoring`](modules/seo-monitoring.md), [`seo-shadow-observatory`](modules/seo-shadow-observatory.md)
- **Status**: LIVE=220, UNKNOWN=207

### D4 — Vehicle / Compatibility

- **Files**: 95 (service=60, test=19, config=11, controller=5)
- **Runtime entrypoints**: 41
- **Top owners**: @ak125/vehicle-team (56), @ak125 (39)
- **Knowledge prose**: [`diagnostic-engine`](modules/diagnostic-engine.md), [`mcp-validation`](modules/mcp-validation.md), [`vehicle-context`](modules/vehicle-context.md), [`vehicles`](modules/vehicles.md)
- **Status**: LIVE=62, UNKNOWN=33

### D5 — Blog / Content

- **Files**: 38 (service=26, controller=6, test=6)
- **Runtime entrypoints**: 26
- **Top owners**: @ak125/content-team (38)
- **Knowledge prose**: [`blog`](modules/blog.md)
- **Status**: LIVE=32, UNKNOWN=6

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

- **Files**: 947 (config=466, route=246, service=176, controller=38, test=21)
- **Runtime entrypoints**: 347
- **Top owners**: @ak125/frontend-team (686), @ak125/admin-team (261)
- **Knowledge prose**: [`admin`](modules/admin.md), [`staff`](modules/staff.md)
- **Status**: LIVE=498, UNKNOWN=449

### D9 — Import / ETL / Normalisation

- **Files**: 16 (service=12, test=3, config=1)
- **Runtime entrypoints**: 8
- **Top owners**: @ak125 (16)
- **Status**: LIVE=9, UNKNOWN=7

### D10 — Quality, Monitoring & Observabilité

- **Files**: 35 (service=20, test=8, controller=7)
- **Runtime entrypoints**: 22
- **Top owners**: @ak125 (35)
- **Knowledge prose**: [`analytics`](modules/analytics.md), [`dashboard`](modules/dashboard.md), [`errors`](modules/errors.md), [`health`](modules/health.md), [`observability`](modules/observability.md)
- **Status**: LIVE=27, UNKNOWN=8

### D11 — Commerce & Users

- **Files**: 285 (service=186, test=58, controller=40, config=1)
- **Runtime entrypoints**: 128
- **Top owners**: @ak125 (117), @ak125/payments-team (82), @ak125/auth-team (74)
- **Knowledge prose**: [`cart`](modules/cart.md), [`invoices`](modules/invoices.md), [`messages`](modules/messages.md), [`orders`](modules/orders.md), [`payments`](modules/payments.md), [`support`](modules/support.md), [`users`](modules/users.md)
- **Status**: LIVE=177, UNKNOWN=108

### D12 — Marketing & Video

- **Files**: 79 (service=61, controller=12, config=5, test=1)
- **Runtime entrypoints**: 39
- **Top owners**: @ak125/marketing-team (79)
- **Knowledge prose**: [`commercial`](modules/commercial.md), [`marketing`](modules/marketing.md), [`promo`](modules/promo.md)
- **Status**: LIVE=53, UNKNOWN=26

### D13 — Config & System

- **Files**: 225 (script=74, service=70, config=54, test=27)
- **Runtime entrypoints**: 15
- **Top owners**: @ak125 (225)
- **Status**: LIVE=90, UNKNOWN=135

### D14 — Gamme Aggregates & V-Level

- **Files**: 31 (service=17, test=8, controller=4, config=2)
- **Runtime entrypoints**: 19
- **Top owners**: @ak125/seo-team (31)
- **Knowledge prose**: [`admin`](modules/admin.md), [`substitution`](modules/substitution.md)
- **Status**: LIVE=22, UNKNOWN=9

### D15 — Security & Governance

- **Files**: 271 (test=161, script=62, service=45, config=2, controller=1)
- **Runtime entrypoints**: 3
- **Top owners**: @ak125 (271)
- **Knowledge prose**: [`bot-guard`](modules/bot-guard.md)
- **Status**: LIVE=56, UNKNOWN=215

### UNKNOWN — Unknown (overlay non résolu)

- **Files**: 244 (service=150, config=57, controller=20, script=14, test=3)
- **DB tables**: 313
- **DB RPC**: 255
- **Runtime entrypoints**: 83
- **Top owners**: __unassigned__ (244)
- **Knowledge prose**: [`config`](modules/config.md), [`layout`](modules/layout.md), [`mcp-validation`](modules/mcp-validation.md), [`metadata`](modules/metadata.md), [`navigation`](modules/navigation.md), [`search`](modules/search.md), [`shipping`](modules/shipping.md), [`suppliers`](modules/suppliers.md), [`system`](modules/system.md)
- **Status**: LIVE=140, UNKNOWN=104

## Voir aussi

- [README.md](README.md) — index navigation knowledge
- [`audit/registry/canonical.json`](../../audit/registry/canonical.json) — SoT machine-readable
- [`.spec/00-canon/repository-registry/`](../../.spec/00-canon/repository-registry/) — Layer 2 overlay manuel
- ADR-058 (vault) — Repository Control Plane V1
