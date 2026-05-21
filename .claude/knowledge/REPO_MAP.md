---
title: Repository Map
kind: registry-index
generated_at: "1970-01-01T00:00:00.000Z"
source: audit/registry/canonical.json
source_sha256: ca3196450b39b88eb4a222ae0a7620b58a2f370c74e6494fca88b6edef2f3ed2
schema_version: "1.0.0"
do_not_edit: true   # généré par scripts/registry/build-llm-repo-map.js (ADR-058 PR-F)
---

# Repository Map

> **LLM entrypoint** (ADR-058) : pour répondre à toute question « qui possède X » / « quel domaine » / « où vit Y », **lire ce fichier d'abord** puis fall-back grep si non couvert.

> **Source de vérité** = couple Layer 1 auto + Layer 2 overlay manuel. Ce fichier est une **projection canonique générée** depuis `audit/registry/canonical.json` — JAMAIS l'éditer à la main.

## Statistiques globales

| Layer | Count |
|---|---|
| Files (Layer 1) | 2413 |
| DB tables (Layer 1) | 257 |
| DB RPC (Layer 1) | 197 |
| Dependencies (Layer 1) | 252 |
| Runtime entrypoints (Layer 1) | 487 |

Source sotFingerprint: `5410879af648`.

## Comment l'utiliser

1. Identifier le **domaine** D1..D15 (voir ci-dessous)
2. Lire `audit/registry/canonical.json` pour la query précise (programmatique)
3. Lire `.claude/knowledge/modules/<module>.md` pour la prose détaillée
4. Fall-back grep si question hors registry

## Domaines (D1..D15 + UNKNOWN)

### D1 — Catalog Core

- **Files**: 79 (service=50, controller=21, test=4, config=4)
- **Runtime entrypoints**: 24
- **Top owners**: @ak125/catalog-team (79)
- **Knowledge prose**: [`catalog`](modules/catalog.md), [`gamme-rest`](modules/gamme-rest.md), [`products`](modules/products.md)
- **Status**: LIVE=71, UNKNOWN=8

### D2 — Legacy / XTR Migration

- **Files**: 41 (test=29, service=9, config=2, controller=1)
- **Runtime entrypoints**: 1
- **Top owners**: @ak125 (30), __unassigned__ (11)
- **Knowledge prose**: [`rm`](modules/rm.md)
- **Status**: LEGACY=10, LIVE=1, UNKNOWN=30

### D3 — SEO & Sitemap

- **Files**: 329 (service=181, test=82, controller=30, config=26, script=10)
- **Runtime entrypoints**: 35
- **Top owners**: @ak125/seo-team (329)
- **Knowledge prose**: [`seo`](modules/seo.md), [`seo-logs`](modules/seo-logs.md)
- **Status**: LIVE=188, UNKNOWN=141

### D4 — Vehicle / Compatibility

- **Files**: 34 (service=24, config=5, test=4, controller=1)
- **Runtime entrypoints**: 3
- **Top owners**: @ak125/vehicle-team (25), @ak125 (9)
- **Knowledge prose**: [`diagnostic-engine`](modules/diagnostic-engine.md)
- **Status**: LIVE=22, UNKNOWN=12

### D5 — Blog / Content

- **Files**: 34 (service=26, controller=7, test=1)
- **Runtime entrypoints**: 8
- **Top owners**: @ak125/content-team (34)
- **Knowledge prose**: [`blog`](modules/blog.md), [`blog-metadata`](modules/blog-metadata.md)
- **Status**: LIVE=33, UNKNOWN=1

### D6 — RAG & AI Engine

- **Files**: 72 (service=56, config=12, controller=4)
- **Runtime entrypoints**: 7
- **Top owners**: @ak125/rag-team (72)
- **Knowledge prose**: [`agentic-engine`](modules/agentic-engine.md), [`ai-content`](modules/ai-content.md), [`rag-proxy`](modules/rag-proxy.md)
- **Status**: LIVE=70, UNKNOWN=2

### D7 — Knowledge Graph & Diagnostic

- **Files**: 6 (service=4, controller=1, config=1)
- **Runtime entrypoints**: 1
- **Top owners**: @ak125 (6)
- **Knowledge prose**: [`knowledge-graph`](modules/knowledge-graph.md)
- **Status**: LIVE=5, UNKNOWN=1

### D8 — Read Model / Serving (RM)

- **Files**: 868 (config=451, route=242, service=136, controller=36, test=3)
- **Runtime entrypoints**: 277
- **Top owners**: @ak125/frontend-team (645), @ak125/admin-team (223)
- **Knowledge prose**: [`admin`](modules/admin.md)
- **Status**: LIVE=464, UNKNOWN=404

### D9 — Import / ETL / Normalisation

- **Files**: 11 (service=10, config=1)
- **Runtime entrypoints**: 2
- **Top owners**: @ak125 (11)
- **Status**: LIVE=11

### D10 — Quality, Monitoring & Observabilité

- **Files**: 22 (service=15, test=4, controller=3)
- **Runtime entrypoints**: 8
- **Top owners**: @ak125 (22)
- **Knowledge prose**: [`analytics`](modules/analytics.md), [`dashboard`](modules/dashboard.md), [`health`](modules/health.md)
- **Status**: LIVE=18, UNKNOWN=4

### D11 — Commerce & Users

- **Files**: 148 (service=109, controller=30, test=8, config=1)
- **Runtime entrypoints**: 36
- **Top owners**: @ak125/payments-team (71), @ak125/auth-team (69), @ak125 (8)
- **Knowledge prose**: [`cart`](modules/cart.md), [`invoices`](modules/invoices.md), [`messages`](modules/messages.md), [`orders`](modules/orders.md), [`payments`](modules/payments.md), [`users`](modules/users.md)
- **Status**: LIVE=112, UNKNOWN=36

### D12 — Marketing & Video

- **Files**: 31 (service=21, controller=8, test=1, config=1)
- **Runtime entrypoints**: 11
- **Top owners**: @ak125/marketing-team (31)
- **Knowledge prose**: [`commercial`](modules/commercial.md), [`marketing`](modules/marketing.md), [`promo`](modules/promo.md)
- **Status**: LIVE=28, UNKNOWN=3

### D13 — Config & System

- **Files**: 153 (service=54, config=51, script=37, test=11)
- **Runtime entrypoints**: 5
- **Top owners**: @ak125 (153)
- **Status**: LIVE=62, UNKNOWN=91

### D14 — Gamme Aggregates & V-Level

- **Files**: 4 (controller=2, service=2)
- **Runtime entrypoints**: 2
- **Top owners**: @ak125/seo-team (4)
- **Knowledge prose**: [`admin`](modules/admin.md)
- **Status**: LIVE=4

### D15 — Security & Governance

- **Files**: 162 (test=82, service=39, script=39, config=2)
- **Top owners**: @ak125 (162)
- **Status**: LIVE=30, UNKNOWN=132

### UNKNOWN — Unknown (overlay non résolu)

- **Files**: 418 (service=255, config=94, controller=42, script=21, test=6)
- **DB tables**: 257
- **DB RPC**: 197
- **Runtime entrypoints**: 66
- **Top owners**: __unassigned__ (418)
- **Knowledge prose**: [`bot-guard`](modules/bot-guard.md), [`config`](modules/config.md), [`errors`](modules/errors.md), [`layout`](modules/layout.md), [`mcp-validation`](modules/mcp-validation.md), [`metadata`](modules/metadata.md), [`navigation`](modules/navigation.md), [`search`](modules/search.md), [`shipping`](modules/shipping.md), [`staff`](modules/staff.md), [`substitution`](modules/substitution.md), [`suppliers`](modules/suppliers.md), [`support`](modules/support.md), [`system`](modules/system.md), [`upload`](modules/upload.md), [`vehicles`](modules/vehicles.md)
- **Status**: LIVE=238, UNKNOWN=180

## Voir aussi

- [README.md](README.md) — index navigation knowledge
- [`audit/registry/canonical.json`](../../audit/registry/canonical.json) — SoT machine-readable
- [`.spec/00-canon/repository-registry/`](../../.spec/00-canon/repository-registry/) — Layer 2 overlay manuel
- ADR-058 (vault) — Repository Control Plane V1
