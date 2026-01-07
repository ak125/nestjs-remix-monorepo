# Deprecation Ledger

> **Generated**: 2026-01-06 | **Agent**: Doc Triage Agent

---

## Documents Obsoletes (13)

Ces documents sont remplaces par des versions plus recentes. Ne pas utiliser.

| Fichier | Remplace par | Action |
|---------|--------------|--------|
| `features/rag-system.md` | `features/rag-system-v3.md` | Archiver |
| `features/orchestrator-system.md` | `features/ai-cos-operating-system.md` | Archiver |
| `database/prisma-schema.md` | Supabase SDK direct | Supprimer |
| `database/services.md` | Code source actuel | Supprimer |
| `database/overview.md` | `database/supabase-schema.md` | Archiver |
| `database/cache-strategy.md` | `architecture/003-cache-redis-multi-levels.md` | Archiver |
| `workflows/speckit-analyze.md` | BMad workflows | Supprimer |
| `workflows/speckit-checklist.md` | BMad workflows | Supprimer |
| `workflows/speckit-clarify.md` | BMad workflows | Supprimer |
| `workflows/speckit-implement.md` | BMad workflows | Supprimer |
| `workflows/speckit-plan.md` | BMad workflows | Supprimer |
| `workflows/speckit-specify.md` | BMad workflows | Supprimer |
| `workflows/speckit-tasks.md` | BMad workflows | Supprimer |

---

## Documents Archives (18)

Valeur historique uniquement. Ne pas utiliser pour decisions actuelles.

| Fichier | Raison |
|---------|--------|
| `SESSION-SUMMARY.md` | Session passee |
| `PHASE-2-COMPLETION-SUMMARY.md` | Phase terminee |
| `reports/ANALYSE-APPROFONDIE.md` | Rapport ponctuel |
| `reports/CONSOLIDATION-COMPLETE.md` | Rapport termine |
| `reports/PROJECT-STATS.md` | Snapshot perime |
| `DOCUMENTATION-PACKAGE.md` | Package genere |
| `CRITICAL-MODULES-REPORT.md` | Rapport modules |
| `QUICK-WIN-SWAGGER-REPORT.md` | Rapport Swagger |
| `ARCHITECTURE-DIAGRAMS.md` | Diagrammes generes |
| `diagrams/C4-ARCHITECTURE.md` | Diagrammes C4 |
| `diagrams/SEQUENCE-DIAGRAMS.md` | Sequences |
| `docs/ARCHITECTURE-IMAGES.md` | Images arch |
| `docs/IMPLEMENTATION-SUMMARY.md` | Resume implementation |
| `docs/README.md` | Index docs |
| `docs/docs/api-reference.md` | Ref API generee |
| `docs/docs/getting-started.md` | Getting started |
| `docs/docs/intro.md` | Intro docs |
| `docs/docs/webhooks/overview.md` | Webhooks overview |

---

## Doublons potentiels

| Fichier A | Fichier B | Resolution |
|-----------|-----------|------------|
| `features/auth-system.md` | `features/auth-module.md` | A verifier |
| `features/product-catalog.md` | `features/catalog-module.md` | A verifier |
| `features/orders.md` | `features/order-management.md` | A verifier |

---

## Recommandations

1. **Supprimer** les 7 fichiers `speckit-*.md` (remplaces par BMad)
2. **Archiver** les 2 fichiers `prisma-*.md` (plus utilises)
3. **Fusionner** les doublons potentiels apres verification
4. **Deplacer** les archives vers `.spec/.archive/` si souhaite
