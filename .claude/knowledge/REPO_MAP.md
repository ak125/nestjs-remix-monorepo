---
title: Repository Map
kind: registry-index
generated_at: "1970-01-01T00:00:00.000Z"
source: audit/registry/canonical.json
source_sha256: cad0d0e9044f6ccfdb852c4970d073cb7959296b8852b9f3a8a035dc083b77c9
schema_version: "1.0.0"
do_not_edit: true   # généré par scripts/registry/build-llm-repo-map.js (ADR-058 PR-F)
---

# Repository Map

> **LLM entrypoint** (ADR-058) : pour répondre à toute question « qui possède X » / « quel domaine » / « où vit Y », **lire ce fichier d'abord** puis fall-back grep si non couvert.

> **Source de vérité** = couple Layer 1 auto + Layer 2 overlay manuel. Ce fichier est une **projection canonique générée** depuis `audit/registry/canonical.json` — JAMAIS l'éditer à la main.

## Statistiques globales

| Layer | Count |
|---|---|
| Files (Layer 1) | 2131 |
| DB tables (Layer 1) | 232 |
| DB RPC (Layer 1) | 180 |
| Dependencies (Layer 1) | 232 |
| Runtime entrypoints (Layer 1) | 470 |

Source sotFingerprint: `b5a155efe459`.

## Comment l'utiliser

1. Identifier le **domaine** D1..D15 (voir ci-dessous)
2. Lire `audit/registry/canonical.json` pour la query précise (programmatique)
3. Lire `.claude/knowledge/modules/<module>.md` pour la prose détaillée
4. Fall-back grep si question hors registry

## Domaines (D1..D15 + UNKNOWN)

### D1 — Catalog Core

- **Files**: 76 (service=49, controller=21, config=4, test=2)
- **Runtime entrypoints**: 24
- **Top owners**: @ak125/catalog-team (76)
- **Knowledge prose**: [`catalog`](modules/catalog.md), [`gamme-rest`](modules/gamme-rest.md), [`products`](modules/products.md)
- **Status**: LIVE=57, UNKNOWN=19

### D2 — Legacy / XTR Migration

- **Files**: 5 (service=2, controller=1, config=1, test=1)
- **Runtime entrypoints**: 1
- **Top owners**: __unassigned__ (5)
- **Knowledge prose**: [`rm`](modules/rm.md)
- **Status**: LEGACY=4, LIVE=1

### D3 — SEO & Sitemap

- **Files**: 206 (service=132, test=36, controller=25, config=13)
- **Runtime entrypoints**: 27
- **Top owners**: @ak125/seo-team (206)
- **Knowledge prose**: [`seo`](modules/seo.md), [`seo-logs`](modules/seo-logs.md)
- **Status**: LIVE=104, UNKNOWN=102

### D4 — Vehicle / Compatibility

- **Files**: 17 (service=12, config=4, controller=1)
- **Runtime entrypoints**: 2
- **Top owners**: @ak125/vehicle-team (17)
- **Knowledge prose**: [`diagnostic-engine`](modules/diagnostic-engine.md)
- **Status**: LIVE=12, UNKNOWN=5

### D5 — Blog / Content

- **Files**: 34 (service=26, controller=7, test=1)
- **Runtime entrypoints**: 8
- **Top owners**: @ak125/content-team (34)
- **Knowledge prose**: [`blog`](modules/blog.md), [`blog-metadata`](modules/blog-metadata.md)
- **Status**: LIVE=26, UNKNOWN=8

### D6 — RAG & AI Engine

- **Files**: 72 (service=56, config=12, controller=4)
- **Runtime entrypoints**: 7
- **Top owners**: @ak125/rag-team (72)
- **Knowledge prose**: [`agentic-engine`](modules/agentic-engine.md), [`ai-content`](modules/ai-content.md), [`rag-proxy`](modules/rag-proxy.md)
- **Status**: LIVE=40, UNKNOWN=32

### D7 — Knowledge Graph & Diagnostic

- **Files**: 6 (service=4, controller=1, config=1)
- **Runtime entrypoints**: 1
- **Top owners**: @ak125 (6)
- **Knowledge prose**: [`knowledge-graph`](modules/knowledge-graph.md)
- **Status**: LIVE=1, UNKNOWN=5

### D8 — Read Model / Serving (RM)

- **Files**: 802 (config=441, route=240, service=82, controller=36, test=3)
- **Runtime entrypoints**: 275
- **Top owners**: @ak125/frontend-team (585), @ak125/admin-team (217)
- **Knowledge prose**: [`admin`](modules/admin.md)
- **Status**: LIVE=328, UNKNOWN=474

### D10 — Quality, Monitoring & Observabilité

- **Files**: 9 (service=7, controller=2)
- **Runtime entrypoints**: 6
- **Top owners**: @ak125 (9)
- **Knowledge prose**: [`analytics`](modules/analytics.md), [`dashboard`](modules/dashboard.md), [`health`](modules/health.md)
- **Status**: LIVE=9

### D11 — Commerce & Users

- **Files**: 138 (service=104, controller=30, test=3, config=1)
- **Runtime entrypoints**: 36
- **Top owners**: @ak125/payments-team (71), @ak125/auth-team (59), @ak125 (8)
- **Knowledge prose**: [`cart`](modules/cart.md), [`invoices`](modules/invoices.md), [`messages`](modules/messages.md), [`orders`](modules/orders.md), [`payments`](modules/payments.md), [`users`](modules/users.md)
- **Status**: LIVE=77, UNKNOWN=61

### D12 — Marketing & Video

- **Files**: 31 (service=21, controller=8, test=1, config=1)
- **Runtime entrypoints**: 11
- **Top owners**: @ak125/marketing-team (31)
- **Knowledge prose**: [`commercial`](modules/commercial.md), [`marketing`](modules/marketing.md), [`promo`](modules/promo.md)
- **Status**: LIVE=24, UNKNOWN=7

### D13 — Config & System

- **Files**: 139 (config=49, service=45, script=39, test=6)
- **Runtime entrypoints**: 4
- **Top owners**: @ak125 (139)
- **Status**: LIVE=15, UNKNOWN=124

### D15 — Security & Governance

- **Files**: 32 (service=19, script=8, test=5)
- **Top owners**: @ak125 (32)
- **Status**: LIVE=2, UNKNOWN=30

### UNKNOWN — Unknown (overlay non résolu)

- **Files**: 564 (service=318, config=112, test=72, controller=41, script=21)
- **DB tables**: 232
- **DB RPC**: 180
- **Runtime entrypoints**: 68
- **Top owners**: __unassigned__ (564)
- **Knowledge prose**: [`bot-guard`](modules/bot-guard.md), [`config`](modules/config.md), [`errors`](modules/errors.md), [`layout`](modules/layout.md), [`mcp-validation`](modules/mcp-validation.md), [`metadata`](modules/metadata.md), [`navigation`](modules/navigation.md), [`search`](modules/search.md), [`shipping`](modules/shipping.md), [`staff`](modules/staff.md), [`substitution`](modules/substitution.md), [`suppliers`](modules/suppliers.md), [`support`](modules/support.md), [`system`](modules/system.md), [`upload`](modules/upload.md), [`vehicles`](modules/vehicles.md)
- **Status**: LIVE=158, UNKNOWN=406

## Voir aussi

- [README.md](README.md) — index navigation knowledge
- [`audit/registry/canonical.json`](../../audit/registry/canonical.json) — SoT machine-readable
- [`.spec/00-canon/repository-registry/`](../../.spec/00-canon/repository-registry/) — Layer 2 overlay manuel
- ADR-058 (vault) — Repository Control Plane V1
