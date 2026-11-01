---
title: Repository Map
kind: registry-index
generated_at: "1970-01-01T00:00:00.000Z"
source: audit/registry/canonical.json
source_sha256: a27f752224d6fd66c3e6c2ef639df28b09881e1d6485e2fe7ca80f2f86397901
schema_version: "1.0.0"
do_not_edit: true   # généré par scripts/registry/build-llm-repo-map.js (ADR-058 PR-F)
---

# Repository Map

> **LLM entrypoint** (ADR-058) : pour répondre à toute question « qui possède X » / « quel domaine » / « où vit Y », **lire ce fichier d'abord** puis fall-back grep si non couvert.

> **Source de vérité** = couple Layer 1 auto + Layer 2 overlay manuel. Ce fichier est une **projection canonique générée** depuis `audit/registry/canonical.json` — JAMAIS l'éditer à la main.

## Statistiques globales

| Layer | Count |
|---|---|
| Files (Layer 1) | 3110 |
| DB tables (Layer 1) | 316 |
| DB RPC (Layer 1) | 264 |
| Dependencies (Layer 1) | 237 |
| Runtime entrypoints (Layer 1) | 1017 |

Source sotFingerprint: `201ab5b17dc9`.

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

- **Files**: 164 (test=150, service=10, config=3, controller=1)
- **Runtime entrypoints**: 5
- **Top owners**: @ak125 (149), __unassigned__ (15)
- **Knowledge prose**: [`rm`](modules/rm.md)
- **Status**: LEGACY=7, LIVE=8, UNKNOWN=149

### D3 — SEO & Sitemap

- **Files**: 431 (service=220, test=123, controller=34, config=28, script=26)
- **Runtime entrypoints**: 169
- **Top owners**: @ak125/seo-team (431)
- **Knowledge prose**: [`merchant-center`](modules/merchant-center.md), [`seo`](modules/seo.md), [`seo-control-plane`](modules/seo-control-plane.md), [`seo-logs`](modules/seo-logs.md), [`seo-monitoring`](modules/seo-monitoring.md), [`seo-shadow-observatory`](modules/seo-shadow-observatory.md)
- **Status**: LIVE=222, UNKNOWN=209

### D4 — Vehicle / Compatibility

- **Files**: 117 (service=67, test=32, config=12, controller=6)
- **Runtime entrypoints**: 47
- **Top owners**: @ak125/vehicle-team (78), @ak125 (39)
- **Knowledge prose**: [`diagnostic-engine`](modules/diagnostic-engine.md), [`mcp-validation`](modules/mcp-validation.md), [`vehicle-context`](modules/vehicle-context.md), [`vehicles`](modules/vehicles.md)
- **Status**: LIVE=71, UNKNOWN=46

### D5 — Blog / Content

- **Files**: 45 (service=31, test=8, controller=6)
- **Runtime entrypoints**: 26
- **Top owners**: @ak125/content-team (45)
- **Knowledge prose**: [`blog`](modules/blog.md)
- **Status**: LIVE=33, UNKNOWN=12

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

- **Files**: 944 (config=454, route=246, service=182, controller=39, test=23)
- **Runtime entrypoints**: 349
- **Top owners**: @ak125/frontend-team (675), @ak125/admin-team (269)
- **Knowledge prose**: [`admin`](modules/admin.md), [`staff`](modules/staff.md)
- **Status**: LIVE=516, UNKNOWN=428

### D9 — Import / ETL / Normalisation

- **Files**: 18 (service=13, test=4, config=1)
- **Runtime entrypoints**: 8
- **Top owners**: @ak125 (18)
- **Status**: LIVE=9, UNKNOWN=9

### D10 — Quality, Monitoring & Observabilité

- **Files**: 43 (service=24, test=11, controller=7, config=1)
- **Runtime entrypoints**: 24
- **Top owners**: @ak125 (43)
- **Knowledge prose**: [`analytics`](modules/analytics.md), [`dashboard`](modules/dashboard.md), [`errors`](modules/errors.md), [`health`](modules/health.md), [`observability`](modules/observability.md)
- **Status**: LIVE=32, UNKNOWN=11

### D11 — Commerce & Users

- **Files**: 297 (service=192, test=64, controller=40, config=1)
- **Runtime entrypoints**: 130
- **Top owners**: @ak125 (128), @ak125/payments-team (82), @ak125/auth-team (75)
- **Knowledge prose**: [`cart`](modules/cart.md), [`invoices`](modules/invoices.md), [`messages`](modules/messages.md), [`orders`](modules/orders.md), [`payments`](modules/payments.md), [`support`](modules/support.md), [`users`](modules/users.md)
- **Status**: LIVE=180, UNKNOWN=117

### D12 — Marketing & Video

- **Files**: 82 (service=62, controller=12, config=5, test=3)
- **Runtime entrypoints**: 39
- **Top owners**: @ak125/marketing-team (82)
- **Knowledge prose**: [`commercial`](modules/commercial.md), [`marketing`](modules/marketing.md), [`promo`](modules/promo.md)
- **Status**: LIVE=53, UNKNOWN=29

### D13 — Config & System

- **Files**: 235 (script=79, service=71, config=54, test=31)
- **Runtime entrypoints**: 16
- **Top owners**: @ak125 (235)
- **Status**: LIVE=91, UNKNOWN=144

### D14 — Gamme Aggregates & V-Level

- **Files**: 33 (service=18, test=9, controller=4, config=2)
- **Runtime entrypoints**: 19
- **Top owners**: @ak125/seo-team (33)
- **Knowledge prose**: [`admin`](modules/admin.md), [`substitution`](modules/substitution.md)
- **Status**: LIVE=22, UNKNOWN=11

### D15 — Security & Governance

- **Files**: 294 (test=181, script=64, service=46, config=2, controller=1)
- **Runtime entrypoints**: 3
- **Top owners**: @ak125 (294)
- **Knowledge prose**: [`bot-guard`](modules/bot-guard.md)
- **Status**: LIVE=59, UNKNOWN=235

### D16 — Maintenance

- **Files**: 1 (service=1)
- **Runtime entrypoints**: 1
- **Top owners**: @ak125 (1)
- **Knowledge prose**: [`maintenance`](modules/maintenance.md)
- **Status**: LIVE=1

### UNKNOWN — Unknown (overlay non résolu)

- **Files**: 243 (service=149, config=57, controller=20, script=14, test=3)
- **DB tables**: 316
- **DB RPC**: 264
- **Runtime entrypoints**: 83
- **Top owners**: __unassigned__ (243)
- **Knowledge prose**: [`config`](modules/config.md), [`layout`](modules/layout.md), [`mcp-validation`](modules/mcp-validation.md), [`metadata`](modules/metadata.md), [`navigation`](modules/navigation.md), [`search`](modules/search.md), [`shipping`](modules/shipping.md), [`suppliers`](modules/suppliers.md), [`system`](modules/system.md)
- **Status**: LIVE=140, UNKNOWN=103

## Voir aussi

- [README.md](README.md) — index navigation knowledge
- [`audit/registry/canonical.json`](../../audit/registry/canonical.json) — SoT machine-readable
- [`.spec/00-canon/repository-registry/`](../../.spec/00-canon/repository-registry/) — Layer 2 overlay manuel
- ADR-058 (vault) — Repository Control Plane V1
