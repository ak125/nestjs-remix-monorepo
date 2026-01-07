---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - _bmad-output/project-context.md
  - .spec/00-canon/architecture.md
  - .spec/00-canon/rules.md
  - .spec/00-canon/repo-map.md
date: '2026-01-06'
author: 'Deploy'
project_name: 'automecanik'
status: 'COMPLETE'
---

# Product Brief: automecanik

## Step 1: Input Documents Summary

### Project Context (1 fichier)
- `_bmad-output/project-context.md` - Contexte projet pour agents IA

### Canon Documents (3 fichiers)
- `architecture.md` - Architecture technique NestJS/Remix/Supabase/Redis
- `rules.md` - 7 regles non-negociables du projet
- `repo-map.md` - Structure monorepo (40 modules, 158 routes, 9 packages)

### Feature Specifications (50 fichiers)
- Modules commerce: cart, orders, payments, promo, invoicing
- Modules catalogue: products, catalog, vehicles, gamme-rest
- Modules contenu: blog, seo, ai-content
- Modules infrastructure: auth, cache, config, health
- Modules AI-COS: knowledge-graph, rag-system, governance

### Project Docs (3 fichiers)
- `FIX-LEGACY-URLS-AND-CART.md`
- `SEO-MAILLAGE-INTERNE-RAPPORT.md`
- `SITEMAP-PROCEDURES.md`

---

## Step 2: Vision Produit

### Objectif Principal
Creer une **source de verite unique** et un **workflow BMAD fiable** pour aligner:

| Source | Etat Actuel | Cible |
|--------|-------------|-------|
| Monorepo NestJS + Remix + Supabase | Realite du code | Reference |
| Documentation .spec | Melange vrai/obsolete | Canon-only |
| AI-COS | Cahier des charges AI-driven | Executable |
| RAG | Hors sujet, non utilise | Aligne ou OFF |

### Resultat Attendu
Une execution **reproductible** avec:
- Artefacts versionnes (sha256 proofs)
- QA gates obligatoires
- Prevention de la derive documentaire
- Amelioration progressive sans casser la prod

---

## Step 3: Utilisateurs Cibles

### Utilisateur Primaire: Owner/CTO
- **Besoin**: Decider vite, eviter la confusion doc, reduire regressions
- **Douleur**: Docs contradictoires, RAG hors sujet, claims sans preuves
- **Valeur**: Vue consolidee, workflows fiables, metriques claires

### Utilisateur Secondaire: Dev/Agents IA (Claude Code, copilotes)
- **Besoin**: Suivre le canon, eviter l'obsolete
- **Douleur**: Docs obsoletes melangees avec docs valides
- **Valeur**: Canon-only policy, rejection automatique obsolete

### Utilisateur Tertiaire: Equipe Marketing/SEO
- **Besoin**: Utiliser outputs fiables (routes, SEO rules)
- **Douleur**: Outputs potentiellement incorrects ou obsoletes
- **Valeur**: Outputs read-only depuis source verifiee
- **Contrainte**: Ne pollue pas la source de verite technique

---

## Step 4: Metriques de Succes

| Metrique | Baseline | Target | Verification |
|----------|----------|--------|--------------|
| BMAD workflows utilisent canon uniquement | Unknown | **100%** | Audit workflow outputs |
| Claims "fait" sans preuves | Many | **0** | ls/head/sha256/diff obligatoires |
| RAG hallucinations en prod | Possible | **0** | Citations obligatoires |
| RAG status | ON (hors sujet) | **OFF** jusqu'a golden tests pass | Config gate |
| Regressions prod/dev (cache/config) | Baseline | **-50%** en 30 jours | Incident tracking |
| Temps PRD+ADR+plan avec BMAD | Unknown | **< 2h** | Workflow timing |

### Criteres de Validation RAG
- Score golden tests < seuil = RAG reste OFF
- 0 hallucination toleree en mode prod
- Citations obligatoires sur toutes reponses

---

## Step 5: Scope et Limites

### IN SCOPE (Phase Analyse)

| Tache | Deliverable | Effort |
|-------|-------------|--------|
| Audit + tri doc | `deprecation_ledger.md` | 2h |
| Generer project-context fiable | `project-context.md` updated | Done |
| Definir canon minimal + policies | `00-canon/governance-policy.md` | 1h |
| Diagnostiquer RAG hors sujet | `rag-alignment-research.md` | 2h |
| Mapper AI-COS -> backlog executable | Epics/Stories avec QA gates | 4h |

### OUT OF SCOPE (Phase Ulterieure)

| Tache | Raison | Phase |
|-------|--------|-------|
| Refactor complet du code | Hors phase analyse | Build |
| Migration DB majeure | Hors phase analyse | Build |
| Implementation RAG complete | Prep seulement, build apres gates | Build |

### Decision: Canon vs Obsolete
- **CANON** (15 fichiers): `.spec/00-canon/*` + docs L1/L2 verifies
- **OBSOLETE** (13 fichiers): `.spec/.archive/*`
- **NEEDS_REVIEW** (68 fichiers): Triage manuel avant inclusion RAG

---

## Step 6: Finalisation

### Priorite
> **Remettre de l'ordre et instaurer la gouvernance BMAD avant d'implementer**

### Contraintes Non-Negociables

| Contrainte | Verification |
|------------|--------------|
| Monorepo doit rester fonctionnel | `npm run dev` + health check |
| Aucune action ne deploie/impacte prod | 0 push main sans validation |
| RAG OFF jusqu'a golden tests pass | Config gate verifie |
| 0 claim sans preuves | Audit automatique outputs |

### Workflow Governance

```
[Canon 00-canon/] ← Source de verite unique
       ↓
[BMAD Workflow] → Artefacts versionnes (sha256)
       ↓
[QA Gate] → Pass/Fail avec preuves
       ↓
[Backlog Executable] → Epics/Stories
```

### Prochaines Etapes
1. Completer Technical Research RAG Alignment
2. Definir governance-policy.md dans 00-canon
3. Mapper AI-COS specs vers backlog executable
4. Creer golden test suite RAG
5. Activer RAG seulement apres 100% golden tests pass

---

_Product Brief complete - 2026-01-06_
_BMad Method v6.0.0-alpha.22_
