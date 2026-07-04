---
title: Repository Map
kind: registry-index
generated_at: "1970-01-01T00:00:00.000Z"
source: audit/registry/canonical.json
source_sha256: 59b7601b4647f87c45cf98419d564590a65331ffdfe8e67c0c050f55b5607565
schema_version: "1.0.0"
do_not_edit: true   # généré par scripts/registry/build-llm-repo-map.js (ADR-058 PR-F)
---

# Repository Map

> **LLM entrypoint** (ADR-058) : pour répondre à toute question « qui possède X » / « quel domaine » / « où vit Y », **lire ce fichier d'abord** puis fall-back grep si non couvert.

> **Source de vérité** = couple Layer 1 auto + Layer 2 overlay manuel. Ce fichier est une **projection canonique générée** depuis `audit/registry/canonical.json` — JAMAIS l'éditer à la main.

## Statistiques globales

| Layer | Count |
|---|---|
| Files (Layer 1) | 2792 |
| DB tables (Layer 1) | 308 |
| DB RPC (Layer 1) | 253 |
| Dependencies (Layer 1) | 237 |
| Runtime entrypoints (Layer 1) | 512 |

Source sotFingerprint: `10ef40d83ad1`.

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

- **Files**: 79 (test=65, service=10, config=3, controller=1)
- **Runtime entrypoints**: 1
- **Top owners**: @ak125 (67), __unassigned__ (12)
- **Knowledge prose**: [`rm`](modules/rm.md)
- **Status**: LEGACY=11, LIVE=1, UNKNOWN=67

### D3 — SEO & Sitemap

- **Files**: 408 (service=211, test=109, controller=34, config=28, script=26)
- **Runtime entrypoints**: 41
- **Top owners**: @ak125/seo-team (408)
- **Knowledge prose**: [`merchant-center`](modules/merchant-center.md), [`seo`](modules/seo.md), [`seo-control-plane`](modules/seo-control-plane.md), [`seo-logs`](modules/seo-logs.md), [`seo-monitoring`](modules/seo-monitoring.md), [`seo-shadow-observatory`](modules/seo-shadow-observatory.md)
- **Status**: LIVE=214, UNKNOWN=194

### D4 — Vehicle / Compatibility

- **Files**: 82 (service=60, test=9, config=8, controller=5)
- **Runtime entrypoints**: 8
- **Top owners**: @ak125/vehicle-team (43), @ak125 (39)
- **Knowledge prose**: [`diagnostic-engine`](modules/diagnostic-engine.md), [`vehicle-context`](modules/vehicle-context.md), [`vehicles`](modules/vehicles.md)
- **Status**: LIVE=59, UNKNOWN=23

### D5 — Blog / Content

- **Files**: 34 (service=25, controller=6, test=3)
- **Runtime entrypoints**: 7
- **Top owners**: @ak125/content-team (34)
- **Knowledge prose**: [`blog`](modules/blog.md)
- **Status**: LIVE=31, UNKNOWN=3

### D6 — RAG & AI Engine

- **Files**: 82 (service=65, config=12, controller=5)
- **Runtime entrypoints**: 8
- **Top owners**: @ak125/rag-team (82)
- **Knowledge prose**: [`agentic-engine`](modules/agentic-engine.md), [`ai-content`](modules/ai-content.md), [`rag-knowledge-bootstrap`](modules/rag-knowledge-bootstrap.md), [`rag-proxy`](modules/rag-proxy.md), [`upload`](modules/upload.md)
- **Status**: LIVE=71, UNKNOWN=11

### D7 — Knowledge Graph & Diagnostic

- **Files**: 6 (service=4, controller=1, config=1)
- **Runtime entrypoints**: 1
- **Top owners**: @ak125 (6)
- **Knowledge prose**: [`knowledge-graph`](modules/knowledge-graph.md)
- **Status**: LIVE=5, UNKNOWN=1

### D8 — Read Model / Serving (RM)

- **Files**: 930 (config=467, route=246, service=170, controller=36, test=11)
- **Runtime entrypoints**: 282
- **Top owners**: @ak125/frontend-team (677), @ak125/admin-team (253)
- **Knowledge prose**: [`admin`](modules/admin.md)
- **Status**: LIVE=492, UNKNOWN=438

### D9 — Import / ETL / Normalisation

- **Files**: 14 (service=12, test=1, config=1)
- **Runtime entrypoints**: 2
- **Top owners**: @ak125 (14)
- **Status**: LIVE=9, UNKNOWN=5

### D10 — Quality, Monitoring & Observabilité

- **Files**: 22 (service=15, test=4, controller=3)
- **Runtime entrypoints**: 8
- **Top owners**: @ak125 (22)
- **Knowledge prose**: [`analytics`](modules/analytics.md), [`dashboard`](modules/dashboard.md), [`health`](modules/health.md), [`observability`](modules/observability.md)
- **Status**: LIVE=18, UNKNOWN=4

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

- **Files**: 181 (service=70, config=52, script=42, test=17)
- **Runtime entrypoints**: 5
- **Top owners**: @ak125 (181)
- **Status**: LIVE=74, UNKNOWN=107

### D14 — Gamme Aggregates & V-Level

- **Files**: 16 (service=9, controller=3, test=3, config=1)
- **Runtime entrypoints**: 4
- **Top owners**: @ak125/seo-team (16)
- **Knowledge prose**: [`admin`](modules/admin.md)
- **Status**: LIVE=13, UNKNOWN=3

### D15 — Security & Governance

- **Files**: 230 (test=128, script=55, service=44, config=2, controller=1)
- **Runtime entrypoints**: 3
- **Top owners**: @ak125 (230)
- **Knowledge prose**: [`bot-guard`](modules/bot-guard.md)
- **Status**: LIVE=39, UNKNOWN=191

### UNKNOWN — Unknown (overlay non résolu)

- **Files**: 274 (service=169, config=60, controller=26, script=14, test=5)
- **DB tables**: 308
- **DB RPC**: 253
- **Runtime entrypoints**: 50
- **Top owners**: __unassigned__ (274)
- **Knowledge prose**: [`config`](modules/config.md), [`errors`](modules/errors.md), [`layout`](modules/layout.md), [`mcp-validation`](modules/mcp-validation.md), [`metadata`](modules/metadata.md), [`navigation`](modules/navigation.md), [`search`](modules/search.md), [`shipping`](modules/shipping.md), [`staff`](modules/staff.md), [`substitution`](modules/substitution.md), [`suppliers`](modules/suppliers.md), [`system`](modules/system.md)
- **Status**: LIVE=164, UNKNOWN=110

## Voir aussi

- [README.md](README.md) — index navigation knowledge
- [`audit/registry/canonical.json`](../../audit/registry/canonical.json) — SoT machine-readable
- [`.spec/00-canon/repository-registry/`](../../.spec/00-canon/repository-registry/) — Layer 2 overlay manuel
- ADR-058 (vault) — Repository Control Plane V1
