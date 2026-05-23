---
name: web-vitals-audit
description: Use when investigating INP/LCP/CLS regressions on Remix routes — detects shared-component reflow, eager-loaded Radix, hydration cost, below-fold blocks without content-visibility, CWV ingestion gaps. Triggers — "INP élevé sur X", "audit web-vitals", "root cause LCP/CLS". Strictly scoped to Core Web Vitals root-cause ; does NOT cover Lighthouse, SEO global, WCAG, bundle size, image optimization.
type: technique
status: experimental
owners: ['@ak125']
domain: D3
runtime_class: read-only
llm_safe: true
last_verified: '2026-05-23'
license: Internal - Automecanik
compatibility: Claude Code in the AutoMecanik monorepo. Reads frontend/app/** + audit/registry/canonical.json + __seo_cwv_daily. No mutations.
allowed-tools: Read Grep Glob Bash
tags: [audit, web-vitals, frontend, performance, inp, lcp, cls, remix]
metadata:
  version: "0.1"
  argument-hint: "[check-name or 'all']"
  spec: agentskills.io/specification v1
---

# Web Vitals Audit

Audit **root-cause INP/LCP/CLS** uniquement. Scope strictement borné aux
Core Web Vitals — ce skill ne devient PAS un "SEO frontend mega analyzer".

**Origine** : PRs #692/#694 ont diagnostiqué et corrigé l'INP 537 ms mobile
`/pieces/` causé par (a) l'ouverture du Sheet menu hamburger forçant reflow
document (~1250 nœuds) et (b) blocs below-fold sans `content-visibility:
auto`. Sans audit déterministe, ce type de cause racine se trouve par
instrumentation web-vitals + Playwright + analyse manuelle.

## Quand proposer ce skill

- Triggers utilisateur : "INP élevé sur X", "LCP régression sur Y", "CLS
  shifted blocks", "root cause web-vitals"
- Après alerte CrUX / RUM / `__seo_cwv_daily` sur une route P0
- Avant un audit responsive (`responsive-audit` couvre touch targets / WCAG,
  pas la root-cause CWV)

## Scope STRICTEMENT borné

### Inclus uniquement
- INP root-cause (interaction → next paint)
- LCP root-cause (largest contentful paint)
- CLS root-cause (cumulative layout shift)
- Reflow forcé par composants UI partagés (header, sheet, dialog, drawer)
- Hydration patterns coûteux (props serializable lourde, useState init)
- Blocs below-fold sans `content-visibility: auto` (cause #694)
- Composants Radix lourds eager-loaded en route (cause indirecte INP)
- Gap ingestion `__seo_cwv_daily` (la stack existe-t-elle vraiment ?)

### EXCLUS explicitement
- ❌ Lighthouse complet (déjà couvert par `responsive-audit` + CI
  Lighthouse PREPROD `.github/workflows/lighthouse-preprod.yml`)
- ❌ SEO global, meta-tags, canonical URLs (couvert par `seo-gamme-audit`)
- ❌ Accessibility WCAG, touch targets 44×44 (couvert par `responsive-audit`)
- ❌ Bundle size analyzer (chantier séparé)
- ❌ Image optimization (chantier séparé)

Si une demande utilisateur dépasse ce scope, **rediriger vers le skill
existant** plutôt qu'étendre `web-vitals-audit`.

## Architecture atomique (6 checks)

```
.claude/skills/web-vitals-audit/
  SKILL.md                            # ce fichier (orchestration)
  checks/
    inp-shared-component-reflow.md    # cause #692 (Sheet reflow document)
    inp-eager-radix.md                # composants Radix eager-loaded
    lcp-route-hydration.md            # init useState coûteux dans route
    cls-shifted-blocks.md             # absence aspect-ratio / fixed dim
    content-visibility-gap.md         # cause #694 (below-fold non cv:auto)
    cwv-ingestion-gap.md              # __seo_cwv_daily vide alors que stack existe
```

**Un check = une responsabilité** (≤ 100 lignes).

## Sources de vérité

| Source | Usage |
|---|---|
| `audit/registry/canonical.json` | files frontend, routes Remix |
| `frontend/app/components/**` | composants partagés (Sheet, Dialog) |
| `frontend/app/routes/**` | eager imports, hydration cost |
| `__seo_cwv_daily` via supabase MCP | ingestion CWV réelle |
| `web-vitals` library calls grep | attribution wired? |
| CrUX API / Sentry / GA4 | gap d'ingestion runtime (V2) |

**Interdit** : Lighthouse en ligne, audit visuel pur, grep aveugle.

## Métadonnées par check

Identique à `runtime-truth-audit` : `severity` (taxonomie INP/LCP/CLS),
`confidence`, `expected_false_positive_rate`, `autofixable: false`
strict V1, `incidents_proven:` OU `risk_documented:`.

### Taxonomie severity pour CWV

- `critical` : INP > 500ms sur route P0 | LCP > 4s mobile | CLS > 0.25
- `high` : INP 300-500ms | LCP 2.5-4s | CLS 0.10-0.25
- `medium` : pattern qui dégradera CWV sous charge mais pas mesuré encore
- `low` : optimisation incrémentale

## Procédure (orchestrateur)

1. "audit web-vitals sur /pieces" → exécuter les 6 checks sur la route
   ciblée + ses composants partagés.
2. "INP élevé global" → exécuter `inp-*` checks + `cwv-ingestion-gap`.
3. Format sortie : rapport markdown structuré par metric (INP/LCP/CLS) +
   liste de root-causes priorisées par severity.
4. **Pas d'auto-fix**. Suggérer le patch (ex: `cv: auto` sur block X) en
   description du finding.

## Garde-fous

Si un check tente de devenir "mega analyzer" (audit perf globale,
bundle stats, profiling React), **le retirer**. Le scope CWV est non
négociable.

## Règle d'admission d'un nouveau check

Identique à `runtime-truth-audit` :
1. `incidents_proven:` OU `risk_documented:`
2. `severity:` cite la taxonomie CWV
3. `expected_false_positive_rate:` cohérent
4. `autofixable: false` (V1 stricte)
5. ≤ 100 lignes, 1 responsabilité
6. Pas de duplication avec `responsive-audit` (WCAG/mobile)
   ni Lighthouse CI

## Mémoires liées

- `project_inp_pieces_root_cause_20260522.md` — méthodo Playwright+CDP
  réutilisable
- `feedback_cwv_rum_stack_already_exists.md` — gap ingestion documenté
- `feedback_no_blind_trust_gsc_first_detection_date.md` — distinguer
  date détection cohorte vs date régression code
