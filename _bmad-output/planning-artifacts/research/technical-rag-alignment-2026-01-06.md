---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowType: 'research'
research_type: 'technical'
research_topic: 'RAG alignment for NestJS + Remix + Supabase monorepo'
user_name: 'Deploy'
date: '2026-01-06'
web_research_enabled: false
source_verification: true
status: 'COMPLETE'
---

# Technical Research: RAG Alignment for NestJS + Remix + Supabase Monorepo

**Date:** 2026-01-06
**Author:** Deploy
**Research Type:** Technical
**Confidence Level:** HIGH (based on codebase analysis)

---

## Executive Summary

Ce document analyse les strategies d'alignement RAG pour prevenir les reponses hors-sujet dans un monorepo NestJS + Remix + Supabase. L'analyse couvre 6 piliers: corpus scoping, metadata filters, reranking, refusal-first policies, golden query evaluation, et doc canonization.

**Finding Principal:** Le systeme RAG est implemente a 65-70% mais **non actif** car `RagProxyModule` n'est pas importe dans `app.module.ts`. Cette isolation constitue une protection de fait.

---

## Table of Contents

1. [Etat Actuel du Systeme RAG](#1-etat-actuel-du-systeme-rag)
2. [Corpus Scoping Strategy](#2-corpus-scoping-strategy)
3. [Metadata Filters](#3-metadata-filters)
4. [Reranking Strategy](#4-reranking-strategy)
5. [Refusal-First Policy](#5-refusal-first-policy)
6. [Golden Query Evaluation](#6-golden-query-evaluation)
7. [Doc Canonization Strategy](#7-doc-canonization-strategy)
8. [Recommendations](#8-recommendations)
9. [Assumptions & Open Questions](#9-assumptions--open-questions)

---

## 1. Etat Actuel du Systeme RAG

### Architecture

```
NestJS Backend (Port 3000)
    ↓ (RagProxyModule - NOT IMPORTED)
RAG Service (Port 8000 - Python FastAPI)
    ↓
Weaviate Vector DB (Port 8080)
    ↓
Knowledge Corpus (15 docs)
```

### Fichiers Cles

| Composant | Fichier | Status |
|-----------|---------|--------|
| Proxy Controller | `backend/src/modules/rag-proxy/rag-proxy.controller.ts` | EXISTS |
| Proxy Service | `backend/src/modules/rag-proxy/rag-proxy.service.ts` | EXISTS |
| Proxy Module | `backend/src/modules/rag-proxy/rag-proxy.module.ts` | EXISTS |
| App Module | `backend/src/app.module.ts` | **NO IMPORT** |
| RAG Service | `/opt/automecanik/rag/app/` | OPERATIONAL |
| Corpus | `/opt/automecanik/rag/knowledge/` | 15 docs |

### Blockers Identifies

1. **CRITIQUE:** `RagProxyModule` non importe dans `app.module.ts`
   - Ligne ~160: Liste des imports ne contient pas RagProxyModule
   - Consequence: Endpoints `/api/rag/*` inexistants

2. **Frontend:** Pas de ChatWidget Remix

3. **Pipeline:** LangGraph incomplet (194 lignes vs ~500 necessaires)

---

## 2. Corpus Scoping Strategy

### Implementation Actuelle

Le namespace guard est **hardcode** dans le service RAG Python:

```python
# /opt/automecanik/rag/app/services/namespace_guard.py
KNOWLEDGE_NAMESPACES = [
    "knowledge:vehicle",
    "knowledge:diagnostic",
    "knowledge:faq",
    "knowledge:seo",
    "knowledge:guide",
    "knowledge:policy",
]

PROD_CHATBOT_NAMESPACE = "knowledge:faq"  # HARDCODE - PROD only
```

### Analyse

| Aspect | Valeur | Evaluation |
|--------|--------|------------|
| Namespaces definis | 6 | OK |
| Namespace PROD | `knowledge:faq` uniquement | SECURISE |
| Modifiable runtime | Non (hardcode) | SECURISE |
| Docs dans `faq/` | 4 | LIMITE mais safe |

### Gap

Le corpus a 15 docs repartis sur 5 categories, mais seul `knowledge:faq` (4 docs) est accessible en PROD.

### Recommendation

**Maintenir le hardcode** - c'est une securite deliberee. Pour elargir le scope PROD:
1. Ajouter docs verifies (L1/L2) dans `knowledge/faq/`
2. OU modifier `PROD_CHATBOT_NAMESPACE` dans le code (apres validation)

---

## 3. Metadata Filters

### Implementation Actuelle

Les DTOs supportent les filtres metadata:

```typescript
// backend/src/modules/rag-proxy/dto/search.dto.ts
export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional().default(5),
  filters: z.record(z.string()).optional(), // ← Metadata filters
  namespace: z.string().optional(),
});
```

### Champs Filtables

Basé sur l'analyse du corpus (`knowledge/faq/livraison.md`):

```yaml
---
title: "FAQ - Livraison"
source_type: faq
category: livraison
truth_level: L1        # ← CRITIQUE pour filtering
verification_status: verified
updated_at: 2026-01-01
---
```

| Champ | Usage | Disponibilite |
|-------|-------|---------------|
| `source_type` | Filter par type (faq, guide, policy) | 100% docs |
| `category` | Filter par domaine | 100% docs |
| `truth_level` | Filter par niveau verite | ~67% docs |
| `verification_status` | Filter par validation | ~60% docs |

### Gap

- 33% des docs manquent `truth_level`
- 40% des docs manquent `verification_status`

### Recommendation

1. Ajouter frontmatter manquant a tous les docs corpus
2. Rejeter indexation si `truth_level` absent
3. Implementer filter automatique `truth_level IN (L1, L2)` en PROD

---

## 4. Reranking Strategy

### Implementation Actuelle

Weaviate utilise hybrid search (BM25 + vectoriel) mais **pas de reranking post-retrieval**.

### Algorithme Propose

```python
def rerank_by_truth_level(results):
    """Rerank results by truth level weight"""
    WEIGHTS = {
        "L1": 1.0,   # Faits verifies
        "L2": 0.9,   # Regles metier
        "L3": 0.6,   # Hypotheses
        "L4": 0.4,   # Heuristiques
    }

    for result in results:
        truth_level = result.metadata.get("truth_level", "L3")
        original_score = result.score
        result.final_score = original_score * WEIGHTS.get(truth_level, 0.5)

    return sorted(results, key=lambda x: x.final_score, reverse=True)
```

### Mixing Rules (deja specifiees dans governance)

| Combination | Allowed | Raison |
|-------------|---------|--------|
| L1 + L2 | ✅ | Compatible fiabilite |
| L1 + L3 | ⚠️ | Warning affiche |
| L1 + L4 | ❌ | INTERDIT |
| L3 + L4 | ❌ | INTERDIT |

### Recommendation

1. Implementer `rerank_by_truth_level()` dans `rag_service.py`
2. Ajouter `mixing_warning` dans response metadata
3. Bloquer reponse si L1+L4 ou L3+L4 detectes

---

## 5. Refusal-First Policy

### Implementation Actuelle

Configuration dans le RAG service:

```python
# Config gating
MIN_SCORE_THRESHOLD = 0.70
MIN_RESULTS_REQUIRED = 3
```

### Behaviour Attendu

```
SI confidence < 0.70:
    RETOURNER { needs_clarification: true, message: "Je ne peux pas repondre..." }

SI results_count < 3:
    RETOURNER { needs_clarification: true, message: "Information insuffisante..." }
```

### Gap

- Controller NestJS non expose (module non importe)
- Frontend gating non implemente
- Pas de message de refus user-friendly

### Recommendation

1. **Backend:** Ajouter gating dans `RagProxyController`:
```typescript
if (response.confidence < 0.70) {
  return {
    success: false,
    needs_clarification: true,
    message: "Je n'ai pas assez d'informations pour repondre avec certitude.",
  };
}
```

2. **Frontend:** Afficher message de refus plutot que reponse incertaine

3. **Logging:** Logger tous les refus pour analyse

---

## 6. Golden Query Evaluation

### Purpose

Valider RAG avant activation PROD via suite de tests deterministes.

### Test Suite Proposee

| # | Query | Expected Answer | Truth Level | Min Confidence |
|---|-------|-----------------|-------------|----------------|
| 1 | "Quel est le delai de livraison standard?" | "48-72h ouvrables" | L1 | 0.85 |
| 2 | "Frais de port gratuits a partir de combien?" | "59 euros" | L1 | 0.85 |
| 3 | "Politique de retour?" | "14 jours" | L1 | 0.85 |
| 4 | "Moyens de paiement acceptes?" | "CB, PayPal, virement" | L1 | 0.85 |
| 5 | "Prix des disques de frein pour BMW?" | **REFUSE** (off-topic) | - | <0.70 |
| 6 | "Comment installer des plaquettes?" | Response de guide | L2 | 0.75 |
| 7 | "Qu'est-ce que le temoin ABS?" | Response diagnostic | L2 | 0.75 |
| 8 | "Recette de cuisine?" | **REFUSE** (off-topic) | - | <0.70 |

### Pass Criteria

```yaml
golden_tests:
  l1_accuracy: 100%      # Toutes les questions L1 correctes
  l2_accuracy: 90%       # 90% des questions L2 correctes
  refusal_accuracy: 100% # Tous les off-topic refuses
  hallucination_rate: 0% # Zero invention
```

### Implementation

```bash
# Script de test (a creer)
#!/bin/bash
# /opt/automecanik/rag/scripts/run_golden_tests.sh

TESTS=(
  '{"query": "delai livraison", "expected": "48-72h", "min_conf": 0.85}'
  '{"query": "prix BMW", "expected": "REFUSE", "max_conf": 0.70}'
)

for test in "${TESTS[@]}"; do
  result=$(curl -s -X POST http://localhost:8000/chat -d "$test")
  # Validate result
done
```

### Gate Decision

```
SI golden_tests.pass_rate >= 100%:
    AUTORISER activation RAG PROD
SINON:
    MAINTENIR RAG OFF
    LOGGER failed tests pour correction
```

---

## 7. Doc Canonization Strategy

### Probleme

Docs obsoletes dans `.spec/` peuvent "empoisonner" le RAG si indexes.

### Etat Actuel Documentation

| Categorie | Count | Location | RAG Indexable |
|-----------|-------|----------|---------------|
| CANON | 3 | `.spec/00-canon/` | NON (specs, pas FAQ) |
| FEATURES | 50 | `.spec/features/` | NON (specs techniques) |
| OBSOLETE | 13 | `.spec/.archive/` | NON (archive) |
| RAG CORPUS | 15 | `/rag/knowledge/` | OUI |

### Regles d'Indexation RAG

```yaml
indexation_rules:
  allowed:
    - /opt/automecanik/rag/knowledge/**/*.md

  required_frontmatter:
    - truth_level: [L1, L2]  # L3, L4 exclus en PROD
    - source_type: defined
    - verification_status: verified

  excluded:
    - .spec/**  # Jamais indexer specs techniques
    - .archive/**  # Jamais indexer archives
    - **/*obsolete*/**  # Pattern exclusion
```

### Process Canonization

```
1. Document cree/modifie
       ↓
2. Frontmatter valide? (truth_level, source_type, verified)
       ↓ NON → REJETE (pas d'indexation)
       ↓ OUI
3. truth_level L1 ou L2?
       ↓ NON → DEV only (pas PROD)
       ↓ OUI
4. Namespace correct? (knowledge:faq pour PROD)
       ↓ NON → DEV only
       ↓ OUI
5. INDEXATION PROD autorisee
```

### Recommendation

1. **Separation stricte:** Specs (.spec/) jamais dans corpus RAG
2. **Validation frontmatter:** Script de pre-indexation
3. **Audit periodique:** Verifier qu'aucun doc obsolete n'est indexe
4. **Versioning:** Hash SHA256 de chaque doc indexe

---

## 8. Recommendations

### Immediate (P0 - Cette phase)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Maintenir RAG OFF (status quo) | 0 | Securite |
| 2 | Completer frontmatter corpus (15 docs) | 1h | Data quality |
| 3 | Creer golden test suite | 2h | Validation gate |

### Court Terme (P1 - Apres golden tests)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 4 | Ajouter `RagProxyModule` import | 10min | Activation endpoints |
| 5 | Implementer gating frontend | 2h | UX refus propre |
| 6 | Implementer reranking truth_level | 1h | Qualite reponses |

### Moyen Terme (P2 - Build phase)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 7 | Completer LangGraph pipeline | 4h | Context generation |
| 8 | Creer ChatWidget Remix | 4h | Interface utilisateur |
| 9 | Monitoring & alerting RAG | 2h | Operations |

---

## 9. Assumptions & Open Questions

### Assumptions (Best-Effort)

| # | Assumption | Confidence |
|---|------------|------------|
| A1 | RAG service fonctionne sur localhost:8000 en dev | HIGH |
| A2 | Weaviate indexe correctement les 15 docs | MEDIUM |
| A3 | Namespace guard bloque effectivement hors-faq en PROD | HIGH |
| A4 | Kill switch AI_PROD_WRITE=false est respecte | HIGH |
| A5 | Frontend n'a pas de composant RAG cache | MEDIUM |

### Open Questions

| # | Question | Impact si non resolu |
|---|----------|----------------------|
| Q1 | Le corpus RAG est-il actuellement indexe dans Weaviate? | Peut bloquer tests |
| Q2 | Les embeddings sont-ils a jour (all-MiniLM-L6-v2)? | Qualite recherche |
| Q3 | Y a-t-il des logs RAG existants a analyser? | Insights usage |
| Q4 | Qui valide la promotion L3→L2 des documents? | Process ownership |
| Q5 | Frequence de re-indexation prevue? | Freshness corpus |

### Risques Identifies

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| RAG active par erreur | LOW | HIGH | Kill switch + module non importe |
| Hallucination en prod | LOW (RAG OFF) | CRITICAL | Golden tests obligatoires |
| Corpus empoisonne | LOW | HIGH | Separation stricte .spec vs /rag |
| Gating bypass | MEDIUM | MEDIUM | Hardcode thresholds |

---

## Conclusion

Le systeme RAG est correctement concu avec des securites robustes (namespace hardcode, kill switch, gating). Le blocker principal (module non importe) constitue paradoxalement une protection.

**Decision recommandee:** Maintenir RAG OFF jusqu'a:
1. Golden tests implementes et passes a 100%
2. Frontmatter corpus complet (100% truth_level)
3. Validation manuelle du scope namespace PROD

---

_Technical Research complete - 2026-01-06_
_BMad Method v6.0.0-alpha.22_
